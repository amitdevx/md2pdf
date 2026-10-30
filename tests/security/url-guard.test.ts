import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateRemoteUrl, isIpBlocked } from '../../src/security/url-guard.js';

describe('S1: URL Guard & IP Blocklist', () => {
  const originalEnv = process.env.MD2PDF_ALLOW_PRIVATE_NETWORK;

  beforeEach(() => {
    delete process.env.MD2PDF_ALLOW_PRIVATE_NETWORK;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MD2PDF_ALLOW_PRIVATE_NETWORK = originalEnv;
    } else {
      delete process.env.MD2PDF_ALLOW_PRIVATE_NETWORK;
    }
  });

  const testTable: Array<[string, boolean]> = [
    ['10.0.0.1', false],
    ['172.31.255.255', false],
    ['192.168.1.1', false],
    ['169.254.169.254', false],
    ['100.64.0.1', false],
    ['127.0.0.2', false],
    ['[::1]', false],
    ['[fd00::1]', false],
    ['[::ffff:10.0.0.1]', false],
    ['93.184.216.34', true] // Example public IP (example.com)
  ];

  for (const [target, expectedValid] of testTable) {
    it(`should ${expectedValid ? 'allow' : 'block'} target: ${target}`, async () => {
      const url = `http://${target}/image.png`;
      const result = await validateRemoteUrl(url);
      expect(result.valid).toBe(expectedValid);
      if (!expectedValid) {
        expect(result.reason).toBeDefined();
      }
    });
  }

  it('rejects unsupported protocols (ftp, file, data, gopher, javascript)', async () => {
    const protocols = ['ftp://example.com/test.png', 'file:///etc/passwd', 'data:image/png;base64,123', 'gopher://example.com', 'javascript:alert(1)'];
    for (const url of protocols) {
      const result = await validateRemoteUrl(url);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Unsupported protocol');
    }
  });

  it('fails closed on malformed URLs or non-existent domains', async () => {
    const invalidUrls = ['not-a-valid-url', 'http://', 'https://this-domain-definitely-does-not-exist-xyz123456.test/img.png'];
    for (const url of invalidUrls) {
      const result = await validateRemoteUrl(url);
      expect(result.valid).toBe(false);
    }
  });

  it('allows private network access when MD2PDF_ALLOW_PRIVATE_NETWORK=1', async () => {
    process.env.MD2PDF_ALLOW_PRIVATE_NETWORK = '1';
    const result = await validateRemoteUrl('http://127.0.0.1:8080/test.png');
    expect(result.valid).toBe(true);
  });

  it('allows private network access when options.allowPrivate is true', async () => {
    const result = await validateRemoteUrl('http://10.0.0.1/test.png', { allowPrivate: true });
    expect(result.valid).toBe(true);
  });

  it('checks direct isIpBlocked helper correctly', () => {
    expect(isIpBlocked('127.0.0.1')).toBe(true);
    expect(isIpBlocked('10.255.0.1')).toBe(true);
    expect(isIpBlocked('172.16.0.1')).toBe(true);
    expect(isIpBlocked('192.168.0.1')).toBe(true);
    expect(isIpBlocked('169.254.1.1')).toBe(true);
    expect(isIpBlocked('::1')).toBe(true);
    expect(isIpBlocked('8.8.8.8')).toBe(false);
    expect(isIpBlocked('1.1.1.1')).toBe(false);
  });
});
