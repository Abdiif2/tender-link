import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEthiopianVat,
  generateUniqueTxRef,
  getFriendlyPaymentStatusMessage,
  mapChapaStatus,
  sanitizeProviderMetadata,
} from '../src/billing/chapa.ts';

test('generateUniqueTxRef produces unique prefixed ETB references', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const ref = generateUniqueTxRef('TL-ET');
    assert.equal(ref.startsWith('TL-ET-'), true);
    assert.equal(seen.has(ref), false);
    seen.add(ref);
  }
});

test('calculateEthiopianVat computes exact 15% ETB VAT and handles zero/exempt correctly', () => {
  const starter = calculateEthiopianVat(499, 1500, true);
  assert.equal(starter.subtotalEtb, 499);
  assert.equal(starter.vatEtb, 75); // Math.round(499 * 0.15 = 74.85) = 75
  assert.equal(starter.totalEtb, 574);
  assert.equal(starter.currency, 'ETB');

  const pro = calculateEthiopianVat(1500, 1500, true);
  assert.equal(pro.vatEtb, 225);
  assert.equal(pro.totalEtb, 1725);

  const exempt = calculateEthiopianVat(1500, 1500, false);
  assert.equal(exempt.vatEtb, 0);
  assert.equal(exempt.totalEtb, 1500);

  const free = calculateEthiopianVat(0, 1500, true);
  assert.equal(free.totalEtb, 0);
});

test('sanitizeProviderMetadata redacts card, PAN, CVV, PIN, and secret fields recursively', () => {
  const dirty = {
    tx_ref: 'TL-ET-123',
    amount: 574,
    card_number: '4111-1111-1111-1111',
    cvv: '123',
    nested: {
      telebirr_pin: '9999',
      authorization_token: 'secret-abc',
      channel: 'telebirr',
    },
  };
  const clean = sanitizeProviderMetadata(dirty);
  assert.equal(clean.tx_ref, 'TL-ET-123');
  assert.equal(clean.card_number, '[REDACTED]');
  assert.equal(clean.cvv, '[REDACTED]');
  assert.equal((clean.nested as Record<string, unknown>).telebirr_pin, '[REDACTED]');
  assert.equal((clean.nested as Record<string, unknown>).authorization_token, '[REDACTED]');
  assert.equal((clean.nested as Record<string, unknown>).channel, 'telebirr');
});

test('mapChapaStatus maps all 7 lifecycle states and friendly error copy exists', () => {
  assert.equal(mapChapaStatus('success'), 'succeeded');
  assert.equal(mapChapaStatus('processing'), 'processing');
  assert.equal(mapChapaStatus('pending'), 'pending');
  assert.equal(mapChapaStatus('cancelled'), 'cancelled');
  assert.equal(mapChapaStatus('refunded'), 'refunded');
  assert.equal(mapChapaStatus('disputed'), 'disputed');
  assert.equal(mapChapaStatus('declined'), 'failed');

  for (const st of ['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded', 'disputed'] as const) {
    const msg = getFriendlyPaymentStatusMessage(st);
    assert.equal(msg.title.length > 5, true);
    assert.equal(msg.message.length > 20, true);
  }
});
