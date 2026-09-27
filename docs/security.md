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

## Reporting Vulnerabilities
If you discover a security issue, please report it via the GitHub Security tab on the project repository.
