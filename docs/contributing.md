# Contributing to md2pdf

Thank you for your interest in contributing to `md2pdf`. 

## Philosophy

`md2pdf` is designed to be the reference implementation for high-quality Markdown-to-PDF generation. We value **modular architecture, code clarity, and test coverage** above rushing features. 

The project should look and feel as if it were written and maintained by an experienced open-source team.

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/amitdevx/md2pdf.git
   cd md2pdf
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Install Playwright browsers:**
   ```bash
   npx playwright install chromium
   ```

4. **Verify the build and tests:**
   ```bash
   npm run build
   npm test
   ```

## Coding Standards

- **No Emojis:** Do not use emojis in source code, comments, log messages, CLI output, or git commits.
- **Comments:** Write comments only to explain *why* something exists, not *what* the code does. Reserve comments for complex algorithms or architectural decisions.
- **Naming:** Use descriptive, unabbreviated names (e.g., `resolveWikiLinks()` instead of `rwl()`).
- **Functions & Files:** Keep functions small (under 100 lines) with a single responsibility. Keep files focused.
- **Error Handling:** Never silently ignore errors. Provide meaningful context about what failed and how to resolve it.
- **Logging:** Support normal output, verbose mode, and debug mode without decorative ASCII art.
- **Formatting:** ESLint and Prettier are strictly enforced.

## Branch Naming

Use descriptive branch names with a type prefix:
- `feature/add-mermaid-support`
- `fix/image-resolution`
- `docs/update-readme`
- `refactor/parser-pipeline`

## Commit Conventions

We strictly follow Conventional Commits:
- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation only changes
- `refactor:` A code change that neither fixes a bug nor adds a feature
- `test:` Adding missing tests or correcting existing tests
- `build:` Changes that affect the build system or external dependencies
- `ci:` Changes to our CI configuration files and scripts
- `perf:` A code change that improves performance
- `chore:` Other changes that don't modify src or test files

Example:
`feat: implement native mermaid diagram parsing`

## Testing

Every new feature or bugfix must be accompanied by tests.
- We use `vitest` for our testing framework.
- Run tests via `npm test`.

## Pull Requests

1. Ensure your code complies with our linting and formatting rules (`npm run lint:fix`).
2. Verify all tests pass (`npm test`).
3. Ensure the project builds without TypeScript errors (`npm run typecheck`).
4. Keep PRs focused on a single issue or feature.
5. Provide a clear description of the changes in the PR.
