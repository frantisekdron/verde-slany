/** Normalise English input to the existing Czech catalogue representation. */
export function normalizePrice(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const input = value.trim();
  if (/^(?:price )?on request$/i.test(input)) return 'Cena na dotaz';
  if (/^price not published$/i.test(input)) return 'Cena nezveřejněna';
  const english = /\bCZK\b|^from\b/i.test(input);
  const result = input.replace(/^from\s+/i, 'od ').replace(/\bCZK\b/gi, 'Kč');
  return english ? result.replace(/,(?=\d{3}(?:[, .]|\s*Kč|$))/g, ' ').replace(/\.(?=\d{1,2}(?:\s*Kč|$))/, ',') : result;
}
/** Accept existing catalogue values as well as English entry. */
export function isValidPrice(value: unknown): value is string {
  value = normalizePrice(value);
  if (typeof value !== 'string' || value.length > 80) return false;
  const input = value.trim().replace(/[\u00a0\u202f]/g, ' ');
  if (/^(?:na dotaz|cena na dotaz|cena nezveřejněna)$/i.test(input)) return true;

  const match = input.match(/^(?:od\s+)?(.+?)\s*(?:Kč\s*(?:\/\s*m(?:²|2))?|\/\s*m(?:²|2)\s*(?:Kč)?)?$/i);
  if (!match) return false;
  const amount = match[1].trim();
  // A plain positive integer or consistently grouped thousands, with an
  // optional Czech decimal comma. Group separators must occur in groups of 3.
  return /^(?:[1-9]\d*|[1-9]\d{0,2}(?:([. ])\d{3})+)(?:,\d{1,2})?$/.test(amount);
}
