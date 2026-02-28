#!/bin/bash
# Usage: run-agent.sh <task-id> <agent> <model> <prompt>
# Agents: codex, claude
set -e

TASK_ID="$1"
AGENT="$2"
MODEL="$3"
shift 3
PROMPT="$*"

TASK_FILE="$(git rev-parse --show-toplevel)/.clawdbot/active-tasks.json"

update_status() {
  local status="$1"
  local extra="$2"
  python3 -c "
import json, time
with open('$TASK_FILE') as f: tasks = json.load(f)
for t in tasks:
    if t['id'] == '$TASK_ID':
        t['status'] = '$status'
        if '$status' == 'done': t['completedAt'] = int(time.time() * 1000)
        $extra
with open('$TASK_FILE', 'w') as f: json.dump(tasks, f, indent=2)
" 2>/dev/null || true
}

update_status "running"

NOTIFY_CMD='openclaw system event --text "Done: '$TASK_ID'" --mode now'

if [ "$AGENT" = "codex" ]; then
  codex --model "$MODEL" \
    --dangerously-bypass-approvals-and-sandbox \
    "$PROMPT

When completely finished, run this command to notify: $NOTIFY_CMD"
elif [ "$AGENT" = "claude" ]; then
  claude --model "${MODEL:-claude-sonnet-4-5-20250514}" \
    --dangerously-skip-permissions \
    -p "$PROMPT

When completely finished, run this command to notify: $NOTIFY_CMD"
fi

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  update_status "done"
else
  update_status "failed"
fi
