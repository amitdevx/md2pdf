# Security in md2pdf

The `md2pdf` project takes security seriously, especially given its capabilities to run headless browsers and interact with the local filesystem.

## Sandboxing and File Access
By default, the internal Playwright browser runs in a restricted sandbox.
File access via local URLs (e.g., `file://`) is strictly limited to:
- The current working directory (`process.cwd()`).
- The directory containing the input Markdown file.
- The explicitly configured Obsidian vault root (if provided).

Any markdown images or external assets attempting to traverse outside of these directories (e.g., `![hack](/etc/passwd)`) will be blocked and replaced with a broken image icon.

## Output Path Restrictions
The CLI enforces strict validation on output paths. Output generation will fail if the destination targets restricted system folders (such as `/etc`, `/tmp`, `/var/run`, or Windows equivalents like `C:\Windows`). This prevents malicious scripts from overwriting critical system files.

## Obsidian Plugin Security
When processing Obsidian embeds (`![[file.md]]`), the plugin restricts file resolution to the boundaries of the configured vault root or the directory of the current file. Attempts to use directory traversal to read arbitrary system files will be rejected.

## Browser Discovery
When specifying a custom browser executable path via the `CHROME_PATH` environment variable, the executable path is verified safely without risking shell command injection.

## Reporting Vulnerabilities
If you discover a security issue, please report it via the GitHub Security tab on the project repository.
