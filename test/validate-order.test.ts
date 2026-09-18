import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateCreateOrderBody } from '../src/lib/validate-order.js';

// Every field is valid here, so each rejected case below fails for exactly one reason.
const VALID = { customer_email: 'ana@example.com', total_amount: 1500, type: 'sale' };

describe('validateCreateOrderBody: accepted', () => {
  test('valid body with the three required fields', () => {
    assert.deepEqual(validateCreateOrderBody(VALID), {
      ok: true,
      value: { customer_email: 'ana@example.com', total_amount: 1500, type: 'sale' },
    });
  });

  test('type sale and refund are accepted', () => {
    assert.deepEqual(validateCreateOrderBody({ ...VALID, type: 'sale' }), {
      ok: true,
      value: { ...VALID, type: 'sale' },
    });
    assert.deepEqual(validateCreateOrderBody({ ...VALID, type: 'refund' }), {
      ok: true,
      value: { ...VALID, type: 'refund' },
    });
  });

  test('smallest amount is 1 cent', () => {
    assert.equal(validateCreateOrderBody({ ...VALID, total_amount: 1 }).ok, true);
  });

  test('unknown extra fields are ignored and not returned', () => {
    const result = validateCreateOrderBody({ ...VALID, status: 'pending', merchant_id: 'm_other', id: 'x' });
    assert.deepEqual(result, { ok: true, value: VALID });
  });

  test('email is stored as sent, not trimmed', () => {
    const result = validateCreateOrderBody({ ...VALID, customer_email: ' ana@example.com ' });
    assert.deepEqual(result, { ok: true, value: { ...VALID, customer_email: ' ana@example.com ' } });
  });
});

describe('validateCreateOrderBody: rejected', () => {
  const invalidAmounts: Array<[string, unknown]> = [
    ['zero', 0],
    ['negative', -1],
    ['fraction', 10.5],
    ['numeric string', '100'],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['null', null],
    ['boolean', true],
  ];
  for (const [label, amount] of invalidAmounts) {
    test(`total_amount ${label}`, () => {
      assert.deepEqual(validateCreateOrderBody({ ...VALID, total_amount: amount }), { ok: false });
    });
  }

  test('total_amount missing', () => {
    assert.deepEqual(validateCreateOrderBody({ customer_email: 'ana@example.com', type: 'sale' }), { ok: false });
  });

  const invalidEmails: Array<[string, unknown]> = [
    ['empty string', ''],
    ['blank string', '   '],
    ['number', 42],
    ['null', null],
  ];
  for (const [label, email] of invalidEmails) {
    test(`customer_email ${label}`, () => {
      assert.deepEqual(validateCreateOrderBody({ ...VALID, customer_email: email }), { ok: false });
    });
  }

  test('customer_email missing', () => {
    assert.deepEqual(validateCreateOrderBody({ total_amount: 1500, type: 'sale' }), { ok: false });
  });

  test('type missing: there is no default, the caller must say sale or refund', () => {
    assert.deepEqual(validateCreateOrderBody({ customer_email: 'ana@example.com', total_amount: 1500 }), {
      ok: false,
    });
  });

  test('type explicitly undefined', () => {
    assert.deepEqual(validateCreateOrderBody({ ...VALID, type: undefined }), { ok: false });
  });

  const invalidTypes: Array<[string, unknown]> = [
    ['uppercase SALE', 'SALE'],
    ['unknown value gift', 'gift'],
    ['number', 1],
    ['null', null],
    ['empty string', ''],
  ];
  for (const [label, type] of invalidTypes) {
    test(`type ${label}`, () => {
      assert.deepEqual(validateCreateOrderBody({ ...VALID, type }), { ok: false });
    });
  }

  const invalidBodies: Array<[string, unknown]> = [
    ['undefined', undefined],
    ['null', null],
    ['string', 'hello'],
    ['number', 5],
    ['array', [VALID]],
  ];
  for (const [label, body] of invalidBodies) {
    test(`body ${label}`, () => {
      assert.deepEqual(validateCreateOrderBody(body), { ok: false });
    });
  }
});
