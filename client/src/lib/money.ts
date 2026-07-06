/** Money is integer cents everywhere in the API. These helpers convert for display/input. */

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

/** Parse a user-typed dollar amount (e.g. "1,234.50", "$42") to integer cents, or null. */
export function dollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Cents → a plain "12.34" string for a number input's value. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
