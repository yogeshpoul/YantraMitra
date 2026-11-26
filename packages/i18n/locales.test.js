// Every language must have exactly the same keys and ICU placeholders as English.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const load = (l) => JSON.parse(readFileSync(new URL(`./locales/${l}.json`, import.meta.url), 'utf8'));
const flatten = (o, prefix = '') =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));
const placeholders = (s) => [...new Set([...s.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]))].sort();

const en = new Map(flatten(load('en')));

describe.each(['mr', 'hi'])('%s', (locale) => {
  const other = new Map(flatten(load(locale)));
  it('has the same keys as English', () => expect([...other.keys()].sort()).toEqual([...en.keys()].sort()));
  it('keeps every placeholder', () => {
    for (const [key, value] of en) expect([key, placeholders(other.get(key) ?? '')]).toEqual([key, placeholders(value)]);
  });
  it('has no empty translations except intentional ones', () => {
    for (const [key, value] of other) if (!key.endsWith('unit.contact_for_price')) expect([key, value.trim().length > 0]).toEqual([key, true]);
  });
});
