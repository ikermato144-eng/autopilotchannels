// Unit tests for the EU VAT price line (the <script id="eu-vat"> block in index.html).
// Run from the repo root: node --test tests/eu-vat.test.mjs   (Node 18+, no dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const legal = readFileSync(new URL('legal.html', root), 'utf8');
const css = readFileSync(new URL('styles.css', root), 'utf8');

const match = html.match(/<script id="eu-vat">([\s\S]*?)<\/script>/);
assert.ok(match, 'index.html must contain <script id="eu-vat">');
const SCRIPT = match[1];

// Runs the inline script exactly as shipped, in a fresh context.
function load(globals = {}) {
  const sandbox = { module: { exports: {} }, ...globals };
  vm.runInNewContext(SCRIPT, sandbox, { filename: 'index.html#eu-vat' });
  return sandbox.module.exports;
}

// Minimal DOM built from the real [data-eu-vat*] tags of index.html, in page order.
function fakeDocument() {
  const els = [];
  for (const m of html.matchAll(/<(p|span)\s([^>]*\bdata-eu-vat[^>]*)>/g)) {
    const attrs = {};
    for (const a of m[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] ?? '';
    const parentClasses = new Set();
    els.push({
      attrs,
      hidden: 'hidden' in attrs,
      textContent: '',
      parentClasses,
      parentNode: { classList: { add: (c) => parentClasses.add(c) } },
      getAttribute: (n) => (n in attrs ? attrs[n] : null),
      hasAttribute: (n) => n in attrs,
    });
  }
  return {
    els,
    querySelectorAll(sel) {
      const name = sel.match(/^\[([\w-]+)\]$/)[1];
      return els.filter((e) => name in e.attrs);
    },
  };
}
const priceLines = (doc) => doc.els.filter((e) => 'data-eu-vat' in e.attrs);
const b2bNotes = (doc) => doc.els.filter((e) => 'data-eu-vat-b2b' in e.attrs);
const untouched = (doc) => doc.els.every((e) => e.hidden && e.textContent === '' && e.parentClasses.size === 0);

const api = load();

const EXPECTED_RATES = { AT: 20, BE: 21, BG: 20, CY: 19, CZ: 21, DE: 19, DK: 25, EE: 24, ES: 21, FI: 25.5,
  FR: 20, GR: 24, HR: 25, HU: 27, IE: 23, IT: 22, LT: 21, LU: 17, LV: 21, MT: 18, NL: 21, PL: 23,
  PT: 23, RO: 21, SE: 25, SI: 22, SK: 23 };

// $297 plus VAT, rounded half up to the cent.
const GROSS_297 = { AT: '356.40', BE: '359.37', BG: '356.40', CY: '353.43', CZ: '359.37', DE: '353.43',
  DK: '371.25', EE: '368.28', ES: '359.37', FI: '372.74', FR: '356.40', GR: '368.28', HR: '371.25',
  HU: '377.19', IE: '365.31', IT: '362.34', LT: '359.37', LU: '347.49', LV: '359.37', MT: '350.46',
  NL: '359.37', PL: '365.31', PT: '365.31', RO: '359.37', SE: '371.25', SI: '362.34', SK: '365.31' };

// The only zones that show a VAT line.
const EU_ZONES = {
  'Europe/Madrid': 'ES', 'Europe/Lisbon': 'PT', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE',
  'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Luxembourg': 'LU',
  'Europe/Vienna': 'AT', 'Europe/Dublin': 'IE', 'Europe/Warsaw': 'PL', 'Europe/Prague': 'CZ',
  'Europe/Bratislava': 'SK', 'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO', 'Europe/Sofia': 'BG',
  'Europe/Athens': 'GR', 'Europe/Helsinki': 'FI', 'Europe/Stockholm': 'SE', 'Europe/Copenhagen': 'DK',
  'Europe/Tallinn': 'EE', 'Europe/Riga': 'LV', 'Europe/Vilnius': 'LT', 'Europe/Malta': 'MT',
  'Europe/Zagreb': 'HR', 'Europe/Ljubljana': 'SI', 'Asia/Nicosia': 'CY', 'Europe/Nicosia': 'CY',
};

// Zones next to or inside those countries that show no VAT line.
const NO_LINE = ['Atlantic/Madeira', 'Atlantic/Azores', 'Europe/Monaco', 'Europe/Busingen', 'Atlantic/Canary',
  'Africa/Ceuta', 'Europe/Mariehamn', 'Europe/San_Marino', 'Europe/Vatican', 'Asia/Famagusta'];

test('rate table is exactly the 27 EU countries, each with a name', () => {
  assert.deepEqual({ ...api.RATES }, EXPECTED_RATES);
  for (const cc of Object.keys(EXPECTED_RATES)) assert.ok(api.NAMES[cc], `name for ${cc}`);
});

test('EU time zones map to their country, and no other zone does', () => {
  for (const [tz, cc] of Object.entries(EU_ZONES)) assert.equal(api.countryFromTimeZone(tz), cc, tz);
  assert.deepEqual(new Set(Object.values(EU_ZONES)), new Set(Object.keys(EXPECTED_RATES)), 'every country has a zone');
  const mapped = Object.fromEntries(Object.entries(api.ZONES).filter(([, cc]) => cc));
  assert.deepEqual(mapped, EU_ZONES, 'the shipped table maps exactly these zones');
});

test('zones with no VAT line, non-EU and unknown zones give no country', () => {
  for (const tz of NO_LINE) assert.equal(api.ZONES[tz], '', `${tz} is listed with no country`);
  for (const tz of [...NO_LINE, 'Europe/London', 'Europe/Zurich', 'Europe/Oslo', 'Europe/Kyiv', 'Europe/Istanbul',
    'Europe/Gibraltar', 'Europe/Andorra', 'Atlantic/Faroe', 'America/Nuuk', 'Indian/Reunion', 'America/Martinique',
    'America/New_York', 'Asia/Kolkata', 'UTC', 'Etc/UTC', 'CET', '', undefined, null, '__proto__',
    'constructor', 'toString', 'europe/madrid']) {
    assert.equal(api.countryFromTimeZone(tz), null, String(tz));
  }
});

test('text is the final price incl. VAT, rounded to cents, in the site format', () => {
  for (const [cc, gross] of Object.entries(GROSS_297)) {
    const label = `${api.NAMES[cc]}\u00a0${EXPECTED_RATES[cc]}%`;
    assert.equal(api.vatText(29700, cc), `$${gross} incl. VAT (${label})`, cc);
    assert.equal(api.vatText(29700, cc, true), `$${gross} incl. VAT`, cc);
  }
  assert.equal(api.vatText(29700, 'ES'), '$359.37 incl. VAT (Spain\u00a021%)');
  assert.equal(api.vatText(29700, 'FI'), '$372.74 incl. VAT (Finland\u00a025.5%)');
  assert.equal(api.vatText(149700, 'ES'), '$1,811.37 incl. VAT (Spain\u00a021%)');
});

test('Spanish visitor: the 3 price lines show Spain 21%, the final CTA one as today\'s price, no business note', () => {
  const doc = fakeDocument();
  assert.equal(api.apply(doc, 'Europe/Madrid'), 'ES');
  const lines = priceLines(doc);
  assert.deepEqual(lines.map((l) => l.textContent),
    ['$359.37 incl. VAT (Spain\u00a021%)', 'Today: $359.37 incl. VAT (Spain\u00a021%)', '$359.37 incl. VAT']);
  for (const l of lines) {
    assert.equal(l.hidden, false);
    assert.ok(l.parentClasses.has('has-eu-vat'));
  }
  assert.ok(b2bNotes(doc).every((n) => n.hidden), 'no business note for Spain');
});

test('French visitor: France 20% and the business note once', () => {
  const doc = fakeDocument();
  assert.equal(api.apply(doc, 'Europe/Paris'), 'FR');
  assert.deepEqual(priceLines(doc).map((l) => l.textContent),
    ['$356.40 incl. VAT (France\u00a020%)', 'Today: $356.40 incl. VAT (France\u00a020%)', '$356.40 incl. VAT']);
  const notes = b2bNotes(doc);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].hidden, false);
});

test('visitors in zones with no VAT line: nothing on the page changes', () => {
  for (const tz of [...NO_LINE, 'America/New_York', 'Europe/London', 'UTC', '']) {
    const doc = fakeDocument();
    assert.equal(api.apply(doc, tz), null, tz);
    assert.ok(untouched(doc), tz);
  }
});

test('as shipped, the script reads the browser time zone and fills the page by itself', () => {
  const intl = (tz) => ({ DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: tz }) }) });
  let doc = fakeDocument();
  load({ document: doc, Intl: intl('Europe/Berlin') });
  assert.deepEqual(priceLines(doc).map((l) => l.textContent),
    ['$353.43 incl. VAT (Germany\u00a019%)', 'Today: $353.43 incl. VAT (Germany\u00a019%)', '$353.43 incl. VAT']);

  for (const tz of ['America/Los_Angeles', 'Atlantic/Madeira', 'Europe/Monaco', undefined]) {
    doc = fakeDocument();
    load({ document: doc, Intl: intl(tz) });
    assert.ok(untouched(doc), String(tz));
  }

  doc = fakeDocument();
  load({ document: doc, Intl: { DateTimeFormat: () => { throw new Error('no Intl'); } } });
  assert.ok(untouched(doc), 'a broken Intl changes nothing and throws nothing');
});

test('markup: every $297 shown on the page has a hidden VAT line next to it', () => {
  const stack = html.match(/<span class="blue">\$297<\/span><\/div>\s*<p class="muted small eu-vat" data-eu-vat="29700" hidden><\/p>/);
  const final = html.match(/<b>\$297<\/b>[^\n]*\n\s*<span class="small eu-vat" data-eu-vat="29700" data-eu-vat-label="Today:" hidden><\/span>/);
  const sticky = html.match(/<span class="sc-price"><s>\$497<\/s> <b>\$297<\/b><span class="eu-vat" data-eu-vat="29700" data-eu-vat-short hidden><\/span><\/span>/);
  assert.ok(stack, 'stack total');
  assert.ok(final, 'final CTA');
  assert.ok(sticky, 'sticky mobile bar');
  assert.equal((html.match(/data-eu-vat="/g) || []).length, 3);
  assert.match(css, /\.eu-vat\[hidden\]\{display:none !important\}/, 'hidden lines stay hidden whatever their display rule');
});

test('business note: one note, exact wording', () => {
  const notes = [...html.matchAll(/<p class="muted small eu-vat" data-eu-vat-b2b hidden>([^<]*)<\/p>/g)];
  assert.equal(notes.length, 1);
  assert.equal(notes[0][1], 'EU businesses outside Spain with a valid VAT number pay no VAT (reverse charge).');
  assert.equal((html.replace(SCRIPT, '').match(/data-eu-vat-b2b/g) || []).length, 1, 'one note in the markup');
});

test('seller is identified in both footers and in the legal terms, and is the data controller', () => {
  const seller = 'IKERPRIME, S.L. · NIF B26902544 · VAT ESB26902544 · Calle Almirante Mourelle 50, 5º D, 15011 A Coruña (España)';
  const footer = html.match(/<footer>([\s\S]*?)<\/footer>/)[1];
  assert.ok(footer.includes(seller) && footer.includes('mailto:contactryanyta@gmail.com'), 'index footer');
  const terms = legal.match(/<section id="terms">([\s\S]*?)<\/section>/)[1];
  assert.ok(terms.includes(`<strong>Seller.</strong> ${seller} · <a href="mailto:contactryanyta@gmail.com">`), 'legal seller');
  assert.ok(terms.includes('"I" and "me" mean the seller, IKERPRIME, S.L., acting through Ryan.'), '"I"/"me" is the seller');
  const privacy = legal.match(/<section id="privacy">([\s\S]*?)<\/section>/)[1];
  assert.ok(privacy.includes('The data controller is IKERPRIME, S.L.'), 'privacy names the controller');
  const legalFooter = legal.match(/<footer>([\s\S]*?)<\/footer>/)[1];
  assert.ok(legalFooter.includes(seller) && legalFooter.includes('mailto:contactryanyta@gmail.com'), 'legal footer');
  assert.doesNotMatch(html + legal, /NIF ES/, 'the NIF has no ES prefix');
});

test('no tax wording in the comments of the served pages and stylesheet', () => {
  const comments = [
    ...[html, legal].flatMap((f) => [...f.matchAll(/<!--[\s\S]*?-->/g)].map((m) => m[0])),
    ...[...css.matchAll(/\/\*[\s\S]*?\*\//g)].map((m) => m[0]),
  ];
  for (const c of comments) assert.doesNotMatch(c, /\b(vat|iva|tax|taxes|stripe|oss|nif|reverse)\b/i, c);
  assert.doesNotMatch(SCRIPT, /\/\/|\/\*/, 'the inline script carries no comments');
});
