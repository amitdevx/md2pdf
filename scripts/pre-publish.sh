#!/usr/bin/env bash
# =============================================================================
# md2pdf Pre-Publish Gate Script
# =============================================================================
# Run this before EVERY version push. It will refuse to continue if anything
# fails. The exit code of this script is what CI checks.
#
# Usage:
#   bash scripts/pre-publish.sh              # full run
#   bash scripts/pre-publish.sh --skip-e2e   # skip live browser tests (CI only)
#   bash scripts/pre-publish.sh --fix        # auto-fix what can be fixed
#
# Exit codes:
#   0 = everything passed, safe to publish
#   1 = one or more gates failed, DO NOT publish
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

# ── State ────────────────────────────────────────────────────────────────────
FAILURES=()
WARNINGS=()
SKIP_E2E=false
AUTO_FIX=false
START_TIME=$(date +%s)

for arg in "$@"; do
  [[ "$arg" == "--skip-e2e" ]] && SKIP_E2E=true
  [[ "$arg" == "--fix" ]]      && AUTO_FIX=true
done

# ── Helpers ──────────────────────────────────────────────────────────────────
pass()  { echo -e "  ${GREEN}✔${RESET} $1"; }
fail()  { echo -e "  ${RED}✖${RESET} $1"; FAILURES+=("$1"); }
warn()  { echo -e "  ${YELLOW}⚠${RESET} $1"; WARNINGS+=("$1"); }
info()  { echo -e "  ${CYAN}i${RESET} $1"; }
section() { echo -e "\n${BOLD}[$1]${RESET}"; }

check_exit() {
  local label=$1; shift
  if "$@" > /tmp/ppg_out.txt 2>&1; then
    pass "$label"
    return 0
  else
    fail "$label"
    cat /tmp/ppg_out.txt | head -15
    return 1
  fi
}

# =============================================================================
# GATE 1 — REPO HYGIENE
# =============================================================================
section "GATE 1: Repo Hygiene"

# 1.1 No debug/scratch files in root
DEBUG_FILES=$(find . -maxdepth 1 -name "test*.js" -o -name "test*.cjs" \
  -o -name "fix-*.js" -o -name "scratch*.js" -o -name "debug*.js" \
  -o -name "tmp*.js" 2>/dev/null | grep -v node_modules || true)
if [[ -z "$DEBUG_FILES" ]]; then
  pass "No debug scripts in repo root"
else
  fail "Debug scripts found in root: $DEBUG_FILES"
  if [[ "$AUTO_FIX" == true ]]; then
    echo "$DEBUG_FILES" | xargs git rm --cached 2>/dev/null || true
    warn "Staged for removal — commit the change"
  fi
fi

# 1.2 .gitignore covers scratch patterns
GITIGNORE_PATTERNS=("test_*.js" "test_*.cjs" "fix-*.js" "scratch/" "*.local.ts")
for pat in "${GITIGNORE_PATTERNS[@]}"; do
  if grep -qF "$pat" .gitignore 2>/dev/null; then
    pass ".gitignore covers: $pat"
  else
    warn ".gitignore missing pattern: $pat"
    if [[ "$AUTO_FIX" == true ]]; then
      echo "$pat" >> .gitignore
    fi
  fi
done

# 1.3 No uncommitted changes to src/
DIRTY_SRC=$(git diff --name-only HEAD -- src/ 2>/dev/null || true)
if [[ -z "$DIRTY_SRC" ]]; then
  pass "src/ is clean (no uncommitted changes)"
else
  warn "Uncommitted src/ changes — are these intentional?"
  echo "    $DIRTY_SRC"
fi

# 1.4 package.json version matches CHANGELOG top entry
PKG_VERSION=$(node -e "console.log(require('./package.json').version)")
CHANGELOG_VERSION=$(grep -m1 "^## \[" CHANGELOG.md | grep -oP '\d+\.\d+\.\d+' || echo "NOT_FOUND")
if [[ "$PKG_VERSION" == "$CHANGELOG_VERSION" ]]; then
  pass "package.json ($PKG_VERSION) matches CHANGELOG ($CHANGELOG_VERSION)"
else
  fail "Version mismatch: package.json=$PKG_VERSION CHANGELOG=$CHANGELOG_VERSION"
fi

# 1.5 No merge conflict markers
CONFLICT=$(grep -rn "<<<<<<\|=======\|>>>>>>>" src/ --include="*.ts" 2>/dev/null || true)
if [[ -z "$CONFLICT" ]]; then
  pass "No merge conflict markers in src/"
else
  fail "Merge conflict markers found: $CONFLICT"
fi

# =============================================================================
# GATE 2 — STATIC ANALYSIS
# =============================================================================
section "GATE 2: Static Analysis"

# 2.1 Lint — zero errors allowed (warnings OK)
if npm run lint > /tmp/lint_out.txt 2>&1; then
  LINT_WARN=$(grep -c "warning" /tmp/lint_out.txt 2>/dev/null || true)
  pass "ESLint: 0 errors (${LINT_WARN:-0} warnings)"
else
  LINT_ERRS=$(grep " error " /tmp/lint_out.txt | wc -l | tr -d ' ')
  fail "ESLint: ${LINT_ERRS} error(s)"
  grep " error " /tmp/lint_out.txt | head -10
fi


# 2.2 TypeScript — zero errors
check_exit "TypeScript: 0 errors" npm run typecheck

# 2.3 No raw 'any' in new code (warn only)
ANY_COUNT=$(grep -rn ": any\b\|as any\b" src/ --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
if [[ "$ANY_COUNT" -lt 20 ]]; then
  pass "TypeScript 'any' usage: $ANY_COUNT (within limit)"
else
  warn "TypeScript 'any' usage: $ANY_COUNT — consider reducing"
fi

# =============================================================================
# GATE 3 — BUILD INTEGRITY
# =============================================================================
section "GATE 3: Build Integrity"

# 3.1 Clean build succeeds
check_exit "Clean build succeeds" bash -c "npm run clean && npm run build"

# 3.2 dist/ was created
if [[ -d "dist" && "$(ls dist/*.js 2>/dev/null | wc -l)" -gt 0 ]]; then
  pass "dist/ directory created with JS files"
else
  fail "dist/ missing or empty after build"
fi

# 3.3 mermaid.min.js is present in assets/ (the recurring publish regression)
if [[ -f "assets/mermaid.min.js" ]]; then
  MERMAID_SIZE=$(du -h assets/mermaid.min.js | cut -f1)
  pass "assets/mermaid.min.js present ($MERMAID_SIZE)"
else
  fail "assets/mermaid.min.js MISSING — build did not copy it (BUG: B07 regression)"
fi

# 3.4 All theme CSS files copied to themes/
MISSING_THEMES=()
for theme in default github obsidian-light obsidian-dark dracula nord academic; do
  if [[ ! -f "themes/$theme/theme.css" ]]; then
    MISSING_THEMES+=("$theme")
  fi
done
if [[ ${#MISSING_THEMES[@]} -eq 0 ]]; then
  pass "All 7 theme CSS files present in themes/"
else
  fail "Missing theme CSS: ${MISSING_THEMES[*]}"
fi

# 3.5 package.json 'files' array includes all shipped dirs
FILES_ARRAY=$(node -e "console.log(require('./package.json').files.join(','))")
for required in "dist" "themes" "assets"; do
  if echo "$FILES_ARRAY" | grep -q "$required"; then
    pass "package.json 'files' includes: $required"
  else
    fail "package.json 'files' missing: $required"
  fi
done

# 3.6 playwright-core version matches what init will install
PW_VERSION=$(node -e "console.log(require('./package.json').dependencies['playwright-core'])")
info "playwright-core version: $PW_VERSION"
# Warn if it's a loose range (^ or ~) since this caused B24
if echo "$PW_VERSION" | grep -qP "^\^|^~"; then
  warn "playwright-core uses loose semver ($PW_VERSION) — version mismatch risk (BUG: B24)"
fi

# =============================================================================
# GATE 4 — UNIT TESTS
# =============================================================================
section "GATE 4: Unit Tests"

check_exit "Vitest suite: all tests pass" npm run test

# =============================================================================
# GATE 5 — EXIT CODE CONTRACT
# =============================================================================
section "GATE 5: Exit Code Contract"
# This is the gate that would have caught B01, B12, B14, B15, B20, B21, B26
# Tests against the BUILT package in dist/ using Node directly

# Set up browser for tests
CHROME_FOR_TEST=""
if [[ -n "${CHROME_PATH:-}" ]] && [[ -f "$CHROME_PATH" ]]; then
  CHROME_FOR_TEST="$CHROME_PATH"
elif command -v google-chrome &>/dev/null; then
  CHROME_FOR_TEST="$(which google-chrome)"
elif command -v chromium-browser &>/dev/null; then
  CHROME_FOR_TEST="$(which chromium-browser)"
elif command -v chromium &>/dev/null; then
  CHROME_FOR_TEST="$(which chromium)"
fi

TMPDIR_TEST=$(mktemp -d)
trap 'rm -rf "$TMPDIR_TEST"' EXIT

# Create test fixtures
echo "# test" > "$TMPDIR_TEST/basic.md"
cat > "$TMPDIR_TEST/publish-false.md" << 'EOF2'
---
publish: false
---
# skip
EOF2
python3 -c "open('$TMPDIR_TEST/big.md','w').write('# x\n\n'+'x '*3000000)" 2>/dev/null || \
  dd if=/dev/urandom bs=1024 count=6000 2>/dev/null | base64 > "$TMPDIR_TEST/big.md"

check_exit_code() {
  local label=$1
  local expected=$2
  shift 2
  local actual=0
  env CHROME_PATH="${CHROME_FOR_TEST}" "$@" > /tmp/ce_out.txt 2>&1 || actual=$?
  if [[ "$actual" -eq "$expected" ]]; then
    pass "exit code $expected: $label"
  else
    fail "exit code WRONG ($actual≠$expected): $label"
    cat /tmp/ce_out.txt | sed 's/^/    /'
  fi
}

# Use locally built CLI
CLI="node --experimental-vm-modules dist/cli/index.js"
# Or if packed locally, prefer the actual binary
if [[ -f "$(npm bin)/md2pdf" ]]; then
  CLI="$(npm bin)/md2pdf"
elif command -v md2pdf &>/dev/null; then
  # Use globally installed version (matches what users run)
  CLI="md2pdf"
else
  CLI="node dist/cli/index.js"
fi

# USAGE ERRORS → must exit 1
check_exit_code "no args"             1  $CLI
check_exit_code "missing file"        1  $CLI /nonexistent.md
check_exit_code "directory input"     1  $CLI /tmp
check_exit_code "txt extension"       1  $CLI /tmp/test.txt
check_exit_code "same file"           1  $CLI "$TMPDIR_TEST/basic.md" -o "$TMPDIR_TEST/basic.md"
check_exit_code "bad paper"           1  $CLI "$TMPDIR_TEST/basic.md" --paper A3
check_exit_code "bad margin"          1  $CLI "$TMPDIR_TEST/basic.md" --margin 20
check_exit_code "bad mermaid-theme"   1  $CLI "$TMPDIR_TEST/basic.md" --mermaid-theme notvalid
check_exit_code "output is dir"       1  $CLI "$TMPDIR_TEST/basic.md" -o /tmp
check_exit_code "output dir slash"    1  $CLI "$TMPDIR_TEST/basic.md" -o /tmp/
check_exit_code "browser not found"   1  $CLI "$TMPDIR_TEST/basic.md" --browser /fake/browser
check_exit_code "path traversal /etc" 1  $CLI "$TMPDIR_TEST/basic.md" -o /etc/out.pdf
check_exit_code "path traversal /root" 1 $CLI "$TMPDIR_TEST/basic.md" -o /root/out.pdf

# RUNTIME ERRORS → must exit 2
check_exit_code "file too large"      2  $CLI "$TMPDIR_TEST/big.md"
check_exit_code "invalid theme"       2  $CLI "$TMPDIR_TEST/basic.md" --theme notexists

# SKIPS → must exit 0
check_exit_code "publish false"       0  $CLI "$TMPDIR_TEST/publish-false.md"

# UTILITY → must exit 0
check_exit_code "--clear-cache"       0  $CLI --clear-cache

# CHMOD 000 (run only as non-root to get real result)
if [[ "$(id -u)" -ne 0 ]]; then
  echo "# locked" > "$TMPDIR_TEST/locked.md" && chmod 000 "$TMPDIR_TEST/locked.md"
  check_exit_code "chmod 000"         1  $CLI "$TMPDIR_TEST/locked.md"
  chmod 644 "$TMPDIR_TEST/locked.md"
else
  warn "Running as root — chmod 000 test skipped (root bypasses file permissions)"
fi

# =============================================================================
# GATE 6 — JSON-ERRORS CONTRACT
# =============================================================================
section "GATE 6: --json-errors Contract"
# Tests that every error path produces valid JSON on stdout (not stderr)
# Would have caught B02, B11, B16, B19

check_json() {
  local label=$1
  local expect_success=$2
  local expect_code=$3
  shift 3

  CHROME_PATH="${CHROME_FOR_TEST}" "$@" --json-errors > /tmp/je_gate.txt 2>/tmp/je_gate_err.txt || true

  local stderr_size
  stderr_size=$(wc -c < /tmp/je_gate_err.txt)
  if [[ "$stderr_size" -gt 0 ]]; then
    fail "json-errors output on STDERR (should be stdout): $label"
    return
  fi

  python3 - "$label" "$expect_success" "$expect_code" << 'PYEOF'
import json, sys
label, expect_success, expect_code = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    raw = open('/tmp/je_gate.txt').read()
    d = json.loads(raw)
    success = str(d.get('success', '?')).lower()
    
    # Check success field
    if expect_success != 'any' and success != expect_success:
        print(f"  FAIL success={success} expected={expect_success}: {label}")
        sys.exit(1)
    
    # Check error code exists when expected
    if expect_code != 'none' and expect_code != 'any':
        results = d.get('results', [])
        err = d.get('error', {})
        got_codes = []
        for r in results:
            e = r.get('error', {})
            c = e.get('code', '—') if isinstance(e, dict) else r.get('code', '—')
            got_codes.append(c)
        if not got_codes:
            got_codes = [err.get('code', '—') if err else '—']
        
        if expect_code not in got_codes and expect_code not in str(d):
            print(f"  FAIL code={got_codes} expected={expect_code}: {label}")
            sys.exit(1)
    
    print(f"  PASS: {label}")
except json.JSONDecodeError as e:
    print(f"  FAIL (invalid JSON): {label} — {e}")
    print(f"  Raw: {open('/tmp/je_gate.txt').read()[:200]}")
    sys.exit(1)
PYEOF
  if [[ $? -ne 0 ]]; then FAILURES+=("json-errors: $label"); fi
}

check_json "missing file"       "false"  "ERR_VALIDATION"         $CLI /nonexistent.md
check_json "directory input"    "false"  "ERR_VALIDATION"         $CLI /tmp
check_json "wrong extension"    "false"  "ERR_VALIDATION"         $CLI /tmp/test.txt
check_json "output is dir"      "false"  "ERR_INVALID_INPUT"      $CLI "$TMPDIR_TEST/basic.md" -o /tmp
check_json "output dir slash"   "false"  "ERR_INVALID_INPUT"      $CLI "$TMPDIR_TEST/basic.md" -o /tmp/
check_json "path traversal"     "false"  "ERR_PATH_TRAVERSAL"     $CLI "$TMPDIR_TEST/basic.md" -o /etc/out.pdf
check_json "path traversal warm" "false" "ERR_PATH_TRAVERSAL"     $CLI "$TMPDIR_TEST/basic.md" -o /etc/out.pdf
check_json "browser not found"  "false"  "ERR_INVALID_BROWSER"    $CLI "$TMPDIR_TEST/basic.md" --browser /fake
check_json "file too large"     "false"  "ERR_FILE_TOO_LARGE"     $CLI "$TMPDIR_TEST/big.md"
check_json "publish false"      "true"   "none"                   $CLI "$TMPDIR_TEST/publish-false.md"
check_json "no args"            "false"  "ERR_NO_INPUT"           $CLI

# =============================================================================
# GATE 7 — CACHE ORDERING (the BUG-20/BUG-21 regression test)
# =============================================================================
section "GATE 7: Cache Ordering Invariants"

if [[ -n "$CHROME_FOR_TEST" ]]; then
  CACHE_TMP=$(mktemp -d)

  # Warm the cache
  CHROME_PATH="$CHROME_FOR_TEST" $CLI "$TMPDIR_TEST/basic.md" \
    -o "$CACHE_TMP/warm.pdf" > /dev/null 2>&1 || true

  # Path traversal must fail even when file is cached (BUG-20 regression)
  CHROME_PATH="$CHROME_FOR_TEST" $CLI "$TMPDIR_TEST/basic.md" \
    -o /etc/out.pdf > /dev/null 2>&1 || EXIT_TRAVERSAL=$?
  if [[ "${EXIT_TRAVERSAL:-0}" -ne 0 ]]; then
    pass "Path traversal blocked on warm cache (BUG-20 regression)"
  else
    fail "Path traversal NOT blocked on warm cache — BUG-20 regression"
  fi

  # Invalid browser must fail even when file is cached (BUG-21 regression)
  CHROME_PATH="$CHROME_FOR_TEST" $CLI "$TMPDIR_TEST/basic.md" \
    --browser /nonexistent/browser -o "$CACHE_TMP/browser-test.pdf" > /dev/null 2>&1 || EXIT_BROWSER=$?
  if [[ "${EXIT_BROWSER:-0}" -ne 0 ]]; then
    pass "Invalid browser rejected on warm cache (BUG-21 regression)"
  else
    fail "Invalid browser NOT rejected on warm cache — BUG-21 regression"
  fi

  rm -rf "$CACHE_TMP"
else
  warn "No browser found — Gate 7 cache ordering tests skipped"
fi

# =============================================================================
# GATE 8 — NPM PACKAGE INTEGRITY
# =============================================================================
section "GATE 8: npm Package Integrity"

# 8.1 Dry-run pack and inspect contents
npm pack --dry-run 2>&1 | grep "npm notice" > /tmp/pack_contents.txt || true

# Check required files are included
for required_file in "dist/cli/index.js" "assets/mermaid.min.js" "README.md" "LICENSE" "CHANGELOG.md"; do
  if grep -q "$required_file" /tmp/pack_contents.txt; then
    pass "Package includes: $required_file"
  else
    fail "Package MISSING: $required_file"
  fi
done

# Check no dev/debug files are included
for banned in "test_" "fix-cache" "scratch" ".env" "tsconfig.json" "vitest.config"; do
  if grep -q "$banned" /tmp/pack_contents.txt; then
    fail "Package contains banned file pattern: $banned"
    grep "$banned" /tmp/pack_contents.txt
  fi
done
pass "No banned file patterns in published package"

# 8.2 npm audit — zero high/critical
if npm audit --omit=dev > /tmp/audit_out.txt 2>&1; then
  pass "npm audit: 0 vulnerabilities"
else
  HIGH_CRIT=$(grep -ciP "high|critical" /tmp/audit_out.txt 2>/dev/null || echo 0)
  if [[ "$HIGH_CRIT" -gt 0 ]]; then
    fail "npm audit: high/critical vulnerabilities found"
    grep -iP "high|critical" /tmp/audit_out.txt | head -5
  else
    warn "npm audit: low/moderate vulnerabilities (non-blocking)"
    tail -3 /tmp/audit_out.txt
  fi
fi

# 8.3 Check package version is not already on npm
PKG_VERSION=$(node -e "console.log(require('./package.json').version)")
EXISTING=$(npm view "@amitdevx/md2pdf@$PKG_VERSION" version 2>/dev/null || echo "NOT_FOUND")
if [[ "$EXISTING" == "NOT_FOUND" ]]; then
  pass "v$PKG_VERSION not yet published to npm (ready to publish)"
else
  fail "v$PKG_VERSION ALREADY EXISTS on npm — bump the version"
fi

# =============================================================================
# FINAL REPORT
# =============================================================================
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo -e "${BOLD}════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Pre-Publish Gate Report (v$PKG_VERSION)${RESET}"
echo -e "${BOLD}════════════════════════════════════════${RESET}"
echo -e "  Duration: ${ELAPSED}s"
echo ""

if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  echo -e "  ${YELLOW}Warnings (${#WARNINGS[@]}):${RESET}"
  for w in "${WARNINGS[@]}"; do
    echo -e "    ${YELLOW}⚠${RESET} $w"
  done
  echo ""
fi

if [[ ${#FAILURES[@]} -eq 0 ]]; then
  echo -e "  ${GREEN}${BOLD}All gates passed. Safe to publish.${RESET}"
  echo ""
  echo -e "  Run: ${CYAN}npm publish --access public${RESET}"
  echo ""
  exit 0
else
  echo -e "  ${RED}${BOLD}FAILED — ${#FAILURES[@]} gate(s) blocked publish:${RESET}"
  for f in "${FAILURES[@]}"; do
    echo -e "    ${RED}✖${RESET} $f"
  done
  echo ""
  echo -e "  ${RED}DO NOT PUBLISH until all failures are resolved.${RESET}"
  echo ""
  exit 1
fi
