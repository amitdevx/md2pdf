#!/bin/bash
exec 2>&1

echo "# MD2PDF v0.9.9 Command Audit Report"
echo ""

run_test() {
  local desc="$1"
  local cmd="$2"
  echo "### $desc"
  echo "\`\`\`bash"
  echo "$ $cmd"
  
  # Run the command and capture output and exit code
  eval "$cmd" > tmp.out 2>&1
  local exit_code=$?
  
  cat tmp.out
  echo "Exit Code: $exit_code"
  echo "\`\`\`"
  echo ""
}

run_test "1. No arguments" "md2pdf"
run_test "2. Missing file" "md2pdf missing.md"
run_test "3. Basic valid conversion" "md2pdf valid.md"
run_test "4. Empty file" "md2pdf empty.md"
run_test "5. Corrupted binary file as markdown" "md2pdf corrupt.md"
run_test "6. Broken frontmatter" "md2pdf broken.md"
run_test "7. Output to non-existent directory" "md2pdf valid.md -o /root/forbidden.pdf"
run_test "8. Output flag is a directory" "md2pdf valid.md -o ."
run_test "9. Non-existent theme" "md2pdf valid.md --theme unknown-theme"
run_test "10. Invalid split-by-heading depth" "md2pdf valid.md --split-by-heading -1"
run_test "11. Cover page missing" "md2pdf valid.md --cover-page nonexistent.pdf"
run_test "12. Output to same file (self-referential cover)" "md2pdf valid.md --cover-page valid.md.pdf"
run_test "13. Merge without inputs" "md2pdf --merge"
run_test "14. Merge with single file" "md2pdf valid.md --merge"
run_test "15. Merge with missing file" "md2pdf valid.md missing.md --merge"
run_test "16. PDF as main input (should fail securely)" "md2pdf valid.pdf"
run_test "17. Stdin piped correctly" "echo '# Piped' | md2pdf --stdin -o piped.pdf"
run_test "18. Stdin empty pipe" "cat /dev/null | md2pdf --stdin"
run_test "19. Missing required argument for flag" "md2pdf valid.md --watermark"
run_test "20. Directory as input" "md2pdf somedir"

