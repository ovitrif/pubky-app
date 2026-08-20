const BLOCKED_HOSTS = new Set(['metadata.google.internal', 'metadata.goog', 'metadata.azure.com', 'metadata.internal']);

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLoopbackCommerceHostname(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.replace(/^\[|\]$/g, '').toLocaleLowerCase('en-US'));
}

export function isSafeCommerceServiceUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.username || parsed.password) return false;
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLocaleLowerCase('en-US');
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.internal')) return false;
  if (isBlockedIpAddress(hostname)) return false;
  if (isLoopbackCommerceHostname(hostname)) return true;
  if (parsed.protocol !== 'https:') return false;
  return hostname.includes('.') && !hostname.endsWith('.local');
}

function isBlockedIpAddress(hostname: string): boolean {
  if (hostname === '::1' || hostname.startsWith('fe80:') || hostname.startsWith('fc') || hostname.startsWith('fd')) {
    return hostname !== '::1';
  }
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const octets = ipv4.slice(1).map(Number);
  if (octets.some((octet) => octet > 255)) return false;
  const [a, b] = octets;
  if (a === 10 || a === 0 || a === 127) return a !== 127;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}
