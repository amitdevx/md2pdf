# scripts/

Developer utility scripts. Not shipped with the npm package.

---

## Files

| File | Purpose | Added In |
|------|---------|----------|
| `golden-render.ts` | Render all golden fixtures → `tests/output/` | v0.1.0 |
| `golden-diff.ts` | Pixel-diff output vs snapshots, generate report | v0.1.0 |
| `golden-approve.ts` | Copy `tests/output/` → `tests/snapshots/` (with confirm) | v0.1.0 |
| `generate-100-pages.ts` | Generate `tests/fixtures/100-pages.md` | v0.9.0 |
| `generate-vault.ts` | Generate `tests/benchmarks/vault/` (200-file mock) | v0.8.0 |

---

## npm Script Mappings

```json
"golden:render":  "tsx scripts/golden-render.ts",
"golden:diff":    "tsx scripts/golden-diff.ts",
"golden:approve": "tsx scripts/golden-approve.ts",
"golden:check":   "tsx scripts/golden-render.ts && tsx scripts/golden-diff.ts --ci",
"bench":          "tsx scripts/bench.ts"
```

---

## Notes

- All scripts use `tsx` for zero-config TypeScript execution
- Scripts write to `tests/output/` and `tests/diff/` — both gitignored
- Scripts read approved state from `tests/snapshots/` — committed to git
- Never run `golden:approve` in CI — it must be a deliberate local action
