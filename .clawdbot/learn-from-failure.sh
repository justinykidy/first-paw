#!/bin/bash
# learn-from-failure.sh — 실패 분석 → 더 나은 프롬프트 생성 (Ralph Loop V2)
# Usage: learn-from-failure.sh <task-id> <project>
set -euo pipefail

TASK_ID="$1"
PROJECT="$2"
CLAWDBOT_DIR="${CLAWDBOT_DIR:-$HOME/.openclaw/workspace/.clawdbot}"
TASKS_FILE="$CLAWDBOT_DIR/active-tasks.json"
PATTERNS_FILE="$CLAWDBOT_DIR/learned-patterns.json"
PIPELINE_DIR="$CLAWDBOT_DIR/pipeline"

# Initialize patterns file if missing
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
        break" 2>/dev/null)

# Get CI failure log if exists
CI_LOG=""
if [ -f "$PIPELINE_DIR/ci-failure-$TASK_ID.log" ]; then
  CI_LOG=$(tail -100 "$PIPELINE_DIR/ci-failure-$TASK_ID.log")
fi

# Get tmux last output if session exists
TMUX_SESS=$(echo "$TASK_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('tmux_session',''))" 2>/dev/null)
TMUX_LOG=""
if [ -n "$TMUX_SESS" ] && tmux has-session -t "$TMUX_SESS" 2>/dev/null; then
  TMUX_LOG=$(tmux capture-pane -t "$TMUX_SESS" -p -S -100 2>/dev/null || echo "")
fi

# Get original prompt
PROMPT_FILE=$(echo "$TASK_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('prompt_file',''))" 2>/dev/null)
ORIGINAL_PROMPT=""
if [ -n "$PROMPT_FILE" ] && [ -f "$PROMPT_FILE" ]; then
  ORIGINAL_PROMPT=$(cat "$PROMPT_FILE")
fi

# Use Claude to analyze failure and suggest better prompt
ANALYSIS=$(claude -p "You are analyzing why a coding agent failed. Be concise and actionable.

TASK: $TASK_JSON

ORIGINAL PROMPT:
$ORIGINAL_PROMPT

CI FAILURE LOG:
$CI_LOG

AGENT OUTPUT (last 100 lines):
$TMUX_LOG

Analyze:
1. ROOT CAUSE: Why did it fail? (1 sentence)
2. PATTERN: Is this a recurring pattern? (missing deps, wrong API, permission issue, etc.)
3. IMPROVED PROMPT: Write a better version of the original prompt that would avoid this failure. Include specific guardrails.
4. PREVENTION: What should we add to our role files or workflow to prevent this class of failure?

Output as JSON:
{\"root_cause\":\"\",\"pattern\":\"\",\"improved_prompt\":\"\",\"prevention\":\"\"}" 2>/dev/null || echo "{}")

# Store the learning
python3 -c "
import json, sys
analysis = '''$ANALYSIS'''
try:
    a = json.loads(analysis)
except:
    a = {'root_cause': 'parse_failed', 'raw': analysis}

with open('$PATTERNS_FILE') as f: patterns = json.load(f)
patterns['failures'].append({
    'task_id': '$TASK_ID',
    'project': '$PROJECT',
    'analysis': a,
    'timestamp': '$(date -Iseconds)'
})
# Keep last 50 entries
patterns['failures'] = patterns['failures'][-50:]
with open('$PATTERNS_FILE', 'w') as f: json.dump(patterns, f, indent=2)
print('📝 Failure analyzed and stored for: $TASK_ID')
"

echo "$ANALYSIS"
