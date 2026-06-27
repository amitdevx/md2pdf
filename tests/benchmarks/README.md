# tests/benchmarks/ — Performance Benchmarks

Performance benchmark suite for `@amitdevx/md2pdf`. Added in **v0.8.0**.

---

## Files

| File | Purpose | Target |
|------|---------|--------|
| `single-file.md` | ~5,000-word document, no diagrams | < 1s cold render |
| `single-file-diagrams.md` | 10 Mermaid diagrams | < 5s |
| `large-file.md` | ~50,000 words (generated) | < 10s |
| `mermaid-50.md` | 50 varied Mermaid diagrams | < 45s |
| `vault/` | 200-file mock vault (generated) | < 60s |
| `generate-vault.ts` | Script to regenerate the mock vault | — |

---

## Running Benchmarks

```sh
npm run bench               # all benchmarks → timing table
npm run bench:profile       # with --inspect for CPU profiling
```

Output format:
```
Benchmark Results
─────────────────────────────────────────────────────
  single-file.md          0.82s   ✔ (target: <1s)
  single-file-diagrams.md 4.1s    ✔ (target: <5s)
  mermaid-50.md           38s     ✔ (target: <45s)
  vault/ (200 files)      52s     ✔ (target: <60s)
─────────────────────────────────────────────────────
  All benchmarks passed.
```

CI fails if any benchmark exceeds 2× its target time.
