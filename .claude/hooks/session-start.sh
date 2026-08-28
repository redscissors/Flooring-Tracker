#!/bin/bash
set -euo pipefail

# Claude Code on the web only — local setups install deps and plugins once by hand
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

npm install

# Cloud sessions register this repo's marketplaces from .claude/settings.json but
# do not auto-install its enabledPlugins. Installing here puts the plugin into the
# cached container state so sessions load it at startup.
if ! claude plugin list 2>/dev/null | grep -q 'superpowers@claude-plugins-official'; then
  claude plugin install superpowers@claude-plugins-official
fi
