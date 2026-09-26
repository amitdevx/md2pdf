set -e
run_test() {
  local desc="$1"
  local cmd="$2"
  local expected_code="$3"
  echo "Test: $desc"
  eval "$cmd" > /dev/null 2>&1
  local exit_code=$?
  if [ "$exit_code" -ne "$expected_code" ]; then
    echo "FAILED: Expected $expected_code, got $exit_code"
    exit 1
  fi
  echo "PASS"
}
run_test "1. No arguments" "false" 1
