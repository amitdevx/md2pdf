import { Md2PdfError, Md2PdfErrorCode } from './index.js';


export interface Recommendation {
  summary: string;
  commands: string[];
  docs?: string;
}



function getPlatformRecommendation(contextPlatform?: string): string {
  return 'md2pdf init';
}

export function getRecommendation(error: Md2PdfError): Recommendation | null {
  const platform = error.context.platform || process.platform;
  
  switch (error.code) {
    case Md2PdfErrorCode.ERR_BROWSER_MISSING:
      return {
        summary: 'Playwright needs to download the Chromium binary to generate PDFs. Please run `md2pdf init` to install it.',
        commands: ['npx md2pdf init'],
        docs: 'https://playwright.dev/docs/browsers'
      };
      
    case Md2PdfErrorCode.ERR_MISSING_DEPENDENCIES: {
      const libs = error.context.missingLibraries;
      const libString = libs && libs.length > 0 ? ` (e.g., ${libs[0]})` : '';
      return {
        summary: `Your system is missing shared libraries${libString} required to run Chromium.`,
        commands: [getPlatformRecommendation(platform)],
      };
    }

    case Md2PdfErrorCode.ERR_SANDBOX:
      return {
        summary: 'Chromium sandboxing is unavailable. If you are running inside Docker or a restricted CI environment, you must disable the sandbox.',
        commands: [], // No shell command, this requires code changes if used programmatically
        docs: 'https://playwright.dev/docs/troubleshooting#chromium-sandboxing-issues'
      };

    case Md2PdfErrorCode.ERR_PERMISSION_DENIED:
      return {
        summary: 'The browser executable lacks execution permissions, or the user running md2pdf does not have access.',
        commands: [
          error.context.browserPath ? `chmod +x ${error.context.browserPath}` : 'chmod -R 755 ~/.cache/ms-playwright/'
        ]
      };

    case Md2PdfErrorCode.ERR_OUT_OF_MEMORY:
      return {
        summary: 'Chromium failed to start because the system ran out of memory.',
        commands: [], // Generally requires system-level fixes
      };
      
    case Md2PdfErrorCode.ERR_UNSUPPORTED_ARCH:
      return {
        summary: 'The downloaded browser binary is not compatible with your CPU architecture (e.g., trying to run x86 binaries on ARM without translation).',
        commands: [
          'npx playwright install chromium'
        ]
      };

    case Md2PdfErrorCode.ERR_CONFIG_ERROR:
      return {
        summary: 'A configuration setting is preventing the conversion.',
        commands: [
          'Remove or set `publish: true` in your frontmatter block at the top of the markdown file.'
        ]
      };

    default:
      return null;
  }
}
