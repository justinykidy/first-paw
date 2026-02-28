#!/bin/bash
# task-manager.sh — active-tasks.json 관리
# 사용법:
#   ./task-manager.sh add <id> <project> <branch> <tmux-session> <agent-type> <prompt-file>
#   ./task-manager.sh update <id> <status> [pr-number]
#   ./task-manager.sh remove <id>
#   ./task-manager.sh list
#   ./task-manager.sh check          ← 모든 태스크 health check
#   ./task-manager.sh get <id>

TASKS_FILE="${CLAWDBOT_DIR:-$HOME/.openclaw/workspace/.clawdbot}/active-tasks.json"

add_task() {
  local id="$1" project="$2" branch="$3" tmux="$4" agent="$5" prompt="$6"
  local now
  now="$(date -Iseconds)"
  
  python3 -c "
import json
with open('$TASKS_FILE') as f: data = json.load(f)
task = {
    'id': '$id',
    'project': '$project',
    'branch': '$branch',
    'tmux_session': '$tmux',
    'agent_type': '$agent',
    'prompt_file': '$prompt',
    'status': 'running',
    'pr_number': None,
    'retries': 0,
    'max_retries': 3,
    'created_at': '$now',
    'updated_at': '$now',
    'ci_status': None,
    'review_status': {
        'codex': None,
        'claude': None,
        'gemini': None
    }
}
# Remove existing task with same id
data['tasks'] = [t for t in data['tasks'] if t['id'] != '$id']
data['tasks'].append(task)
with open('$TASKS_FILE', 'w') as f: json.dump(data, f, indent=2)
print('✅ Task added: $id ($agent on $tmux)')
"
}

update_task() {
  local id="$1" status="$2" pr="${3:-}"
  local now
  now="$(date -Iseconds)"
  
  python3 -c "
import json
with open('$TASKS_FILE') as f: data = json.load(f)
for t in data['tasks']:
    if t['id'] == '$id':
        t['status'] = '$status'
        t['updated_at'] = '$now'
        if '$pr': t['pr_number'] = '$pr' if '$pr' else t.get('pr_number')
        break
else:
    print('❌ Task not found: $id')
    exit(1)
with open('$TASKS_FILE', 'w') as f: json.dump(data, f, indent=2)
print('✅ Task updated: $id → $status')
"
}

remove_task() {
  local id="$1"
  python3 -c "
import json
with open('$TASKS_FILE') as f: data = json.load(f)
before = len(data['tasks'])
data['tasks'] = [t for t in data['tasks'] if t['id'] != '$id']
if len(data['tasks']) == before:
    print('❌ Task not found: $id')
    exit(1)
with open('$TASKS_FILE', 'w') as f: json.dump(data, f, indent=2)
print('✅ Task removed: $id')
"
}

list_tasks() {
  python3 -c "
import json
with open('$TASKS_FILE') as f: data = json.load(f)
tasks = data.get('tasks', [])
if not tasks:
    print('📋 No active tasks')
    exit(0)
print(f'📋 Active tasks: {len(tasks)}')
print('─' * 60)
for t in tasks:
    pr = f' PR#{t[\"pr_number\"]}' if t.get('pr_number') else ''
    retries = f' (retry {t[\"retries\"]}/{t[\"max_retries\"]})' if t['retries'] > 0 else ''
    icon = {'running':'🔄','completed':'✅','failed':'❌','pr_created':'📬','reviewing':'🔍'}.get(t['status'],'❓')
    print(f'  {icon} {t[\"id\"]} [{t[\"agent_type\"]}] — {t[\"status\"]}{pr}{retries}')
    print(f'     tmux: {t[\"tmux_session\"]} | branch: {t[\"branch\"]}')
"
}

check_tasks() {
  python3 -c "
import json, subprocess, sys

with open('$TASKS_FILE') as f: data = json.load(f)
tasks = data.get('tasks', [])
issues = []

for t in tasks:
    if t['status'] not in ('running',):
        continue
    
    # Check tmux session alive
    result = subprocess.run(['tmux', 'has-session', '-t', t['tmux_session']], 
                          capture_output=True)
    tmux_alive = result.returncode == 0
    
    if not tmux_alive:
        # Check if PR was created (agent might have finished)
        if t.get('pr_number'):
            t['status'] = 'pr_created'
            issues.append(f'✅ {t[\"id\"]}: tmux dead but PR exists → pr_created')
        else:
            # Check git for commits on branch
            result = subprocess.run(
                ['git', '-C', f'/home/nearjustino/{t[\"project\"]}', 'log', 
                 f'origin/{t[\"branch\"]}', '--oneline', '-1'],
                capture_output=True, text=True
            )
            if result.returncode == 0 and result.stdout.strip():
                t['status'] = 'completed'
                issues.append(f'⚠️ {t[\"id\"]}: tmux dead, commits exist but no PR → completed (needs PR)')
            else:
                t['status'] = 'failed'
                t['retries'] = t.get('retries', 0) + 1
                issues.append(f'❌ {t[\"id\"]}: tmux dead, no commits → failed (retry {t[\"retries\"]}/{t[\"max_retries\"]})')

with open('$TASKS_FILE', 'w') as f: json.dump(data, f, indent=2)

if issues:
    print('🔍 Health check results:')
    for i in issues: print(f'  {i}')
else:
    print('🔍 All tasks healthy')
" 2>&1
}

get_task() {
  local id="$1"
  python3 -c "
import json
with open('$TASKS_FILE') as f: data = json.load(f)
for t in data['tasks']:
    if t['id'] == '$id':
        print(json.dumps(t, indent=2))
        exit(0)
print('❌ Task not found: $id')
exit(1)
"
}

case "${1:-}" in
  add) add_task "$2" "$3" "$4" "$5" "$6" "$7" ;;
  update) update_task "$2" "$3" "${4:-}" ;;
  remove) remove_task "$2" ;;
  list) list_tasks ;;
  check) check_tasks ;;
  get) get_task "$2" ;;
  *) echo "Usage: $0 {add|update|remove|list|check|get} [args]"; exit 1 ;;
esac
