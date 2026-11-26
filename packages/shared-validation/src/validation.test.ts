import { listingIdFromSlug, listingPath, safeNextPath } from '@yantramitra/shared-types';
import { describe, expect, it } from 'vitest';
import { createListingSchema, fieldErrors, normalizePhone, registerSchema, searchSchema, updateListingSchema } from './index.js';

const id = '0b9f6c1e-2f55-4a53-9d7c-4a7d6f1f7a11';
const listing = {
  categoryId: id, equipmentTypeId: id, title: 'Tractor with rotavator', operationIds: [id], pricingType: 'hourly', price: 900,
  fuelTerm: 'included', operatorTerm: 'included', transportTerm: 'extra_cost',
  home: { lat: 18.5, lng: 73.8, label: 'Home' }, current: { lat: 18.6, lng: 73.9, label: 'Field' },
};

describe('normalizePhone', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['९८७६५४३२१०', '+919876543210'],
    ['+1 415 555 2671', '+14155552671'],
  ])('%s → %s', (input, expected) => expect(normalizePhone(input)).toBe(expected));
  it.each(['12345', '5876543210', 'abc', '', '+91 20 2612 3456'])('rejects %s', (v) => expect(normalizePhone(v)).toBeNull());
});

describe('registerSchema', () => {
  const base = { fullName: 'Asha Patil', mobile: '9876543210', password: 'shetkari-42', confirmPassword: 'shetkari-42', preferredLocale: 'mr' };
  it('accepts valid input', () => expect(registerSchema.parse(base).mobile).toBe('+919876543210'));
  it.each([
    [{ confirmPassword: 'x' }, 'confirmPassword', 'passwordMismatch'],
    [{ password: 'short', confirmPassword: 'short' }, 'password', 'passwordTooShort'],
    [{ password: '12345678', confirmPassword: '12345678' }, 'password', 'passwordTooCommon'],
    [{ mobile: '123' }, 'mobile', 'phoneInvalid'],
    [{ fullName: ' ' }, 'fullName', 'tooShort'],
  ])('rejects %o', (patch, field, key) => {
    const result = registerSchema.safeParse({ ...base, ...patch });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error)[field]).toBe(key);
  });
});

describe('listing schemas', () => {
  it('applies privacy-preserving defaults', () => {
    const v = createListingSchema.parse(listing);
    expect(v.home.visibility).toBe('hidden');
    expect(v.current.visibility).toBe('approximate');
  });
  it('requires a price unless contact_for_price', () => {
    expect(createListingSchema.safeParse({ ...listing, price: null }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...listing, pricingType: 'contact_for_price', price: null }).success).toBe(true);
    expect(createListingSchema.safeParse({ ...listing, pricingType: 'contact_for_price' }).success).toBe(false);
  });
  it.each([[91, 0], [0, 181], [null, 0], ['18', 73], [Number.NaN, 1]])('rejects coordinates %s,%s', (lat, lng) =>
    expect(createListingSchema.safeParse({ ...listing, current: { lat, lng, label: 'x' } }).success).toBe(false));
  it('ignores client-supplied owner and current location on update', () => {
    const v = updateListingSchema.parse({ title: 'New title here', ownerId: id, current: listing.current, status: 'suspended' });
    expect(Object.keys(v)).toEqual(['title']);
  });
});

describe('searchSchema', () => {
  it('has no default location', () => expect(searchSchema.parse({})).toEqual({ page: 1, pageSize: 20 }));
  it('needs both coordinates', () => expect(searchSchema.safeParse({ lat: '18' }).success).toBe(false));
  it('bounds the radius', () => expect(searchSchema.safeParse({ lat: 1, lng: 1, radiusKm: 5000 }).success).toBe(false));
});

describe('paths', () => {
  it('round-trips a listing id', () => expect(listingIdFromSlug(listingPath('tractors', 'tractor', id).split('/').pop()!)).toBe(id));
  it('does not mistake a type slug for a listing', () => expect(listingIdFromSlug('rotavator')).toBeNull());
  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', '', null])('blocks redirect %s', (v) => expect(safeNextPath(v)).toBe('/'));
  it('keeps internal paths', () => expect(safeNextPath('/listings/new?x=1')).toBe('/listings/new?x=1'));
});
