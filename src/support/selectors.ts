/**
 * UiAutomator selector builders. React Native exposes accessibilityLabel as content-desc and
 * merges the labels of a pressable's children into its content-desc (icon glyphs included), so
 * most lookups match text or the end of a description.
 */

/** Escapes a value for a double-quoted string inside a UiSelector expression. */
const str = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
/** Escapes regex metacharacters so a label is matched literally inside descriptionMatches. */
const lit = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ui = (expr: string) => `android=new UiSelector()${expr}`;

export const byText = (text: string) => ui(`.text(${str(text)})`);
export const byTextStartsWith = (text: string) => ui(`.textStartsWith(${str(text)})`);
export const byTextContains = (text: string) => ui(`.textContains(${str(text)})`);
export const byTextMatches = (regex: string) => ui(`.textMatches(${str(regex)})`);
/** Exact accessibility label (content-desc). */
export const byLabel = (label: string) => `~${label}`;
export const byLabelContains = (text: string) => ui(`.descriptionContains(${str(text)})`);
export const byLabelStartsWith = (text: string) => ui(`.descriptionStartsWith(${str(text)})`);
/** The n-th (0-based) element with this exact label, for labels React Native repeats on one screen. */
export const byLabelNth = (label: string, n: number) => ui(`.description(${str(label)}).instance(${n})`);
export const byTextNth = (text: string, n: number) => ui(`.text(${str(text)}).instance(${n})`);
/**
 * The text field that follows a form label ("Name *", "Flight number"...). Form fields render the
 * label and the input as siblings, and inputs lose their placeholder once they have a value.
 */
export const inputAfterLabel = (label: string) =>
  `//*[starts-with(@text, ${xpathString(label)})]/following-sibling::android.widget.EditText[1]`;
const xpathString = (s: string) => (s.includes('"') ? `concat("${s.split('"').join(`", '"', "`)}")` : `"${s}"`);
/** A pressable whose merged label ends with ", <label>" (tabs, list rows with an icon or flag in front). */
export const byLabelEnding = (label: string) => ui(`.descriptionMatches(${str(`(?s).*, ${lit(label)}$`)})`);
/** A pressable whose merged label contains ", <label>," or ends with ", <label>" (rows with trailing icons). */
export const byLabelItem = (label: string) => ui(`.descriptionMatches(${str(`(?s).*, ${lit(label)}(,.*)?$`)})`);
export const byClass = (cls: string) => ui(`.className(${str(cls)})`);
export const byId = (id: string) => ui(`.resourceId(${str(id)})`);
export const editText = (placeholderOrValue: string) => ui(`.className("android.widget.EditText").text(${str(placeholderOrValue)})`);

/** Scrolls the first scrollable container until an element matching the inner UiSelector is visible. */
export const scrollTo = (inner: string) =>
  `android=new UiScrollable(new UiSelector().scrollable(true)).setMaxSearchSwipes(15).scrollIntoView(new UiSelector()${inner})`;
export const scrollToText = (text: string) => scrollTo(`.text(${str(text)})`);
export const scrollToLabel = (label: string) => scrollTo(`.description(${str(label)})`);
export const scrollToTextContains = (text: string) => scrollTo(`.textContains(${str(text)})`);

/** Android system dialog (React Native Alert.alert). */
export const alertIds = {
  title: 'android:id/alertTitle',
  message: 'android:id/message',
  positive: 'android:id/button1',
  negative: 'android:id/button2',
  neutral: 'android:id/button3',
};
