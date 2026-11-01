import type { Attribute, Configurator, Rule, Selections } from './types';

// Client-side mirror of the compatibility rules for instant feedback.
// The API re-validates everything; this only shapes the UI.
// Earlier attributes win: a later choice that conflicts with an earlier one is disabled,
// and changing an earlier choice auto-adjusts the later ones.

export const attributesOf = (c: Configurator) => c.steps.flatMap((s) => s.attributes);

const codesOf = (v: Selections[string] | undefined): string[] =>
  v == null || typeof v === 'number' ? [] : Array.isArray(v) ? v : [v];

export function defaultSelections(c: Configurator): Selections {
  const sel: Selections = {};
  for (const a of attributesOf(c)) {
    if (a.inputType === 'NUMBER') sel[a.key] = a.defaultValue ?? a.min ?? 0;
    else if (a.inputType === 'SINGLE') sel[a.key] = (a.options.find((o) => o.isDefault) ?? a.options[0])?.code ?? '';
    else sel[a.key] = a.options.filter((o) => o.isDefault).map((o) => o.code);
  }
  return normalize(c, sel);
}

/** Why an option can't be picked given choices in earlier attributes, or null. */
export function blockReason(c: Configurator, attrKey: string, code: string, sel: Selections): string | null {
  const attrs = attributesOf(c);
  const idx = attrs.findIndex((a) => a.key === attrKey);
  const earlier = new Set(attrs.slice(0, idx).flatMap((a) => codesOf(sel[a.key])));
  const earlierAll = new Set(attrs.slice(0, idx).flatMap((a) => a.options.map((o) => o.code)));
  const own = new Set(attrs[idx]?.options.map((o) => o.code));

  for (const r of c.rules) {
    if (r.type === 'EXCLUDES') {
      if (r.optionCode === code && earlier.has(r.targetCode)) return message(c, r);
      if (r.targetCode === code && earlier.has(r.optionCode)) return message(c, r);
    } else {
      // This option needs something an earlier step didn't choose.
      if (r.optionCode === code && earlierAll.has(r.targetCode) && !earlier.has(r.targetCode)) return message(c, r);
      // An earlier choice requires a different option of this same attribute.
      if (earlier.has(r.optionCode) && own.has(r.targetCode) && r.targetCode !== code && attrs[idx].inputType === 'SINGLE')
        return message(c, r);
    }
  }
  return null;
}

function message(c: Configurator, r: Rule) {
  if (r.messageAr) return r.messageAr;
  const label = (code: string) => attributesOf(c).flatMap((a) => a.options).find((o) => o.code === code)?.labelAr ?? code;
  return r.type === 'EXCLUDES' ? `لا يتوافق مع "${label(r.targetCode)}"` : `يتطلب "${label(r.targetCode)}"`;
}

/** Walks attributes in order, applying REQUIRES and replacing choices that conflict with earlier ones. */
export function normalize(c: Configurator, input: Selections): Selections {
  const sel: Selections = { ...input };
  const attrs = attributesOf(c);
  attrs.forEach((a: Attribute, idx) => {
    if (a.inputType === 'NUMBER') return;
    const earlier = new Set(attrs.slice(0, idx).flatMap((x) => codesOf(sel[x.key])));
    const own = new Set(a.options.map((o) => o.code));
    const forced = c.rules.filter((r) => r.type === 'REQUIRES' && earlier.has(r.optionCode) && own.has(r.targetCode)).map((r) => r.targetCode);

    if (a.inputType === 'SINGLE') {
      const current = sel[a.key] as string;
      if (forced[0]) sel[a.key] = forced[0];
      else if (!current || blockReason(c, a.key, current, sel)) {
        sel[a.key] = a.options.find((o) => !blockReason(c, a.key, o.code, sel))?.code ?? current;
      }
    } else {
      const kept = codesOf(sel[a.key]).filter((code) => !blockReason(c, a.key, code, sel));
      sel[a.key] = [...new Set([...kept, ...forced])];
    }
  });
  return sel;
}
