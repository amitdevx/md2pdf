# md2pdf Security & Bug Audit Report (2026-07-07)

- Repository under audit: `/home/runner/work/md2pdf/md2pdf`
- Package tested: `@amitdevx/md2pdf@0.2.4`
- Test environments:
  - Global CLI install (`npm install -g @amitdevx/md2pdf@0.2.4`)
  - Production-like JS usage (`import { convert } from '@amitdevx/md2pdf'`)
- Raw data directory: `/tmp/md2pdf-prod-audit`

## 1) Simplified findings

## Critical/High findings

1. **HIGH: SSRF/network egress to private IP is possible**
   - `http://127.0.0.1` was blocked.
   - `http://10.1.0.109:8899/track.png` was requested successfully during conversion (server log captured GET).
   - Risk: if untrusted markdown is processed in production, it can trigger requests to internal network services.

2. **MEDIUM: Browser sandbox disabled**
   - Chromium launched with `--no-sandbox --disable-setuid-sandbox`.
   - Risk increases when processing attacker-controlled markdown/HTML.

3. **MEDIUM: Raw HTML enabled in markdown parser**
   - Parser uses dangerous HTML passthrough.
   - JavaScript execution was blocked in final PDF flow, but HTML-based external resource loads still occur.

## Positive controls

- `publish: false` frontmatter correctly blocks conversion (CLI exit code `2`, API throws error).
- Invalid YAML frontmatter correctly errors out.
- `<script>` payload did **not** execute in output PDF content (`XSS_RAN` absent in extracted text).
- Production dependency audit for installed package reported `0` vulnerabilities.

## 2) Test matrix (simplified)

| Test | Mode | Result |
|---|---|---|
| Global package install + doctor | Global CLI | PASS |
| `publish: false` handling | Global CLI + JS API | PASS |
| bad frontmatter handling | Global CLI + JS API | PASS |
| `<script>` payload execution check | Global CLI + JS API | PASS (not executed) |
| localhost request block (`127.0.0.1`) | Global CLI + JS API | PASS (blocked) |
| private IP request block (`10.1.0.109`) | Global CLI + JS API | **FAIL** (request observed) |
| `npm audit` on production install | Installed package | PASS (0 vulns) |

## 3) Raw command outputs

### 3.1 Global install and health

```text
added 264 packages in 20s
0.2.4

⚕️  md2pdf System Health Check
  ✔ Node.js (v24.17.0)
  ✔ md2pdf (0.2.4)
  ✔ Playwright (^1.40.0)
  ✔ Chromium exists at /home/runner/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome
  ✔ Browser launch
  ✔ HTML render
  ✔ PDF generate
  ✔ Filesystem write
Everything is OK! Your system is ready to generate PDFs.
```

### 3.2 Security raw JSON

Source file: `/tmp/md2pdf-prod-audit/raw-security-tests.json`

```json
[
  {
    "mode": "global-cli",
    "test": "sec-script",
    "ms": 5461.55,
    "exit": 0,
    "pdf_exists": true
  },
  {
    "mode": "global-cli",
    "test": "sec-publish-false",
    "ms": 607.57,
    "exit": 2,
    "pdf_exists": false
  },
  {
    "mode": "global-cli",
    "test": "sec-bad-yaml",
    "ms": 614.72,
    "exit": 2,
    "pdf_exists": false
  },
  {
    "mode": "global-cli",
    "test": "sec-localhost",
    "ms": 5519.51,
    "exit": 0,
    "pdf_exists": true
  },
  {
    "mode": "global-cli",
    "test": "sec-internal-ip",
    "ms": 5501.0,
    "exit": 0,
    "pdf_exists": true
  },
  {
    "mode": "global-cli",
    "test": "server-log",
    "log": "10.1.0.109 - - [07/Jul/2026 07:17:40] \"GET /track.png HTTP/1.1\" 404 -"
  },
  {
    "mode": "js-api",
    "test": "sec-script",
    "ms": 4854.12,
    "exit": 0,
    "pdfExists": true
  },
  {
    "mode": "js-api",
    "test": "sec-publish-false",
    "ms": 2.72,
    "exit": 1,
    "error": "The file has `publish: false` in its frontmatter.",
    "pdfExists": false
  },
  {
    "mode": "js-api",
    "test": "sec-bad-yaml",
    "ms": 0.79,
    "exit": 1,
    "pdfExists": false
  }
]
```

### 3.3 API network probe raw JSON

Source file: `/tmp/md2pdf-prod-audit/raw-api-network-summary.json`

```json
{
  "ip": "10.1.0.109",
  "api_runs": [
    { "test": "api-net-localhost", "exit": 0, "ms": 4840.53, "pdfExists": true },
    { "test": "api-net-internal", "exit": 0, "ms": 666.22, "pdfExists": true }
  ],
  "server_log": "10.1.0.109 - - [07/Jul/2026 07:18:07] \"GET /track.png HTTP/1.1\" 404 -"
}
```

### 3.4 XSS text extraction check raw

```text
sec-script.pdf XSS_RAN in text? False | text= 'Script Test\nVisible text.'
api-sec-script.pdf XSS_RAN in text? False | text= 'Script Test\nVisible text.'
```

### 3.5 Production dependency audit raw

Source file: `/tmp/md2pdf-prod-audit/raw-npm-audit-prod.json`

```json
{
  "metadata": {
    "vulnerabilities": {
      "info": 0,
      "low": 0,
      "moderate": 0,
      "high": 0,
      "critical": 0,
      "total": 0
    },
    "dependencies": {
      "prod": 264,
      "dev": 0,
      "optional": 2,
      "total": 265
    }
  }
}
```

## 4) Code locations linked to findings

- `/home/runner/work/md2pdf/md2pdf/src/pdf/index.ts`
  - network blocking only for localhost/metadata IP, and file URL directory prefix check
- `/home/runner/work/md2pdf/md2pdf/src/parser/index.ts`
  - dangerous HTML passthrough enabled
- `/home/runner/work/md2pdf/md2pdf/src/core/index.ts`
  - conversion flow and browser launch path

## 5) Bottom-line risk call

- For trusted markdown inputs: usable with current behavior.
- For untrusted/3rd-party markdown in production: **not safe enough** due to internal-network request possibility.
