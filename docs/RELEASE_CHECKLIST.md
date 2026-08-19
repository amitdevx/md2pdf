# md2pdf Release Checklist

Copy this into a GitHub Issue or your notes for every release.
Every item must be checked before `npm publish`.

---

## Phase 1 — Before You Write Code

- [ ] **Open an Issue** titled `v0.X.Y — <what changes>` and list what will change
- [ ] **Identify which bugs from the audit history are being fixed** (see `AUDIT_HISTORY.md`)
- [ ] **Check if you are adding a new error path** → if yes, it needs exit code + JSON test
- [ ] **Check if you are touching `convert.ts` cache logic** → if yes, run Gate 7 manually
- [ ] **Check if you are adding new files to `dist/` or `assets/`** → if yes, update `package.json` files array

---

## Phase 2 — During Development

- [ ] No scratch/test/debug files in the repo root (`.gitignore` pattern: `test_*.js`)
- [ ] Every new `Md2PdfError` throw has a named `Md2PdfErrorCode` entry
- [ ] Every new error path sets `process.exitCode` (not just `process.exit()`) to avoid async race
- [ ] Every new error path is tested in `--json-errors` mode with valid JSON output
- [ ] Any validation that should block conversion is placed **before** `checkCache()` calls
- [ ] If touching `playwright-core` version, verify `md2pdf init` installs the matching Chromium revision

---

## Phase 3 — Pre-Push (Run the Script)

```bash
bash scripts/pre-publish.sh
```

This runs 8 automated gates. All must pass.

| Gate | What it checks | Bug history it prevents |
|------|---------------|------------------------|
| 1: Repo Hygiene | Debug files, version match, conflicts | B23, RP01 |
| 2: Static Analysis | Lint errors, TypeScript errors | all lint regressions |
| 3: Build Integrity | mermaid.min.js, theme CSS, files array | B07, RP02 |
| 4: Unit Tests | All 47 vitest tests | general regressions |
| 5: Exit Code Contract | All 17 exit codes correct | B01, B12, B14, B15, B20, B21, B26 |
| 6: JSON-errors Contract | All paths valid JSON on stdout | B02, B11, B16 |
| 7: Cache Ordering | Traversal/browser blocked on warm cache | B20, B21 |
| 8: Package Integrity | npm pack contents, audit, version unique | B07, B24, RP02 |

If any gate fails: **fix it first, do not publish**.

---

## Phase 4 — Manual Spot Checks (5 minutes)

These cannot be automated without a live browser but take under 5 minutes:

- [ ] `md2pdf init` completes without error on a clean environment
- [ ] `md2pdf doctor` shows the correct browser path
- [ ] `md2pdf basic.md` produces a real PDF (open it and check it renders)
- [ ] `md2pdf mermaid.md` produces a PDF with a visible diagram
- [ ] `md2pdf --list-themes` lists all 7 themes
- [ ] `md2pdf --version` shows the new version number

---

## Phase 5 — CHANGELOG and Version Bump

- [ ] `CHANGELOG.md` top entry version matches `package.json`
- [ ] CHANGELOG entry lists every fixed bug by symptom (not just "fixed exit code")
- [ ] CHANGELOG entry notes any **breaking changes** (new required flags, removed flags, changed JSON schema)
- [ ] Version bump follows semver:
  - Patch (`0.8.X`) → bug fixes, no new flags
  - Minor (`0.X.0`) → new flags or features, backward compatible
  - Major (`X.0.0`) → breaking changes to CLI or API

---

## Phase 6 — Publish

```bash
# Final check
npm run build
bash scripts/pre-publish.sh

# Publish
npm publish --access public

# Tag the release
git tag v$(node -e "console.log(require('./package.json').version)")
git push origin --tags

# Create GitHub Release from the tag
# Paste the CHANGELOG entry into the release notes
```

---

## Phase 7 — Post-Publish Verification (2 minutes)

- [ ] `npm view @amitdevx/md2pdf version` shows the new version
- [ ] `npm install -g @amitdevx/md2pdf@<new-version>` works in a clean environment
- [ ] `md2pdf --version` shows the new version after global install
- [ ] The npm page at `npmjs.com/package/@amitdevx/md2pdf` shows the updated README

---

## Recurring Bug Checklist (check these on every release that touches convert.ts)

These bugs have appeared more than once. Actively verify they are not reintroduced:

| ID | What to verify | Where to check |
|----|---------------|----------------|
| RP01 | No debug files in repo root | `find . -maxdepth 1 -name "test*.js"` |
| RP02 | `assets/mermaid.min.js` exists after build | `ls assets/mermaid.min.js` |
| RP03 | chmod 000 exits non-zero (as non-root) | Gate 5 |
| RP04 | Path traversal blocked cold AND warm | Gate 7 |
| RP04 | Invalid --browser blocked on cache hit | Gate 7 |
| RP05 | New error paths have `code` field in JSON | Gate 6 |
| RP06 | `playwright-core` version matches what `init` installs | Gate 3 warning |
| RP07 | Batch failures exit 1 | Gate 5 | 
