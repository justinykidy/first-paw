#!/bin/bash
# Checks all active agent tasks - deterministic, token-efficient
set -e

TASK_FILE="$(dirname "$0")/active-tasks.json"
ALERTS=""

if [ ! -f "$TASK_FILE" ]; then
  echo "No task file found."
  exit 0
fi

TASKS=$(python3 -c "
import json
with open('$TASK_FILE') as f: tasks = json.load(f)
for t in tasks:
    if t.get('status') in ('running', 'pr-open'):
        print(f\"{t['id']}|{t.get('tmuxSession','')}|{t.get('branch','')}|{t['status']}|{t.get('retries',0)}\")
")

if [ -z "$TASKS" ]; then
  echo "No active tasks."
  exit 0
fi

while IFS='|' read -r TASK_ID TMUX_SESSION BRANCH STATUS RETRIES; do
  echo "--- $TASK_ID ---"
  
  # Check tmux session
  if [ -n "$TMUX_SESSION" ]; then
    if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
      echo "  tmux: alive"
    else
      echo "  tmux: DEAD"
      ALERTS="$ALERTS\n⚠️ $TASK_ID - tmux session died"
    fi
  fi
  
  # Check PR status if branch exists
  if [ -n "$BRANCH" ]; then
    PR_NUM=$(gh pr list --head "$BRANCH" --json number -q '.[0].number' 2>/dev/null)
    if [ -n "$PR_NUM" ]; then
      echo "  PR: #$PR_NUM"
      # Check CI
      CI_STATUS=$(gh pr checks "$PR_NUM" --json state -q '.[].state' 2>/dev/null | sort -u)
      echo "  CI: $CI_STATUS"
      if echo "$CI_STATUS" | grep -q "FAILURE"; then
        ALERTS="$ALERTS\n❌ $TASK_ID - CI failed on PR #$PR_NUM"
      elif echo "$CI_STATUS" | grep -q "SUCCESS"; then
        echo "  ✅ All checks passed"
      fi
    fi
  fi
done <<< "$TASKS"

if [ -n "$ALERTS" ]; then
  echo ""
  echo "=== ALERTS ==="
  echo -e "$ALERTS"
fi
