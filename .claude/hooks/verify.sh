#!/bin/bash
# Stop hook: if Claude edited files since the last check (marker set by after-edit.sh),
# run this repo's fast checks. Failures exit 2 so Claude sees them and fixes them before
# finishing; stop_hook_active prevents a retry loop.
input=$(cat)
[ "$(jq -r '.stop_hook_active // false' <<<"$input")" = "true" ] && exit 0
marker="${TMPDIR:-/tmp}/claude-edited-$(jq -r '.session_id // "none"' <<<"$input")"
[ -f "$marker" ] || exit 0
rm -f "$marker"
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

failed=0
check() { # check <label> <command...>
  local label=$1 out
  shift
  if ! out=$("$@" 2>&1); then
    printf '== %s failed ==\n%s\n\n' "$label" "$(printf '%s\n' "$out" | tail -n 40)" >&2
    failed=1
  fi
}

# Files changed vs HEAD plus untracked files (this includes uncommitted work of the user).
changed() { # changed <extended-regex>
  { git diff --name-only --diff-filter=ACMR HEAD; git ls-files --others --exclude-standard; } |
    sort -u | grep -E "$1"
}

files=()
while IFS= read -r f; do [ -f "$f" ] && files+=("$f"); done < <(changed '\.(js|mjs|cjs|json|ya?ml|svg)$')
if [ ${#files[@]} -gt 0 ]; then
  check "node --test" node --test
fi
exit $((failed * 2))
