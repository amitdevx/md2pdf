# md2pdf Performance, Pings, and Limits Report (2026-07-07)

- Repository context: `/home/runner/work/md2pdf/md2pdf`
- Package tested: `@amitdevx/md2pdf@0.2.4`
- Benchmark workspace: `/tmp/md2pdf-prod-audit`
- Modes benchmarked:
  1. Global CLI (`md2pdf ...`)
  2. JS API (`convert({...})`) as production website/backend usage

## 1) Simplified performance summary

## Dataset

- `small.md` -> 1 page
- `scale-10.md` -> 4 pages
- `scale-50.md` -> 16 pages
- `scale-100.md` -> 31 pages
- `scale-200.md` -> 61 pages
- 3 runs per case per mode

## Global CLI (simplified)

| Case | Pages | Min ms | Avg ms | Max ms | Avg ms/page |
|---|---:|---:|---:|---:|---:|
| small | 1 | 5424.16 | 5442.20 | 5460.09 | 5442.20 |
| scale-10 | 4 | 5495.97 | 5550.24 | 5591.79 | 1387.56 |
| scale-50 | 16 | 5481.43 | 5538.16 | 5606.37 | 346.13 |
| scale-100 | 31 | 5618.90 | 5629.05 | 5648.05 | 181.58 |
| scale-200 | 61 | 5680.10 | 5770.35 | 5876.95 | 94.60 |

## JS API (simplified)

| Case | Pages | Min ms | Avg ms | Max ms | Avg ms/page |
|---|---:|---:|---:|---:|---:|
| small | 1 | 640.93 | 2029.71* | 4805.27 | 2029.71 |
| scale-10 | 4 | 648.87 | 658.49 | 665.13 | 164.62 |
| scale-50 | 16 | 690.23 | 701.83 | 711.83 | 43.86 |
| scale-100 | 31 | 739.26 | 753.54 | 769.16 | 24.31 |
| scale-200 | 61 | 832.81 | 845.84 | 869.68 | 13.87 |

`*` includes first cold run.
- JS API cold start (small run1): **4805.27 ms**
- JS API warm average (small run2+run3): **641.92 ms**

## Key interpretation

- CLI has ~5.4s baseline cost per call (process + startup + render pipeline), so short docs are expensive per page.
- JS API in long-running process is much faster after first warm-up.
- At 61 pages, generation stayed stable (no failure observed).

## 2) Pings/network behavior summary

| Probe | Global CLI | JS API |
|---|---|---|
| `http://127.0.0.1:8899/track.png` | No server hit observed | No server hit observed |
| `http://10.1.0.109:8899/track.png` | Server received GET | Server received GET |

Conclusion: loopback is blocked; private-network IP was still reachable.

## 3) Practical limits observed in this run

- **Largest tested output:** 61 pages (`scale-200.md`), successful in both modes.
- **Hard max page limit:** not enforced by package in these tests (no explicit cap triggered).
- **Stability:** all benchmark conversions exited successfully.
- **Performance trend:** fixed startup dominates runtime, so ms/page decreases as document length grows.

## 4) Raw benchmark data (full)

Sources:
- `/tmp/md2pdf-prod-audit/raw-cli-bench.json`
- `/tmp/md2pdf-prod-audit/raw-api-bench.json`
- `/tmp/md2pdf-prod-audit/summary-bench.json`

### 4.1 Raw CLI benchmark JSON

```json
[
  {"case":"small","run":1,"ms":5442.36,"exit":0,"pages":1},
  {"case":"small","run":2,"ms":5460.09,"exit":0,"pages":1},
  {"case":"small","run":3,"ms":5424.16,"exit":0,"pages":1},
  {"case":"scale-10","run":1,"ms":5495.97,"exit":0,"pages":4},
  {"case":"scale-10","run":2,"ms":5591.79,"exit":0,"pages":4},
  {"case":"scale-10","run":3,"ms":5562.96,"exit":0,"pages":4},
  {"case":"scale-50","run":1,"ms":5481.43,"exit":0,"pages":16},
  {"case":"scale-50","run":2,"ms":5526.68,"exit":0,"pages":16},
  {"case":"scale-50","run":3,"ms":5606.37,"exit":0,"pages":16},
  {"case":"scale-100","run":1,"ms":5618.90,"exit":0,"pages":31},
  {"case":"scale-100","run":2,"ms":5648.05,"exit":0,"pages":31},
  {"case":"scale-100","run":3,"ms":5620.21,"exit":0,"pages":31},
  {"case":"scale-200","run":1,"ms":5753.99,"exit":0,"pages":61},
  {"case":"scale-200","run":2,"ms":5876.95,"exit":0,"pages":61},
  {"case":"scale-200","run":3,"ms":5680.10,"exit":0,"pages":61}
]
```

### 4.2 Raw JS API benchmark JSON

```json
[
  {"case":"small","run":1,"ms":4805.27,"exit":0,"pages":1,"renderTimeMs":4805},
  {"case":"small","run":2,"ms":640.93,"exit":0,"pages":1,"renderTimeMs":641},
  {"case":"small","run":3,"ms":642.92,"exit":0,"pages":1,"renderTimeMs":643},
  {"case":"scale-10","run":1,"ms":665.13,"exit":0,"pages":4,"renderTimeMs":665},
  {"case":"scale-10","run":2,"ms":661.46,"exit":0,"pages":4,"renderTimeMs":661},
  {"case":"scale-10","run":3,"ms":648.87,"exit":0,"pages":4,"renderTimeMs":648},
  {"case":"scale-50","run":1,"ms":690.23,"exit":0,"pages":16,"renderTimeMs":691},
  {"case":"scale-50","run":2,"ms":711.83,"exit":0,"pages":16,"renderTimeMs":711},
  {"case":"scale-50","run":3,"ms":703.42,"exit":0,"pages":16,"renderTimeMs":703},
  {"case":"scale-100","run":1,"ms":739.26,"exit":0,"pages":31,"renderTimeMs":739},
  {"case":"scale-100","run":2,"ms":752.20,"exit":0,"pages":31,"renderTimeMs":752},
  {"case":"scale-100","run":3,"ms":769.16,"exit":0,"pages":31,"renderTimeMs":770},
  {"case":"scale-200","run":1,"ms":869.68,"exit":0,"pages":61,"renderTimeMs":869},
  {"case":"scale-200","run":2,"ms":835.04,"exit":0,"pages":61,"renderTimeMs":835},
  {"case":"scale-200","run":3,"ms":832.81,"exit":0,"pages":61,"renderTimeMs":833}
]
```

### 4.3 Raw ping/network JSON

```json
{
  "ip": "10.1.0.109",
  "api_runs": [
    {"test":"api-net-localhost","exit":0,"ms":4840.53,"pdfExists":true},
    {"test":"api-net-internal","exit":0,"ms":666.22,"pdfExists":true}
  ],
  "server_log": "10.1.0.109 - - [07/Jul/2026 07:18:07] \"GET /track.png HTTP/1.1\" 404 -"
}
```

## 5) Repro commands

```bash
# global mode
npm install -g @amitdevx/md2pdf@0.2.4
md2pdf --version
md2pdf doctor

# JS API mode
mkdir -p /tmp/md2pdf-prod-audit && cd /tmp/md2pdf-prod-audit
npm init -y
npm install @amitdevx/md2pdf@0.2.4
node bench-api.mjs
```
