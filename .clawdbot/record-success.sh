#!/bin/bash
# record-success.sh — 성공 패턴 기록 (CI pass + reviews pass + human merge = reward signal)
# Usage: record-success.sh <task-id> <project> <pr-number>
set -euo pipefail

TASK_ID="$1"
PROJECT="$2"
PR="$3"
CLAWDBOT_DIR="${CLAWDBOT_DIR:-$HOME/.openclaw/workspace/.clawdbot}"
PATTERNS_FILE="$CLAWDBOT_DIR/learned-patterns.json"
TASKS_FILE="$CLAWDBOT_DIR/active-tasks.json"

if [ ! -f "$PATTERNS_FILE" ]; then
  echo '{"successes":[],"failures":[],"prompt_improvements":[]}' > "$PATTERNS_FILE"
fi

# Get task info
TASK_JSON=$(python3 -c "
import json
with open('$TASKS_FILE') as f: data = json.load(f)
for t in data['tasks']:
    if t['id'] == '$TASK_ID':
        print(json.dumps(t))
        break" 2>/dev/null || echo "{}")

AGENT=$(echo "$TASK_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('agent_type','unknown'))" 2>/dev/null)
RETRIES=$(echo "$TASK_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('retries',0))" 2>/dev/null)

python3 -c "
import json
with open('$PATTERNS_FILE') as f: p = json.load(f)
p['successes'].append({
    'task_id': '$TASK_ID',
    'project': '$PROJECT',
    'pr': '$PR',
    'agent': '$AGENT',
    'retries': $RETRIES,
    'timestamp': '$(date -Iseconds)'
})
p['successes'] = p['successes'][-100:]
with open('$PATTERNS_FILE', 'w') as f: json.dump(p, f, indent=2)
print('✅ Success recorded: $TASK_ID (agent=$AGENT, retries=$RETRIES)')
"
