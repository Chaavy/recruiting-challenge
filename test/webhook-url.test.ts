import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateWebhookUrl } from '../src/lib/webhook-url.js';

const STRICT = { allowInsecure: false };
const DEV = { allowInsecure: true };

describe('validateWebhookUrl: accepted (strict)', () => {
  const accepted: Array<[string, string]> = [
    ['https://example.com/hooks/orders', 'https://example.com/hooks/orders'],
    ['https://example.com:8443/x?y=1', 'https://example.com:8443/x?y=1'],
    ['https://EXAMPLE.com', 'https://example.com/'], // normalised
    ['https://8.8.8.8/hook', 'https://8.8.8.8/hook'], // public IPv4
    ['https://172.32.0.1/hook', 'https://172.32.0.1/hook'], // just outside 172.16/12
    ['https://100.128.0.1/hook', 'https://100.128.0.1/hook'], // just outside 100.64/10
    ['https://[2606:4700:4700::1111]/hook', 'https://[2606:4700:4700::1111]/hook'], // public IPv6
  ];
  for (const [input, expected] of accepted) {
    test(input, () => {
      assert.deepEqual(validateWebhookUrl(input, STRICT), { ok: true, url: expected });
    });
  }
});

describe('validateWebhookUrl: rejected (strict)', () => {
  const rejected: Array<[string, unknown]> = [
    ['http scheme', 'http://example.com/hook'],
    ['ftp scheme', 'ftp://example.com/hook'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['file scheme', 'file:///etc/passwd'],
    ['not a url', 'not a url'],
    ['empty string', ''],
    ['number', 42],
    ['undefined', undefined],
    ['null', null],
    ['credentials', 'https://user:pw@example.com/x'],
    ['username only', 'https://user@example.com/x'],
    ['localhost', 'https://localhost/x'],
    ['localhost with trailing dot', 'https://localhost./x'],
    ['subdomain of localhost', 'https://api.localhost/x'],
    ['uppercase LOCALHOST', 'https://LOCALHOST/x'],
    ['127.0.0.1', 'https://127.0.0.1/x'],
    ['127.x.x.x', 'https://127.10.20.30/x'],
    ['0.0.0.0', 'https://0.0.0.0/x'],
    ['10/8', 'https://10.0.0.5/x'],
    ['172.16/12 low edge', 'https://172.16.0.1/x'],
    ['172.16/12 high edge', 'https://172.31.255.254/x'],
    ['192.168/16', 'https://192.168.1.1/x'],
    ['link-local cloud metadata', 'https://169.254.169.254/latest/meta-data'],
    ['CGNAT 100.64/10', 'https://100.64.0.1/x'],
    ['IPv6 loopback', 'https://[::1]/x'],
    ['IPv6 unspecified', 'https://[::]/x'],
    ['IPv6 unique local fc00::/7', 'https://[fd12:3456:789a::1]/x'],
    ['IPv6 link-local fe80::/10', 'https://[fe80::1]/x'],
    ['IPv4-mapped loopback', 'https://[::ffff:127.0.0.1]/x'],
    ['IPv4-mapped private', 'https://[::ffff:10.0.0.1]/x'],
    ['IPv4-mapped metadata', 'https://[::ffff:169.254.169.254]/x'],
    ['IPv4-compatible loopback', 'https://[::127.0.0.1]/x'],
    ['NAT64 embedded private', 'https://[64:ff9b::10.0.0.1]/x'],
    // Disguised IPv4 forms: WHATWG URL parsing normalises them to 127.0.0.1.
    ['integer IPv4 for 127.0.0.1', 'https://2130706433/x'],
    ['hex IPv4 for 127.0.0.1', 'https://0x7f000001/x'],
    ['short IPv4 127.1', 'https://127.1/x'],
    ['octal IPv4 for 10.0.0.1', 'https://012.0.0.1/x'],
  ];
  for (const [label, input] of rejected) {
    test(label, () => {
      assert.deepEqual(validateWebhookUrl(input, STRICT), { ok: false });
    });
  }

  test('longer than 2048 characters', () => {
    const long = `https://example.com/${'a'.repeat(2048)}`;
    assert.deepEqual(validateWebhookUrl(long, STRICT), { ok: false });
  });
});

describe('validateWebhookUrl: allowInsecure (development flag)', () => {
  const accepted: Array<[string, string]> = [
    ['http://localhost:4000/hook', 'http://localhost:4000/hook'],
    ['http://127.0.0.1:4000/hook', 'http://127.0.0.1:4000/hook'],
    ['http://[::1]:4000/hook', 'http://[::1]:4000/hook'],
    ['https://localhost/hook', 'https://localhost/hook'],
    ['https://example.com/hook', 'https://example.com/hook'], // public https still fine
  ];
  for (const [input, expected] of accepted) {
    test(`accepts ${input}`, () => {
      assert.deepEqual(validateWebhookUrl(input, DEV), { ok: true, url: expected });
    });
  }

  const rejected: Array<[string, string]> = [
    ['http to a public host', 'http://example.com/hook'],
    ['private range over https', 'https://192.168.1.10/hook'],
    ['private range over http', 'http://10.0.0.5/hook'],
    ['cloud metadata', 'http://169.254.169.254/latest/meta-data'],
    ['credentials on loopback', 'http://user:pw@localhost:4000/hook'],
    ['ftp to loopback', 'ftp://localhost/hook'],
  ];
  for (const [label, input] of rejected) {
    test(`still rejects ${label}`, () => {
      assert.deepEqual(validateWebhookUrl(input, DEV), { ok: false });
    });
  }
});
