import { parsePhoneNumberFromString } from 'libphonenumber-js';

const DEVANAGARI_ZERO = 0x0966;

/** Devanagari digits (०-९) to ASCII, so numbers typed on a Marathi/Hindi keyboard work. */
export function toAsciiDigits(input: string): string {
  return input.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - DEVANAGARI_ZERO));
}

/**
 * Normalises to E.164. Numbers without a country code are read as Indian, which is only an input
 * convenience: any valid international number is accepted with a leading "+".
 */
export function normalizePhone(input: string): string | null {
  const parsed = parsePhoneNumberFromString(toAsciiDigits(input.trim()), 'IN');
  if (!parsed?.isValid()) return null;
  // Indian landlines are not mobile numbers; other numbering plans often cannot distinguish the two.
  if (parsed.country === 'IN' && !/^[6-9]\d{9}$/.test(parsed.nationalNumber)) return null;
  return parsed.number;
}
