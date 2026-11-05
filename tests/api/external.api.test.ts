/** Third-party services the app calls directly. If one is down, the matching feature degrades. */
import { expect } from 'expect';

const getJson = async (url: string) => {
  const res = await fetch(url, { headers: { 'User-Agent': 'WorldlyQA/1.0 (support@getworldly.app)' } });
  return { status: res.status, body: res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text() };
};

describe('API · External services used by the app', () => {
  it('[API-EXT-001] exchange rates (open.er-api.com) return today\'s USD rates for travel costs', async () => {
    const { status, body } = await getJson('https://open.er-api.com/v6/latest/USD');
    expect(status).toBe(200);
    expect(body.result).toBe('success');
    expect(body.base_code).toBe('USD');
    for (const code of ['EUR', 'JPY', 'GBP', 'CRC', 'MXN']) expect(body.rates[code]).toBeGreaterThan(0);
    // Rates are refreshed daily
    expect(Date.now() / 1000 - body.time_last_update_unix).toBeLessThan(3 * 24 * 3600);
  });

  it('[API-EXT-002] Wikidata returns the Wikipedia article of a UNESCO site in the user\'s language', async () => {
    const { status, body } = await getJson('https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q676203&props=sitelinks&sitefilter=eswiki&format=json&origin=*');
    expect(status).toBe(200);
    expect(body.entities.Q676203.sitelinks.eswiki.title).toBeTruthy();
  });

  it('[API-EXT-003] Wikipedia returns a summary for a UNESCO site', async () => {
    const { status, body } = await getJson('https://en.wikipedia.org/api/rest_v1/page/summary/Machu_Picchu');
    expect(status).toBe(200);
    expect(body.extract.length).toBeGreaterThan(50);
  });

  for (const [id, page] of [['004', 'terms'], ['005', 'privacy'], ['006', 'credits']]) {
    it(`[API-EXT-${id}] the website's ${page} page linked from Profile is online`, async () => {
      const res = await fetch(`https://getworldly.app/en/${page}/`, { redirect: 'follow' });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
    });
  }
});
