#!/bin/bash
set -euo pipefail

# Claude Code on the web only — local setups install deps once by hand
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

npm install

# No `claude plugin install` here: cloud containers are ephemeral (nothing under
# ~/.claude survives to the next session) and hooks run after the session's skill
# registry is built, so an install from this hook can never load. The superpowers
# skills are vendored in .claude/skills/ instead — see CLAUDE.md.
