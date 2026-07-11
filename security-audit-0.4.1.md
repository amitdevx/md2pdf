# security-audit-0.4.1.md

## Threat Model
Primary trust boundaries tested: CLI input paths, markdown/HTML content, file:// and network resource handling in Playwright-driven rendering.

## Attack Surface
- CLI argument parsing (`src/cli/index.ts`)
- Browser launch and routing (`src/pdf/index.ts`)
- Markdown preprocessing and file URL rewriting (`src/core/index.ts`)
- Dependencies (npm audit findings)

## Security Findings
### S-001: Denial of Service via large markdown input
- Severity: High
- Reproduction: run huge markdown case from `/home/runner/work/md2pdf/md2pdf/audit-artifacts/data/input-output-render-results.tsv` (`input/huge`)
- Result: process terminated by signal 6 with V8 heap OOM.
- Evidence: `/home/runner/work/md2pdf/md2pdf/audit-artifacts/logs/huge.err`

### S-002: Dependency vulnerabilities in dev toolchain
- Severity: Mixed (moderate/high/critical per advisory)
- Reproduction: `npm audit --json`
- Evidence: `/home/runner/work/md2pdf/md2pdf/audit-artifacts/logs/npm-audit.json`

### S-003: Partial SSRF mitigation only
- Severity: Medium
- Observation: Route handler blocks localhost/metadata IP but allows other remote URLs; no full outbound allowlist.
- Evidence: `/home/runner/work/md2pdf/md2pdf/src/pdf/index.ts` lines 27-42.

## Severity Matrix
- High: S-001
- Medium: S-003
- Dependency/advisory driven: S-002

## Proof of Concept
- See corresponding logs in `audit-artifacts/logs/` and timing table entries in `audit-artifacts/data/input-output-render-results.tsv`.

## Exploitability
- S-001: straightforward with large crafted markdown.
- S-003: depends on attacker-controlled markdown/HTML resource URLs and runtime network reachability.

## Mitigations
- Enforce input-size limits and streaming/segmentation.
- Introduce strict network policy (deny-all by default, explicit allowlist).
- Upgrade vulnerable development dependencies.

## Recommendations
1. Add guardrails for memory/size.
2. Harden network/resource loading policy in renderer.
3. Patch vulnerable dependency chain.

## Dependency Security
- See `npm-audit.json` for package-level advisories.

## Supply Chain Review
- Partial only (npm audit and package metadata checks).
- Full provenance/signature review not executed in this session.

## Secure Coding Review
- Observed controls: local file scope checks and localhost/metadata blocking in route interception.
- Gaps: no comprehensive browser/network hardening policy and no explicit large-input anti-DoS controls.
