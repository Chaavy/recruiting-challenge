import { isIP } from 'node:net';

export interface WebhookUrlOptions {
  /**
   * Development only (env WEBHOOK_ALLOW_INSECURE_URLS=1). Allows loopback
   * hosts, over http or https, so a receiver can run on the same machine.
   * Private ranges, link-local and credentials stay rejected even then.
   */
  allowInsecure: boolean;
}

export type WebhookUrlValidation = { ok: true; url: string } | { ok: false };

const MAX_URL_LENGTH = 2048;

type HostClass = 'public' | 'loopback' | 'blocked';

/**
 * Validates a merchant-supplied webhook URL. Pure: no DNS, no network.
 *
 * We POST to this URL from our own server, so an unchecked value is an SSRF
 * vector (cloud metadata at 169.254.169.254, admin ports on localhost, hosts
 * on the private network). Rules:
 * - https only; http is accepted only for a loopback host with allowInsecure;
 * - no credentials in the URL;
 * - no loopback, private, link-local, CGNAT or unspecified addresses, in IPv4
 *   or IPv6, including IPv4 embedded in IPv6 (mapped, compatible, NAT64).
 *
 * The checks run on the hostname AFTER WHATWG URL parsing, which normalises
 * disguised IPv4 forms (`2130706433`, `0x7f.1`, `127.1`) to dotted decimal.
 *
 * Not covered (BACKLOG PM-16): a public hostname that resolves to an internal
 * address. That needs DNS resolution at subscribe time and at send time.
 */
export function validateWebhookUrl(raw: unknown, opts: WebhookUrlOptions): WebhookUrlValidation {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_URL_LENGTH) return { ok: false };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false };
  if (url.username !== '' || url.password !== '') return { ok: false };

  const hostClass = classifyHost(url.hostname);
  if (hostClass === 'blocked') return { ok: false };
  if (hostClass === 'loopback' && !opts.allowInsecure) return { ok: false };
  // http is only ever acceptable for a local development receiver.
  if (url.protocol === 'http:' && !(opts.allowInsecure && hostClass === 'loopback')) return { ok: false };

  return { ok: true, url: url.href };
}

function classifyHost(hostname: string): HostClass {
  let host = hostname.toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (host === '') return 'blocked';

  if (host === 'localhost' || host.endsWith('.localhost')) return 'loopback';

  const version = isIP(host);
  if (version === 4) return classifyIpv4(host.split('.').map(Number));
  if (version === 6) return classifyIpv6(host);
  return 'public';
}

function classifyIpv4(octets: number[]): HostClass {
  const a = octets[0] ?? 0;
  const b = octets[1] ?? 0;
  if (a === 127) return 'loopback';
  if (a === 0) return 'blocked'; // 0.0.0.0/8 "this network"
  if (a === 10) return 'blocked'; // private
  if (a === 172 && b >= 16 && b <= 31) return 'blocked'; // private
  if (a === 192 && b === 168) return 'blocked'; // private
  if (a === 169 && b === 254) return 'blocked'; // link-local, cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return 'blocked'; // CGNAT 100.64.0.0/10
  return 'public';
}

function classifyIpv6(host: string): HostClass {
  const groups = expandIpv6(host);
  if (!groups) return 'blocked';
  const allZero = (from: number, to: number): boolean => groups.slice(from, to).every((g) => g === 0);
  const embeddedIpv4 = (): number[] => {
    const hi = groups[6] ?? 0;
    const lo = groups[7] ?? 0;
    return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff];
  };

  if (allZero(0, 7) && groups[7] === 1) return 'loopback'; // ::1
  if (allZero(0, 8)) return 'blocked'; // ::
  const first = groups[0] ?? 0;
  if ((first & 0xfe00) === 0xfc00) return 'blocked'; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return 'blocked'; // fe80::/10 link-local
  if (allZero(0, 5) && groups[5] === 0xffff) return classifyIpv4(embeddedIpv4()); // ::ffff:a.b.c.d mapped
  if (allZero(0, 6)) return classifyIpv4(embeddedIpv4()); // ::a.b.c.d compatible (deprecated)
  if (first === 0x64 && groups[1] === 0xff9b && allZero(2, 6)) return classifyIpv4(embeddedIpv4()); // 64:ff9b::/96 NAT64
  return 'public';
}

/** Expands an IPv6 literal (already validated by net.isIP) into its 8 groups. */
function expandIpv6(host: string): number[] | null {
  let text = host;
  const zone = text.indexOf('%');
  if (zone !== -1) text = text.slice(0, zone);

  // A dotted IPv4 tail counts as the last two groups.
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (tail.includes('.')) {
    const o = tail.split('.').map(Number);
    if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    const hi = (((o[0] ?? 0) << 8) | (o[1] ?? 0)).toString(16);
    const lo = (((o[2] ?? 0) << 8) | (o[3] ?? 0)).toString(16);
    text = `${text.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string): number[] => (part === '' ? [] : part.split(':').map((g) => parseInt(g, 16)));
  const head = parse(halves[0] ?? '');
  const rest = halves.length === 2 ? parse(halves[1] ?? '') : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...new Array<number>(halves.length === 2 ? missing : 0).fill(0), ...rest];
  if (groups.length !== 8 || groups.some((g) => Number.isNaN(g) || g < 0 || g > 0xffff)) return null;
  return groups;
}
