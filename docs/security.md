# Security in md2pdf

The `md2pdf` project takes security seriously, especially given its capabilities to run headless browsers and interact with the local filesystem.

## Sandboxing and File Access
By default, the internal Playwright browser runs in a restricted sandbox.
File access via local URLs (e.g., `file://`) is strictly limited to:
- The current working directory (`process.cwd()`).
- The directory containing the input Markdown file.
- The explicitly configured Obsidian vault root (if provided).
- The system temporary directory (used for caching).

**Base64 Image Injection:**
To eliminate Chromium security risks and event-loop deadlocks, all local images and remote HTTP/HTTPS images are now pre-fetched and converted to Base64 data URIs securely within the Node.js context before being passed to Chromium. Chromium is restricted from making any outbound requests.

**SSRF Protection:**
Server-Side Request Forgery (SSRF) bypasses are prevented by a background DNS resolver that actively blocks HTTP requests to cloud metadata endpoints (e.g. AWS `169.254.x.x`), local loopbacks (`localhost`, `127.0.0.1`), and private IP ranges before they are fetched.

**Raw HTML Sanitization:**
Raw HTML nodes in Markdown are passed through `rehype-sanitize` to allow basic inline styling while aggressively stripping dangerous tags like `<script>`, `<iframe>`, `<object>`, and `<embed>`. Any markdown images or external assets attempting to traverse outside of the allowed directories (e.g., `![hack](/etc/passwd)`) will be strictly blocked.

## Output Path Restrictions
The CLI enforces strict validation on output paths. Output generation will fail if the destination targets restricted system folders (such as `/etc`, `/tmp`, `/var/run`, or Windows equivalents like `C:\Windows`). This prevents malicious scripts from overwriting critical system files.

## Obsidian Plugin Security
When processing Obsidian embeds (`![[file.md]]`), the plugin restricts file resolution to the boundaries of the configured vault root or the directory of the current file. Attempts to use directory traversal to read arbitrary system files will be rejected.

## Browser Discovery
When specifying a custom browser executable path via the `CHROME_PATH` environment variable, the executable path is verified safely without risking shell command injection.

## Threat Model

`md2pdf` is designed to safely process untrusted markdown inputs even in multi-tenant servers, automated build pipelines, and containerized CI environments.

### Core Assumptions
- The markdown source and frontmatter content may be supplied by an untrusted third party.
- The environment may run with local secrets, environment variables, or private intranet services (e.g., internal APIs, Kubernetes cluster IP, AWS IMDS `169.254.169.254`).
- Attackers may attempt:
  1. **Server-Side Request Forgery (SSRF):** Accessing internal services or cloud metadata via image tags (`<img src="...">`, `![alt](url)`).
  2. **Data Exfiltration:** Exfiltrating local tokens or secrets through CSS `@import` or `url(...)` declarations.
  3. **Local File Disclosure:** Reading `/etc/passwd` or private workspace files via local path traversal.
  4. **Denial of Service (DoS):** Triggering resource exhaustion via recursive redirects, massive file downloads, or deeply nested markdown structures.

### Defense-in-Depth Guarantees

1. **Zero Chromium Network Requests:**
   Chromium runs in a sandboxed context where all outbound HTTP and HTTPS network requests are unconditionally aborted by `page.route('**/*')`. Only `data:`, `blob:`, and validated sandboxed `file:` URIs are served to Chromium.

2. **Node.js Pre-Fetch URL Guard:**
   Remote images are pre-fetched directly in Node.js before HTML is rendered:
   - Target hostnames are resolved via DNS to obtain physical IP addresses.
   - Resolved IPs are validated against strict `net.BlockList` rules rejecting loopback (`127.0.0.0/8`, `::1`), private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local/cloud metadata (`169.254.0.0/16`, `fe80::/10`), CGNAT (`100.64.0.0/10`), ULA (`fc00::/7`), multicast (`224.0.0.0/4`, `ff00::/8`), unspecified addresses, and IPv4-mapped IPv6 ranges.
   - Redirects are processed manually up to 3 hops, re-verifying every destination IP against the URL guard.
   - Only responses with an `image/*` MIME type and within file size limits are converted to Base64 data URIs.
   - In private intranet or staging environments requiring internal asset retrieval, users may explicitly set `MD2PDF_ALLOW_PRIVATE_NETWORK=1`.

3. **Complete Offline Execution:**
   When the `--offline` flag is passed, all remote network fetches are bypassed immediately without performing any DNS lookups or HTTP requests.

4. **CSS Sanitization & Injection Prevention:**
   Raw HTML attributes are sanitized via rehype plugins that strip `url()`, `@import`, and `expression()` from inline styles, preventing CSS-based exfiltration.

5. **Filesystem Sandboxing:**
   Local file access for images and embeds is strictly restricted to allowed directories (the source document directory, the configured Obsidian vault root, and system temporary cache folders). Traversals outside the sandbox trigger security warnings and fail closed.

## Reporting Vulnerabilities
If you discover a security issue, please report it via the GitHub Security tab on the project repository.
