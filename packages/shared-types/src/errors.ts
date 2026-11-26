/** Stable error codes. Clients localise these (messages: `errors.<CODE>`). */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INVALID_CREDENTIALS',
  'TOO_MANY_ATTEMPTS',
  'TEMP_PASSWORD_EXPIRED',
  'PASSWORD_CHANGE_REQUIRED',
  'PASSWORD_UNCHANGED',
  'CURRENT_PASSWORD_INCORRECT',
  'REGISTRATION_UNAVAILABLE',
  'ACCOUNT_SUSPENDED',
  'INVALID_STATUS_TRANSITION',
  'INVALID_CATALOGUE_REFERENCE',
  'LISTING_NOT_ACTIVE',
  'CONTACT_DISABLED',
  'OWNER_UNAVAILABLE',
  'OWN_LISTING',
  'ALREADY_REPORTED',
  'PLACE_NOT_FOUND',
  'NETWORK_ERROR',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  /** Field path → validation message key */
  details?: Record<string, string>;
  requestId?: string;
}
