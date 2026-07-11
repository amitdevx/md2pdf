# raw-benchmark-data.md

## CLI case results (raw)
Source: `/home/runner/work/md2pdf/md2pdf/audit-artifacts/data/cli-case-results.tsv`

```tsv
id	cmd	exit	stdout_bytes	stderr_bytes
help	node dist/cli/index.js --help	0	1725	0
version	node dist/cli/index.js --version	0	6	0
valid_basic	node dist/cli/index.js tests/fixtures/basic.md -o audit-artifacts/cli-tests/out/basic.pdf	0	0	151
valid_toc	node dist/cli/index.js tests/fixtures/basic.md --toc --toc-depth 3 --toc-title Contents -o audit-artifacts/cli-tests/out/toc.pdf	0	0	149
valid_header_footer	node dist/cli/index.js tests/fixtures/basic.md --header --footer -o audit-artifacts/cli-tests/out/hf.pdf	0	0	148
valid_theme	node dist/cli/index.js tests/fixtures/basic.md --theme github -o audit-artifacts/cli-tests/out/theme.pdf	0	0	151
valid_margin	node dist/cli/index.js tests/fixtures/basic.md --paper Letter --margin 10mm -o audit-artifacts/cli-tests/out/margin.pdf	0	0	152
valid_verbose	node dist/cli/index.js tests/fixtures/basic.md --verbose -o audit-artifacts/cli-tests/out/verbose.pdf	0	236	153
valid_json_errors	node dist/cli/index.js does-not-exist.md --json-errors	1	170	0
stdin_dash	node dist/cli/index.js -	1	0	139
stdin_flag	node dist/cli/index.js tests/fixtures/basic.md --stdin	1	0	62
stdout_flag	node dist/cli/index.js tests/fixtures/basic.md --stdout	1	0	63
quiet_flag	node dist/cli/index.js tests/fixtures/basic.md --quiet	1	0	62
browser_flag	node dist/cli/index.js tests/fixtures/basic.md --browser chromium	1	0	64
input_flag	node dist/cli/index.js --input tests/fixtures/basic.md	1	0	87
duplicate_output	node dist/cli/index.js tests/fixtures/basic.md -o audit-artifacts/cli-tests/out/d1.pdf -o audit-artifacts/cli-tests/out/d2.pdf	0	0	148
missing_output_value	node dist/cli/index.js tests/fixtures/basic.md --output	1	0	85
unknown_flag	node dist/cli/index.js tests/fixtures/basic.md --wat	1	0	60
malformed_toc_depth	node dist/cli/index.js tests/fixtures/basic.md --toc --toc-depth x	1	0	68
invalid_theme	node dist/cli/index.js tests/fixtures/basic.md --theme nope	1	0	97
invalid_margin	node dist/cli/index.js tests/fixtures/basic.md --margin nope	1	0	71
invalid_extension	node dist/cli/index.js package.json	1	0	84
directory_input	node dist/cli/index.js tests	1	0	81
unicode_path	node dist/cli/index.js audit-artifacts/cli-tests/unicode-ä文件.md -o audit-artifacts/cli-tests/out/unicode.pdf	0	0	153
spaced_path	node dist/cli/index.js 'audit-artifacts/cli-tests/space name.md' -o 'audit-artifacts/cli-tests/out/space out.pdf'	0	0	155
special_path	node dist/cli/index.js 'audit-artifacts/cli-tests/special-!@#$%^&()[]{}.md' -o audit-artifacts/cli-tests/out/special.pdf	0	0	153
long_path	node dist/cli/index.js audit-artifacts/cli-tests/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.md -o audit-artifacts/cli-tests/out/long.pdf	0	0	150
windows_path	node dist/cli/index.js C:\temp\fake.md	1	0	134
absolute_path	node dist/cli/index.js /home/runner/work/md2pdf/md2pdf/tests/fixtures/basic.md -o /home/runner/work/md2pdf/md2pdf/audit-artifacts/cli-tests/out/abs.pdf	0	0	149
relative_path	cd /home/runner/work/md2pdf/md2pdf && node dist/cli/index.js ./tests/fixtures/basic.md -o ./audit-artifacts/cli-tests/out/rel.pdf	0	0	149
```

## Input/Output/Render timings (raw)
Source: `/home/runner/work/md2pdf/md2pdf/audit-artifacts/data/input-output-render-results.tsv`

```tsv
phase	id	cmd	exit	elapsed_s	maxrss_kb
input	missing_file	node dist/cli/index.js audit-artifacts/input-tests/missing.md	1	Command exited with non-zero status 1
0.82	180724
input	empty	node dist/cli/index.js audit-artifacts/input-tests/empty.md -o audit-artifacts/output-tests/out/empty.pdf	0	6.77	364732
input	utf8	node dist/cli/index.js audit-artifacts/input-tests/utf8.md -o audit-artifacts/output-tests/out/utf8.pdf	0	7.60	365368
input	utf16	node dist/cli/index.js audit-artifacts/input-tests/utf16.md -o audit-artifacts/output-tests/out/utf16.pdf	0	6.44	364452
input	invalid_encoding	node dist/cli/index.js audit-artifacts/input-tests/invalid-encoding.md -o audit-artifacts/output-tests/out/invalid-encoding.pdf	0	6.97	364032
input	binary	node dist/cli/index.js audit-artifacts/input-tests/binary.md -o audit-artifacts/output-tests/out/binary.pdf	0	7.31	364628
input	huge	node dist/cli/index.js audit-artifacts/input-tests/huge.md -o audit-artifacts/output-tests/out/huge.pdf	134	Command terminated by signal 6
63.34	4502468
input	long_filename	node dist/cli/index.js audit-artifacts/input-tests/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.md -o audit-artifacts/output-tests/out/longname.pdf	0	7.00	365988
input	symlink	node dist/cli/index.js audit-artifacts/input-tests/symlink.md -o audit-artifacts/output-tests/out/symlink.pdf	0	7.55	363304
input	directory	node dist/cli/index.js audit-artifacts/input-tests	1	Command exited with non-zero status 1
0.84	181056
output	missing_dir	node dist/cli/index.js tests/fixtures/basic.md -o audit-artifacts/output-tests/missing/sub/out.pdf	0	7.39	364140
output	readonly	node dist/cli/index.js tests/fixtures/basic.md -o audit-artifacts/output-tests/readonly/out.pdf	2	Command exited with non-zero status 2
6.93	364092
output	overwrite1	node dist/cli/index.js tests/fixtures/basic.md -o audit-artifacts/output-tests/out/overwrite.pdf	0	7.28	364084
output	overwrite2	node dist/cli/index.js tests/fixtures/basic.md -o audit-artifacts/output-tests/out/overwrite.pdf	0	7.48	364212
output	unicode_out	node dist/cli/index.js tests/fixtures/basic.md -o audit-artifacts/output-tests/out/输出.pdf	0	6.85	365472
output	abs_out	node dist/cli/index.js tests/fixtures/basic.md -o /home/runner/work/md2pdf/md2pdf/audit-artifacts/output-tests/out/absout.pdf	0	7.11	363472
output	windows_out	node dist/cli/index.js tests/fixtures/basic.md -o C:\tmp\foo.pdf	0	6.71	364580
render	code	node dist/cli/index.js 'audit-artifacts/render-fixtures/code.md' -o audit-artifacts/render-out/code.pdf	0	6.70	364844
render	deflists	node dist/cli/index.js 'audit-artifacts/render-fixtures/deflists.md' -o audit-artifacts/render-out/deflists.pdf	0	6.38	363940
render	footnotes	node dist/cli/index.js 'audit-artifacts/render-fixtures/footnotes.md' -o audit-artifacts/render-out/footnotes.pdf	0	6.60	362536
render	headers	node dist/cli/index.js 'audit-artifacts/render-fixtures/headers.md' -o audit-artifacts/render-out/headers.pdf	0	6.53	364580
render	html	node dist/cli/index.js 'audit-artifacts/render-fixtures/html.md' -o audit-artifacts/render-out/html.pdf	0	6.10	364204
render	images-svg	node dist/cli/index.js 'audit-artifacts/render-fixtures/images-svg.md' -o audit-artifacts/render-out/images-svg.pdf	0	7.81	363724
render	links	node dist/cli/index.js 'audit-artifacts/render-fixtures/links.md' -o audit-artifacts/render-out/links.pdf	0	6.40	363840
render	lists	node dist/cli/index.js 'audit-artifacts/render-fixtures/lists.md' -o audit-artifacts/render-out/lists.pdf	0	6.04	365372
render	malformed	node dist/cli/index.js 'audit-artifacts/render-fixtures/malformed.md' -o audit-artifacts/render-out/malformed.pdf	0	6.19	364092
render	math	node dist/cli/index.js 'audit-artifacts/render-fixtures/math.md' -o audit-artifacts/render-out/math.pdf	0	6.37	363992
render	obsidian	node dist/cli/index.js 'audit-artifacts/render-fixtures/obsidian.md' -o audit-artifacts/render-out/obsidian.pdf	0	6.44	365632
render	quotes-hr	node dist/cli/index.js 'audit-artifacts/render-fixtures/quotes-hr.md' -o audit-artifacts/render-out/quotes-hr.pdf	0	6.51	364608
render	raw-html	node dist/cli/index.js 'audit-artifacts/render-fixtures/raw-html.md' -o audit-artifacts/render-out/raw-html.pdf	0	6.17	364760
render	tables	node dist/cli/index.js 'audit-artifacts/render-fixtures/tables.md' -o audit-artifacts/render-out/tables.pdf	0	6.05	365192
render	tasklists	node dist/cli/index.js 'audit-artifacts/render-fixtures/tasklists.md' -o audit-artifacts/render-out/tasklists.pdf	0	6.14	364520
```

## Installation timings (raw)
Source files: `/home/runner/work/md2pdf/md2pdf/audit-artifacts/install-tests/*-time.txt`

```text
local-clean-project-time.txt: elapsed_s=1.19 maxrss_kb=160768
local-empty-dir-time.txt: elapsed_s=1.09 maxrss_kb=159524
local-existing-project-time.txt: elapsed_s=1.12 maxrss_kb=160452
npm-clean-project-time.txt: elapsed_s=6.50 maxrss_kb=486820
npm-empty-dir-time.txt: elapsed_s=6.14 maxrss_kb=493100
npm-existing-project-time.txt: elapsed_s=6.15 maxrss_kb=495812
tarball-clean-project-time.txt: elapsed_s=10.22 maxrss_kb=433248
tarball-empty-dir-time.txt: elapsed_s=6.97 maxrss_kb=474624
tarball-existing-project-time.txt: elapsed_s=7.14 maxrss_kb=476132
```

## Browser binary sizes (raw)
```text
646M	/home/runner/.cache/ms-playwright
20K	/home/runner/.cache/ms-playwright/.links
379M	/home/runner/.cache/ms-playwright/chromium-1228
4.9M	/home/runner/.cache/ms-playwright/ffmpeg-1011
262M	/home/runner/.cache/ms-playwright/chromium_headless_shell-1228
```

## Note
Planned 30-iteration benchmark suites and full browser matrix were not completed in this session.
