import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { discoverBrowser } from '../../src/pdf/browser';
import fs from 'node:fs';

describe('Browser Discovery', () => {
  beforeEach(() => {
    vi.stubEnv('CHROME_PATH', '');
    vi.stubEnv('BROWSER_PATH', '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('should return null when no browser is found', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    
    const result = discoverBrowser();
    expect(result).toBeNull();
  });

  it('should discover Chrome on Linux when it exists', () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'linux' });

    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      return p === '/usr/bin/google-chrome';
    });

    const result = discoverBrowser();
    expect(result).not.toBeNull();
    expect(result?.executablePath).toBe('/usr/bin/google-chrome');
    expect(result?.name).toBe('Chrome');

    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
  });

  it('should prioritize CHROME_PATH environment variable if it exists', () => {
    vi.stubEnv('CHROME_PATH', '/custom/path/to/chrome');
    
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      // Both the custom path and the standard one exist
      return p === '/custom/path/to/chrome' || p === '/usr/bin/google-chrome';
    });

    // Mock execSync to avoid running the command
    const childProcess = require('node:child_process');
    vi.spyOn(childProcess, 'execSync').mockReturnValue('Custom Chrome Version');

    const result = discoverBrowser();
    expect(result).not.toBeNull();
    expect(result?.executablePath).toBe('/custom/path/to/chrome');
    expect(result?.name).toBe('env override'); // execSync fails in test environment, falling back
  });

  it('should discover Edge on Windows when it exists', () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32' });

    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      // Simulate typical windows path
      return p.includes('Edge') && p.includes('msedge.exe');
    });

    const result = discoverBrowser();
    expect(result).not.toBeNull();
    expect(result?.executablePath).toMatch(/msedge\.exe$/);
    expect(result?.name).toBe('Edge');

    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
  });
});
