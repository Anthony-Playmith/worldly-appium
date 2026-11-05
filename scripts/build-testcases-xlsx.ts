/**
 * Builds docs/Worldly-Test-Cases.xlsx from testcases/catalog.ts and, when present, the latest
 * automated results (reports/results.json, written by `npm run report:summary`) and the tested
 * build (apps/build-info.json). Manual results typed into an existing workbook are carried over.
 *
 * Also checks that every automated test title's [ID] is in the catalog and vice versa.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import ExcelJS from 'exceljs';

import { env } from '../config/env.js';
import { catalog, type TestCase } from '../testcases/catalog.js';
import type { CaseResult } from './junit-summary.js';

const OUT = path.join(env.root, 'docs', 'Worldly-Test-Cases.xlsx');
const FONT = 'Arial';
const COLORS = { header: 'FF1F3A5F', headerText: 'FFFFFFFF', input: 'FFFFF9C4', band: 'FFF5F7FA', pass: 'FFC8E6C9', fail: 'FFFFCDD2', warn: 'FFFFE0B2', grey: 'FFE0E0E0', title: 'FFE9741D' };
const MANUAL_RESULTS = ['Pass', 'Fail', 'Blocked', 'Not run'];

// ─── Consistency check: test titles ↔ catalog
const testIds = new Set<string>();
for (const dir of ['tests/ui', 'tests/api', 'tests/db']) {
  for (const f of readdirSync(path.join(env.root, dir))) {
    const src = readFileSync(path.join(env.root, dir, f), 'utf8');
    for (const m of src.matchAll(/\[([A-Z]+-[A-Z]+-\d{3})\]/g)) testIds.add(m[1]);
    // external.api.test.ts builds its IDs in a loop
    for (const m of src.matchAll(/\['(\d{3})', '\w+'\]/g)) testIds.add(`API-EXT-${m[1]}`);
  }
}
const automated = new Set(catalog.filter((c) => c.automation === 'Automated').map((c) => c.id));
const missingInCatalog = [...testIds].filter((id) => !automated.has(id));
const missingTests = [...automated].filter((id) => !testIds.has(id));
const dupes = catalog.map((c) => c.id).filter((id, i, all) => all.indexOf(id) !== i);
if (missingInCatalog.length || missingTests.length || dupes.length) {
  console.error({ missingInCatalog, missingTests, duplicateIds: dupes });
  throw new Error('Test catalog and test files are out of sync (see above).');
}

// ─── Inputs
const readJson = <T>(file: string): T | null => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null);
const run = readJson<{ generatedAt: string; results: CaseResult[] }>(path.join(env.root, 'reports', 'results.json'));
const results = new Map((run?.results ?? []).map((r) => [r.id, r]));
const build = readJson<{ id: string; buildProfile: string; createdAt: string; gitCommitHash?: string }>(path.join(env.root, 'apps', 'build-info.json'));

/** Manual columns already filled in the previous workbook are kept. */
const MANUAL_COLS = ['Manual result', 'Tested by', 'Date tested', 'Build tested', 'Notes / bug link'];
async function previousManual(): Promise<Map<string, Record<string, ExcelJS.CellValue>>> {
  const kept = new Map<string, Record<string, ExcelJS.CellValue>>();
  if (!existsSync(OUT)) return kept;
  const old = new ExcelJS.Workbook();
  await old.xlsx.readFile(OUT);
  const ws = old.getWorksheet('Test Cases');
  if (!ws) return kept;
  const header = (ws.getRow(1).values as ExcelJS.CellValue[]).map((v) => String(v ?? ''));
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const id = String(row.getCell(1).value ?? '');
    const rec: Record<string, ExcelJS.CellValue> = {};
    for (const col of MANUAL_COLS) {
      const idx = header.indexOf(col);
      if (idx > 0) rec[col] = row.getCell(idx).value;
    }
    kept.set(id, rec);
  });
  return kept;
}
const kept = await previousManual();
const previousLog = await (async () => {
  if (!existsSync(OUT)) return [] as ExcelJS.CellValue[][];
  const old = new ExcelJS.Workbook();
  await old.xlsx.readFile(OUT);
  const ws = old.getWorksheet('Manual Run Log');
  const rows: ExcelJS.CellValue[][] = [];
  ws?.eachRow((row, n) => {
    if (n > 5) rows.push((row.values as ExcelJS.CellValue[]).slice(1, 9));
  });
  return rows;
})();

// ─── Workbook
const wb = new ExcelJS.Workbook();
wb.creator = 'Worldly QA automation';
wb.created = new Date();
wb.calcProperties.fullCalcOnLoad = true;

const font = (extra: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: FONT, size: 10, ...extra });
const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin: Partial<ExcelJS.Borders> = { top: { style: 'thin', color: { argb: 'FFD0D7DE' } }, bottom: { style: 'thin', color: { argb: 'FFD0D7DE' } }, left: { style: 'thin', color: { argb: 'FFD0D7DE' } }, right: { style: 'thin', color: { argb: 'FFD0D7DE' } } };
function styleHeader(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.font = font({ bold: true, color: { argb: COLORS.headerText } });
    c.fill = fill(COLORS.header);
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = thin;
  });
  row.height = 30;
}

// Summary is the first tab; it is filled in after the Test Cases sheet it summarises
const summary = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] });

// ─── Sheet: Test Cases
const tc = wb.addWorksheet('Test Cases', { views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }] });
const columns: { header: string; width: number; get: (c: TestCase) => ExcelJS.CellValue }[] = [
  { header: 'ID', width: 13, get: (c) => c.id },
  { header: 'Area', width: 20, get: (c) => c.area },
  { header: 'Layer', width: 7, get: (c) => c.layer },
  { header: 'Title', width: 46, get: (c) => c.title },
  { header: 'Priority', width: 12, get: (c) => c.priority },
  { header: 'Automation', width: 11, get: (c) => c.automation },
  { header: 'Preconditions', width: 30, get: (c) => c.preconditions },
  { header: 'Steps', width: 48, get: (c) => c.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') },
  { header: 'Expected result', width: 46, get: (c) => c.expected },
  { header: 'Test data', width: 18, get: (c) => c.data ?? '' },
  { header: 'Automated by', width: 26, get: (c) => c.spec ?? '—' },
  { header: 'Last automated result', width: 13, get: (c) => (c.automation === 'Manual' ? 'n/a' : (resultLabel(results.get(c.id)) ?? 'Not run')) },
  { header: 'Last automated run', width: 17, get: (c) => (results.has(c.id) && run ? new Date(run.generatedAt) : '') },
  { header: 'Failure details', width: 40, get: (c) => results.get(c.id)?.message ?? '' },
  ...MANUAL_COLS.map((h) => ({ header: h, width: h === 'Notes / bug link' ? 30 : 13, get: (c: TestCase) => kept.get(c.id)?.[h] ?? (h === 'Manual result' ? 'Not run' : '') })),
];
function resultLabel(r?: CaseResult) {
  return r ? ({ passed: 'Passed', failed: 'Failed', skipped: 'Skipped' } as const)[r.status] : undefined;
}
tc.columns = columns.map((c) => ({ header: c.header, width: c.width }));
styleHeader(tc.getRow(1));
catalog.forEach((c, i) => {
  const row = tc.addRow(columns.map((col) => col.get(c)));
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.font = font();
    cell.alignment = { vertical: 'top', wrapText: true };
    cell.border = thin;
    if (i % 2 === 1) cell.fill = fill(COLORS.band);
    if (col >= columns.length - MANUAL_COLS.length + 1) cell.fill = fill(COLORS.input);
  });
  row.getCell(1).font = font({ bold: true });
  row.getCell(13).numFmt = 'yyyy-mm-dd hh:mm';
  row.getCell(17).numFmt = 'yyyy-mm-dd';
});
const lastRow = catalog.length + 1;
tc.autoFilter = { from: 'A1', to: { row: lastRow, column: columns.length } };
const manualCol = columns.findIndex((c) => c.header === 'Manual result') + 1;
const manualLetter = tc.getColumn(manualCol).letter;
for (let r = 2; r <= lastRow; r++) {
  tc.getCell(r, manualCol).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${MANUAL_RESULTS.join(',')}"`] };
  tc.getCell(r, 17).dataValidation = { type: 'date', operator: 'greaterThan', allowBlank: true, formulae: [new Date(2026, 0, 1)] };
}
const resultRules = (ref: string, map: [string, string][]) =>
  tc.addConditionalFormatting({ ref, rules: map.map(([text, color], i) => ({ type: 'containsText', operator: 'containsText', text, priority: i + 1, style: { fill: fill(color), font: font({ bold: true }) } })) });
resultRules(`L2:L${lastRow}`, [['Passed', COLORS.pass], ['Failed', COLORS.fail], ['Not run', COLORS.grey]]);
resultRules(`${manualLetter}2:${manualLetter}${lastRow}`, [['Pass', COLORS.pass], ['Fail', COLORS.fail], ['Blocked', COLORS.warn]]);

// ─── Sheet: Summary (formulas over Test Cases, with cached values for previewers)
summary.getColumn(1).width = 30;
for (let c = 2; c <= 11; c++) summary.getColumn(c).width = 12;
summary.getCell('A1').value = 'Worldly — Test Cases & Results';
summary.getCell('A1').font = font({ size: 18, bold: true, color: { argb: COLORS.title } });
const info: [string, ExcelJS.CellValue][] = [
  ['App', 'Worldly (Android, package app.getworldly)'],
  ['Build tested', build ? `EAS ${build.buildProfile} build ${build.id.slice(0, 8)} (${build.createdAt.slice(0, 10)}${build.gitCommitHash ? `, commit ${build.gitCommitHash.slice(0, 7)}` : ''})` : 'See apps/build-info.json after `npm run app:download`'],
  ['Last automated run', run ? new Date(run.generatedAt) : 'No results yet — run the suite, then `npm run report:summary`'],
  ['Workbook generated', new Date()],
];
info.forEach(([k, v], i) => {
  const r = summary.getRow(3 + i);
  r.getCell(1).value = k;
  r.getCell(1).font = font({ bold: true });
  r.getCell(2).value = v;
  r.getCell(2).font = font();
  if (v instanceof Date) r.getCell(2).numFmt = 'yyyy-mm-dd hh:mm';
  r.getCell(2).alignment = { horizontal: 'left' };
});

const headRow = 9;
const heads = ['Area', 'Total', 'Automated', 'Manual', 'Auto passed', 'Auto failed', 'Auto not run', 'Manual pass', 'Manual fail', 'Manual blocked', 'Pass rate'];
summary.getRow(headRow).values = heads;
styleHeader(summary.getRow(headRow));
const areas = [...new Set(catalog.map((c) => c.area))];
const TC = `'Test Cases'`;
const rng = (col: string) => `${TC}!$${col}$2:$${col}$${lastRow}`;
const manualRng = rng(manualLetter);
const cnt = (pred: (c: TestCase) => boolean) => catalog.filter(pred).length;
const autoStatus = (c: TestCase) => (c.automation === 'Manual' ? 'n/a' : (resultLabel(results.get(c.id)) ?? 'Not run'));
const manualStatus = (c: TestCase) => String(kept.get(c.id)?.['Manual result'] ?? 'Not run');

areas.forEach((area, i) => {
  const r = headRow + 1 + i;
  const inArea = (c: TestCase) => c.area === area;
  const a = `$A${r}`;
  const cells: [string, number][] = [
    [`COUNTIF(${rng('B')},${a})`, cnt(inArea)],
    [`COUNTIFS(${rng('B')},${a},${rng('F')},"Automated")`, cnt((c) => inArea(c) && c.automation === 'Automated')],
    [`COUNTIFS(${rng('B')},${a},${rng('F')},"Manual")`, cnt((c) => inArea(c) && c.automation === 'Manual')],
    [`COUNTIFS(${rng('B')},${a},${rng('L')},"Passed")`, cnt((c) => inArea(c) && autoStatus(c) === 'Passed')],
    [`COUNTIFS(${rng('B')},${a},${rng('L')},"Failed")`, cnt((c) => inArea(c) && autoStatus(c) === 'Failed')],
    [`COUNTIFS(${rng('B')},${a},${rng('L')},"Not run")`, cnt((c) => inArea(c) && autoStatus(c) === 'Not run')],
    [`COUNTIFS(${rng('B')},${a},${manualRng},"Pass")`, cnt((c) => inArea(c) && manualStatus(c) === 'Pass')],
    [`COUNTIFS(${rng('B')},${a},${manualRng},"Fail")`, cnt((c) => inArea(c) && manualStatus(c) === 'Fail')],
    [`COUNTIFS(${rng('B')},${a},${manualRng},"Blocked")`, cnt((c) => inArea(c) && manualStatus(c) === 'Blocked')],
  ];
  const row = summary.getRow(r);
  row.getCell(1).value = area;
  cells.forEach(([formula, result], j) => (row.getCell(j + 2).value = { formula, result }));
  const passed = cells[3][1] + cells[6][1];
  const executed = cells[3][1] + cells[4][1] + cells[6][1] + cells[7][1] + cells[8][1];
  row.getCell(11).value = { formula: `IF((E${r}+F${r}+H${r}+I${r}+J${r})=0,"-",(E${r}+H${r})/(E${r}+F${r}+H${r}+I${r}+J${r}))`, result: executed ? passed / executed : '-' };
});
const firstArea = headRow + 1;
const lastArea = headRow + areas.length;
const totalRow = summary.getRow(lastArea + 1);
totalRow.getCell(1).value = 'Total';
for (let c = 2; c <= 10; c++) {
  const L = summary.getColumn(c).letter;
  let result = 0;
  for (let r = firstArea; r <= lastArea; r++) result += Number((summary.getCell(r, c).value as { result: number }).result);
  totalRow.getCell(c).value = { formula: `SUM(${L}${firstArea}:${L}${lastArea})`, result };
}
{
  const r = lastArea + 1;
  const g = (c: number) => Number((summary.getCell(r, c).value as { result: number }).result);
  const executed = g(5) + g(6) + g(8) + g(9) + g(10);
  totalRow.getCell(11).value = { formula: `IF((E${r}+F${r}+H${r}+I${r}+J${r})=0,"-",(E${r}+H${r})/(E${r}+F${r}+H${r}+I${r}+J${r}))`, result: executed ? (g(5) + g(8)) / executed : '-' };
}
for (let r = firstArea; r <= lastArea + 1; r++) {
  summary.getRow(r).eachCell({ includeEmpty: true }, (c, col) => {
    if (col > 11) return;
    c.font = font({ bold: r === lastArea + 1 });
    c.border = thin;
    if (r === lastArea + 1) c.fill = fill(COLORS.grey);
    else if ((r - firstArea) % 2 === 1) c.fill = fill(COLORS.band);
    if (col > 1) c.alignment = { horizontal: 'center' };
  });
  summary.getCell(r, 11).numFmt = '0%';
}
summary.addConditionalFormatting({ ref: `F${firstArea}:F${lastArea + 1}`, rules: [{ type: 'cellIs', operator: 'greaterThan', formulae: ['0'], priority: 1, style: { fill: fill(COLORS.fail), font: font({ bold: true }) } }] });

const notes = lastArea + 3;
const legend = [
  'How to use this workbook',
  '• Test Cases: one row per case. Grey/white columns are generated from testcases/catalog.ts; do not edit them here (edit the catalog and run `npm run testcases:excel`).',
  '• Yellow columns (Manual result, Tested by, Date tested, Build tested, Notes / bug link) are yours to fill in; they are kept when the workbook is regenerated.',
  '• "Last automated result" comes from the latest run (reports/results.json). Manual-only cases show n/a there.',
  '• Manual Run Log: add one row per manual execution if you run the same case several times.',
  '• Pass rate = passed ÷ executed (automated + manual); "-" when nothing has run yet.',
];
legend.forEach((text, i) => {
  const c = summary.getCell(notes + i, 1);
  c.value = text;
  c.font = font({ bold: i === 0, size: i === 0 ? 12 : 10 });
  summary.mergeCells(notes + i, 1, notes + i, 11);
});

// ─── Sheet: Manual Run Log
const log = wb.addWorksheet('Manual Run Log', { views: [{ state: 'frozen', ySplit: 5 }] });
log.getCell('A1').value = 'Manual Run Log';
log.getCell('A1').font = font({ size: 14, bold: true, color: { argb: COLORS.title } });
log.getCell('A2').value = 'Add one row per manual execution. Yellow cells are inputs; Result and Test ID have drop-down lists. Row 6 is an example — replace it with your first run.';
log.getCell('A2').font = font({ italic: true });
log.mergeCells('A2:H2');
const logHead = ['Date', 'Build / version', 'Device & Android version', 'Tester', 'Test ID', 'Title (auto)', 'Result', 'Notes / bug link'];
log.getRow(5).values = logHead;
styleHeader(log.getRow(5));
[12, 22, 24, 14, 13, 44, 10, 40].forEach((w, i) => (log.getColumn(i + 1).width = w));
const example: ExcelJS.CellValue[] = [new Date(2026, 10, 5), 'preview 32843989 (1.0.0)', 'Pixel 7, Android 15', 'Anthony', 'MAN-PUR-001', null, 'Pass', 'Example row — Play license tester, $6 test purchase'];
const logRows = previousLog.length ? previousLog : [example];
for (let i = 0; i < Math.max(logRows.length + 30, 60); i++) {
  const r = 6 + i;
  const values = logRows[i] ?? [];
  const row = log.getRow(r);
  for (let c = 1; c <= 8; c++) {
    const cell = row.getCell(c);
    if (c === 6) cell.value = { formula: `IF(E${r}="","",IFERROR(INDEX(${TC}!$D$2:$D$${lastRow},MATCH(E${r},${TC}!$A$2:$A$${lastRow},0)),"Unknown ID"))`, result: values[4] ? (catalog.find((x) => x.id === values[4])?.title ?? 'Unknown ID') : '' };
    else cell.value = (values[c - 1] as ExcelJS.CellValue) ?? null;
    cell.font = font();
    cell.border = thin;
    cell.alignment = { vertical: 'top', wrapText: true };
    if (c !== 6) cell.fill = fill(COLORS.input);
  }
  row.getCell(1).numFmt = 'yyyy-mm-dd';
  row.getCell(5).dataValidation = { type: 'list', allowBlank: true, formulae: [`${TC}!$A$2:$A$${lastRow}`] };
  row.getCell(7).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${MANUAL_RESULTS.slice(0, 3).join(',')}"`] };
}
log.addConditionalFormatting({ ref: `G6:G${6 + Math.max(logRows.length + 30, 60)}`, rules: [
  { type: 'containsText', operator: 'containsText', text: 'Pass', priority: 1, style: { fill: fill(COLORS.pass) } },
  { type: 'containsText', operator: 'containsText', text: 'Fail', priority: 2, style: { fill: fill(COLORS.fail) } },
  { type: 'containsText', operator: 'containsText', text: 'Blocked', priority: 3, style: { fill: fill(COLORS.warn) } },
] });

// ─── Sheet: How to run
const how = wb.addWorksheet('How to run', { views: [{ showGridLines: false }] });
how.getColumn(1).width = 120;
const lines = [
  ['How to run the automated suite', true],
  ['Everything lives in github.com/Anthony-Playmith/worldly-appium (see README.md for details).', false],
  ['', false],
  ['On your Android phone', true],
  ['1. Phone: Settings > About phone > tap "Build number" 7 times, then Developer options > USB debugging ON. Connect by USB and accept the prompt.', false],
  ['2. PC: `adb devices` must list the phone. In .env set ALLOW_APP_DATA_RESET=true (the UI specs erase Worldly\'s data on the phone).', false],
  ['3. Optional: APP_PATH=apps/worldly.apk installs the latest preview build first (`npm run app:download`). Leave it empty to test the Worldly already on the phone.', false],
  ['4. Run `npm run test:ui` (all), `npm run test:ui:smoke` (3 short specs) or `npm run test:ui:spec -- tests/ui/05-costs.e2e.ts`. Watch the phone: Appium opens Worldly and taps through each flow.', false],
  ['', false],
  ['API and database tests (no phone needed)', true],
  ['`npm run test:backend` — needs SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SECRET_KEY in .env.', false],
  ['', false],
  ['Twice a day, automatically', true],
  ['GitHub Actions runs "API & database tests" at 05:00 and 17:00 and "Android UI tests (emulator)" at 05:30 and 17:30 (Costa Rica time). Results: the Actions tab, the run summary and the downloadable "reports" artifact.', false],
  ['', false],
  ['Refresh this workbook with the latest results', true],
  ['`npm run report:summary` then `npm run testcases:excel` (the yellow manual columns are preserved).', false],
] as const;
lines.forEach(([text, bold], i) => {
  const c = how.getCell(i + 1, 1);
  c.value = text;
  c.font = font({ bold, size: bold ? 12 : 10 });
  c.alignment = { wrapText: true };
});

await wb.xlsx.writeFile(OUT);
const autoCount = catalog.filter((c) => c.automation === 'Automated').length;
console.log(`Wrote ${path.relative(env.root, OUT)}: ${catalog.length} cases (${autoCount} automated, ${catalog.length - autoCount} manual), ${results.size} automated results.`);
