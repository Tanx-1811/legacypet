#!/bin/bash
# PostToolUse hook (Edit/Write): records that Claude edited files in this session, so the
# Stop hook (verify.sh) only runs checks after real edits, then formats the edited file.
input=$(cat)
touch "${TMPDIR:-/tmp}/claude-edited-$(jq -r '.session_id // "none"' <<<"$input")"

file=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<<"$input")
root="${CLAUDE_PROJECT_DIR:-$PWD}"
case "$file" in "$root"/*) ;; *) exit 0 ;; esac
[ -f "$file" ] || exit 0

# No formatter configured in this repo; the marker above is all this hook does.
exit 0
