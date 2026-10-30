# Error Code Reference

`md2pdf` emits structured error codes across both human-readable terminal output and automated JSON mode (`--json-errors`).

## Exit Code Contract

| Exit Code | Classification | Description |
|---|---|---|
| `0` | Success | The document was converted, or successfully skipped (e.g. `publish: false`). |
| `1` | Usage Error | Invalid command-line flags, missing input files, bad YAML frontmatter, or invalid options. |
| `2` | Environment Error | Missing browser binary, browser launch failure, permission denied, file too large, conversion timeout, or complex document. |
| `3` | Internal Bug | An unexpected unhandled internal error occurred within the engine. |

## Error Taxonomy

The table below catalogs every error code defined in `Md2PdfErrorCode`:

| Error Code | Exit Code | Description | Recommended Action |
|---|---|---|---|
| `ERR_BROWSER_MISSING` | 2 | Chromium browser binary is not installed or detected. | Run `md2pdf init` or `npx playwright install chromium`. |
| `ERR_BROWSER_LAUNCH_FAILED` | 2 | Browser executable exists but failed to launch. | Check system dependencies, permissions, or run `md2pdf doctor`. |
| `ERR_INVALID_BROWSER` | 1 | The path passed to `--browser` does not exist. | Provide a valid path to an existing browser executable. |
| `ERR_MISSING_DEPENDENCIES` | 2 | Required operating system libraries for Chromium are missing. | Install required system packages via package manager. |
| `ERR_SANDBOX` | 2 | Playwright sandbox initialization failed. | Run in an unprivileged container or configure sandbox parameters. |
| `ERR_PERMISSION_DENIED` | 2 | Insufficient filesystem permissions to read input or write output. | Check file permissions (`chmod 644 <input>`). |
| `ERR_OUT_OF_MEMORY` | 2 | Process exceeded memory limits during conversion. | Split document or increase Node.js memory (`--max-old-space-size`). |
| `ERR_UNSUPPORTED_ARCH` | 2 | Operating system or CPU architecture is unsupported by bundled browser. | Use an external browser with `CHROME_PATH` or `--browser`. |
| `ERR_NETWORK_TIMEOUT` | 2 | Conversion exceeded the deadline (default 120s). | Increase timeout via `MD2PDF_TIMEOUT_MS` or check for hanging assets. |
| `ERR_NO_INPUT` | 1 | No markdown input files were specified or stdin was empty. | Provide input markdown files or pipe valid markdown to stdin. |
| `ERR_INVALID_ARGUMENT` | 1 | An invalid option or CLI flag value was supplied. | Run `md2pdf --help` to view valid option arguments. |
| `ERR_OUTPUT_DIR_MISSING` | 1 | Output directory does not exist and could not be created. | Ensure the target directory path is valid and writable. |
| `ERR_INVALID_MARKDOWN` | 1 | The markdown content contains unparseable or fatal AST syntax. | Fix formatting errors in the source markdown. |
| `ERR_DOCUMENT_TOO_COMPLEX` | 2 | Markdown nesting depth exceeds supported engine limit (200 levels). | Flatten deeply nested blockquotes or lists. |
| `ERR_CONFIG_ERROR` | 1 | Invalid frontmatter YAML or malformed configuration file. | Validate YAML frontmatter syntax using a linter. |
| `ERR_PUBLISH_SKIPPED` | 0 | File was skipped because frontmatter contains `publish: false`. | Set `publish: true` or remove the key to convert. |
| `ERR_FILE_TOO_LARGE` | 2 | Input file exceeds the maximum size limit of 30MB. | Split the document into smaller files. |
| `ERR_INVALID_INPUT` | 1 | Input file does not exist or has an unsupported file extension. | Specify an existing `.md` or `.markdown` file. |
| `ERR_PATH_TRAVERSAL` | 1 | Output path attempts to write to a protected system directory. | Choose an output destination within your user workspace. |
| `ERR_VAULT_ROOT_NOT_FOUND` | 1 | The directory passed to `--vault-root` does not exist. | Ensure the vault directory path exists on disk. |
| `ERR_INVALID_THEME` | 2 | The specified theme could not be found or loaded. | Run `md2pdf list-themes` to view available themes. |
| `ERR_PLUGIN_FAILURE` | 2 | A custom plugin threw an unhandled exception during execution. | Check custom plugin hook implementations. |
| `ERR_FONT_MISSING` | 2 | A required custom typography font could not be located. | Ensure custom font files are installed or embedded. |
| `ERR_REMOTE_ASSET_FAILED` | 2 | A critical remote resource could not be fetched. | Check internet connectivity or run with `--offline`. |
| `ERR_UNKNOWN` | 3 | An unexpected internal error occurred. | Run with `--verbose` or `--debug` and report on GitHub. |

## JSON Error Output Schema

When invoking `md2pdf` with `--json-errors`, errors conform to the following JSON schema (`schemaVersion: 1`):

```json
{
  "schemaVersion": 1,
  "success": false,
  "results": [
    {
      "input": "document.md",
      "output": null,
      "error": "Error message description",
      "code": "ERR_INVALID_INPUT"
    }
  ],
  "error": {
    "code": "ERR_INVALID_INPUT",
    "title": "File Not Found",
    "reason": "Error message description"
  }
}
```
