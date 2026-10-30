import net from 'node:net';
import dns from 'node:dns/promises';

// Dedicated IPv4 blocklist
const ipv4BlockList = new net.BlockList();
ipv4BlockList.addSubnet('0.0.0.0', 8, 'ipv4');       // Current network / unspecified (RFC 1122)
ipv4BlockList.addSubnet('10.0.0.0', 8, 'ipv4');      // Private network (RFC 1918)
ipv4BlockList.addSubnet('100.64.0.0', 10, 'ipv4');   // Carrier-grade NAT (RFC 6598)
ipv4BlockList.addSubnet('127.0.0.0', 8, 'ipv4');     // Loopback (RFC 1122)
ipv4BlockList.addSubnet('169.254.0.0', 16, 'ipv4');  // Link-local (RFC 3927)
ipv4BlockList.addSubnet('172.16.0.0', 12, 'ipv4');   // Private network (RFC 1918)
ipv4BlockList.addSubnet('192.0.0.0', 24, 'ipv4');    // IETF Protocol Assignments
ipv4BlockList.addSubnet('192.0.2.0', 24, 'ipv4');    // TEST-NET-1 (RFC 5737)
ipv4BlockList.addSubnet('192.88.99.0', 24, 'ipv4');  // 6to4 relay anycast (RFC 7526)
ipv4BlockList.addSubnet('192.168.0.0', 16, 'ipv4');  // Private network (RFC 1918)
ipv4BlockList.addSubnet('198.18.0.0', 15, 'ipv4');   // Network benchmark tests (RFC 2544)
ipv4BlockList.addSubnet('198.51.100.0', 24, 'ipv4'); // TEST-NET-2 (RFC 5737)
ipv4BlockList.addSubnet('203.0.113.0', 24, 'ipv4');  // TEST-NET-3 (RFC 5737)
ipv4BlockList.addSubnet('224.0.0.0', 4, 'ipv4');     // Multicast (RFC 5771)
ipv4BlockList.addSubnet('240.0.0.0', 4, 'ipv4');     // Reserved / future use (RFC 1112)
ipv4BlockList.addAddress('255.255.255.255', 'ipv4'); // Broadcast

// Dedicated IPv6 blocklist
const ipv6BlockList = new net.BlockList();
ipv6BlockList.addAddress('::', 'ipv6');              // Unspecified
ipv6BlockList.addAddress('::1', 'ipv6');             // Loopback
ipv6BlockList.addSubnet('::ffff:0:0', 96, 'ipv6');   // IPv4-mapped IPv6 addresses
ipv6BlockList.addSubnet('64:ff9b::', 96, 'ipv6');    // IPv4/IPv6 translation (RFC 6052)
ipv6BlockList.addSubnet('100::', 64, 'ipv6');        // Discard-only (RFC 6666)
ipv6BlockList.addSubnet('2001:db8::', 32, 'ipv6');   // Documentation (RFC 3849)
ipv6BlockList.addSubnet('2002::', 16, 'ipv6');       // 6to4
ipv6BlockList.addSubnet('fc00::', 7, 'ipv6');        // Unique Local Address (ULA, RFC 4193)
ipv6BlockList.addSubnet('fe80::', 10, 'ipv6');       // Link-local unicast (RFC 4291)
ipv6BlockList.addSubnet('ff00::', 8, 'ipv6');        // Multicast (RFC 4291)

/**
 * Checks if a single IP address (v4 or v6) belongs to a restricted/private range.
 * Fails closed if the address is not a valid IP.
 */
export function isIpBlocked(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    return ipv4BlockList.check(ip, 'ipv4');
  }
  if (family === 6) {
    return ipv6BlockList.check(ip, 'ipv6');
  }
  // Not a recognized IP -> fail closed
  return true;
}

export interface UrlGuardResult {
  valid: boolean;
  reason?: string;
  resolvedIp?: string;
}

/**
 * Validates a URL for SSRF protection:
 * 1. Must use http: or https: scheme.
 * 2. Hostname/IP must not point to loopback, private, link-local, CGNAT, ULA, multicast, etc.
 * 3. DNS resolves domain names and validates all resolved IP addresses.
 * 4. Fails closed on any resolution failure or malformed input.
 * 5. Can be bypassed via MD2PDF_ALLOW_PRIVATE_NETWORK=1 env var or allowPrivate option.
 */
export async function validateRemoteUrl(
  urlStr: string,
  options: { allowPrivate?: boolean } = {}
): Promise<UrlGuardResult> {
  const allowPrivate = options.allowPrivate ?? (process.env.MD2PDF_ALLOW_PRIVATE_NETWORK === '1');

  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }

  // Scheme validation: strictly http or https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: `Unsupported protocol '${parsed.protocol}'. Only http: and https: are allowed.` };
  }

  let hostname = parsed.hostname;
  if (!hostname) {
    return { valid: false, reason: 'URL missing hostname' };
  }

  // Strip brackets from IPv6 hostnames like [::1] or [::ffff:10.0.0.1]
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }

  if (allowPrivate) {
    return { valid: true };
  }

  // Direct IP address check
  const directFamily = net.isIP(hostname);
  if (directFamily !== 0) {
    if (isIpBlocked(hostname)) {
      return { valid: false, reason: 'Blocked private or restricted network address', resolvedIp: hostname };
    }
    return { valid: true, resolvedIp: hostname };
  }

  // Domain name -> DNS resolution
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { valid: false, reason: 'DNS resolution returned no addresses' };
    }

    for (const addr of addresses) {
      if (isIpBlocked(addr.address)) {
        return {
          valid: false,
          reason: `Resolved to blocked private network address (${addr.address})`,
          resolvedIp: addr.address
        };
      }
    }

    return { valid: true, resolvedIp: addresses[0].address };
  } catch (err: any) {
    // Fail closed on DNS lookup errors
    return { valid: false, reason: `DNS resolution failed: ${err.message}` };
  }
}

export interface SafeImageResult {
  success: boolean;
  dataUri?: string;
  warning?: string;
}

/**
 * Safely pre-fetches a remote image with strict security protections:
 * - Validates every URL hop against SSRF/private network IP blocklist.
 * - Handles redirects manually (redirect: 'manual') with re-validation up to maxHops (3).
 * - Verifies Content-Type starts with 'image/'.
 * - Enforces maximum size limits (default 10MB or maxAttachmentSizeMb).
 * - Rejects immediately in offline mode.
 */
export async function fetchSafeRemoteImage(
  initialUrl: string,
  options: {
    offline?: boolean;
    maxBytes?: number;
    timeoutMs?: number;
    allowPrivate?: boolean;
  } = {}
): Promise<SafeImageResult> {
  if (options.offline) {
    return {
      success: false,
      warning: `Skipped remote image (offline mode): ${initialUrl}`
    };
  }

  const maxHops = 3;
  let currentUrl = initialUrl;
  const maxBytes = options.maxBytes ?? (10 * 1024 * 1024);
  const timeoutMs = options.timeoutMs ?? 5000;

  for (let hop = 0; hop <= maxHops; hop++) {
    // 1. SSRF validation for the target hop
    const guard = await validateRemoteUrl(currentUrl, { allowPrivate: options.allowPrivate });
    if (!guard.valid) {
      return {
        success: false,
        warning: `Skipped remote image (blocked: private network address): ${currentUrl}`
      };
    }

    // 2. Fetch with manual redirect and timeout
    let res: Response;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      res = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'md2pdf-bot/1.0 (+https://github.com/amitdevx/md2pdf)'
        }
      });
    } catch (err: any) {
      clearTimeout(timer);
      return {
        success: false,
        warning: `Failed to load remote image: ${currentUrl} (${err.message})`
      };
    } finally {
      clearTimeout(timer);
    }

    // 3. Handle 3xx redirects
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        return {
          success: false,
          warning: `Failed to load remote image: ${currentUrl} (Redirect missing location header)`
        };
      }
      if (hop === maxHops) {
        return {
          success: false,
          warning: `Skipped remote image (too many redirects): ${initialUrl}`
        };
      }
      try {
        currentUrl = new URL(location, currentUrl).href;
      } catch {
        return {
          success: false,
          warning: `Failed to load remote image: Invalid redirect location '${location}'`
        };
      }
      continue;
    }

    if (!res.ok) {
      return {
        success: false,
        warning: `Failed to load remote image: ${currentUrl} (HTTP ${res.status})`
      };
    }

    // 4. Content-Type check (must be an image)
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const mimeType = contentType.split(';')[0].trim();
    if (!mimeType.startsWith('image/')) {
      return {
        success: false,
        warning: `Skipped remote image (invalid content-type '${contentType}'): ${currentUrl}`
      };
    }

    // 5. Size cap check (Content-Length header)
    const contentLengthHeader = res.headers.get('content-length');
    if (contentLengthHeader) {
      const contentLength = parseInt(contentLengthHeader, 10);
      if (!isNaN(contentLength) && contentLength > maxBytes) {
        return {
          success: false,
          warning: `Skipped remote image (size ${contentLength} bytes exceeds limit ${maxBytes} bytes): ${currentUrl}`
        };
      }
    }

    // 6. Read buffer with size check
    try {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > maxBytes) {
        return {
          success: false,
          warning: `Skipped remote image (size ${buf.length} bytes exceeds limit ${maxBytes} bytes): ${currentUrl}`
        };
      }

      const dataUri = `data:${mimeType};base64,${buf.toString('base64')}`;
      return {
        success: true,
        dataUri
      };
    } catch (err: any) {
      return {
        success: false,
        warning: `Failed to read remote image: ${currentUrl} (${err.message})`
      };
    }
  }

  return {
    success: false,
    warning: `Skipped remote image (too many redirects): ${initialUrl}`
  };
}
