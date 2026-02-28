#!/bin/bash
# cleanup.sh — 일일 정리 (완료/실패 태스크의 worktree + tmux 세션 정리)
set -euo pipefail

CLAWDBOT_DIR="${CLAWDBOT_DIR:-$HOME/.openclaw/workspace/.clawdbot}"
TASKS_FILE="$CLAWDBOT_DIR/active-tasks.json"

if [ ! -f "$TASKS_FILE" ]; then
  echo "No tasks file"
  exit 0
fi

CLEANED=0

python3 -c "
import json
with open('$TASKS_FILE') as f: data = json.load(f)
# Find tasks that are merged or failed (and older than 24h)
import datetime
now = datetime.datetime.now(datetime.timezone.utc)
to_remove = []
for t in data.get('tasks', []):
    if t['status'] in ('merged', 'failed'):
        to_remove.append(t)
for t in to_remove:
    print(t['id'] + '|' + t['project'] + '|' + t['branch'] + '|' + t['tmux_session'])
" 2>/dev/null | while IFS='|' read -r id project branch tmux_sess; do
  echo "Cleaning: $id"
  
  # Kill tmux session
  tmux kill-session -t "$tmux_sess" 2>/dev/null || true
  
  # Remove worktree
  WORKTREE="$HOME/${project}-worktrees/$branch"
  if [ -d "$WORKTREE" ]; then
    cd "$HOME/$project"
    git worktree remove "$WORKTREE" --force 2>/dev/null || true
  fi
  
  # Remove from tasks
  bash "$CLAWDBOT_DIR/task-manager.sh" remove "$id" 2>/dev/null || true
  
  CLEANED=$((CLEANED + 1))
done

# Clean orphaned worktrees
for PROJECT_DIR in "$HOME"/*-worktrees; do
  [ -d "$PROJECT_DIR" ] || continue
  PROJECT=$(basename "$PROJECT_DIR" | sed 's/-worktrees$//')
  if [ -d "$HOME/$PROJECT/.git" ]; then
    cd "$HOME/$PROJECT"
    git worktree prune 2>/dev/null || true
  fi
done

echo "✅ Cleanup done"
