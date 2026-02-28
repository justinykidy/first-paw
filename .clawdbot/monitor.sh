#!/bin/bash
# monitor.sh — 에이전트 모니터링 (10분마다 cron으로 실행)
# 역할: tmux 세션 생존 확인, PR/CI 상태 체크, 실패 에이전트 자동 재시작, 알림
set -euo pipefail

CLAWDBOT_DIR="${CLAWDBOT_DIR:-$HOME/.openclaw/workspace/.clawdbot}"
TASKS_FILE="$CLAWDBOT_DIR/active-tasks.json"
TASK_MGR="$CLAWDBOT_DIR/task-manager.sh"
LOG_FILE="$CLAWDBOT_DIR/monitor.log"

log() { echo "[$(date -Iseconds)] $*" >> "$LOG_FILE"; }

if [ ! -f "$TASKS_FILE" ]; then
  exit 0
fi

TASKS=$(python3 -c "
import json
with open('$TASKS_FILE') as f: data = json.load(f)
for t in data.get('tasks', []):
    print(t['id'] + '|' + t['status'] + '|' + t['tmux_session'] + '|' + t['project'] + '|' + t['branch'] + '|' + t['agent_type'] + '|' + t.get('prompt_file','') + '|' + str(t.get('retries',0)) + '|' + str(t.get('max_retries',3)) + '|' + str(t.get('pr_number','')))" 2>/dev/null)

if [ -z "$TASKS" ]; then
  exit 0
fi

ALERTS=""

while IFS='|' read -r id status tmux_sess project branch agent prompt_file retries max_retries pr_number; do
  # Skip non-running tasks
  if [ "$status" != "running" ] && [ "$status" != "pr_created" ] && [ "$status" != "reviewing" ]; then
    continue
  fi

  # --- Running tasks: check tmux alive ---
  if [ "$status" = "running" ]; then
    if ! tmux has-session -t "$tmux_sess" 2>/dev/null; then
      log "DEAD: $id tmux session $tmux_sess not found"
      
      # Check if PR was created while we weren't looking
      PR_NUM=$(gh pr list --repo "justinykidy/$project" --head "$branch" --json number --jq '.[0].number' 2>/dev/null || echo "")
      
      if [ -n "$PR_NUM" ]; then
        bash "$TASK_MGR" update "$id" "pr_created" "$PR_NUM"
        log "RECOVERED: $id has PR #$PR_NUM"
      elif [ "$retries" -lt "$max_retries" ]; then
        # Auto-restart
        log "RESTART: $id (attempt $((retries+1))/$max_retries)"
        bash "$CLAWDBOT_DIR/restart-agent.sh" "$id" "$project" "$branch" "$agent" "$prompt_file" "$tmux_sess"
        python3 -c "
import json
with open('$TASKS_FILE') as f: data = json.load(f)
for t in data['tasks']:
    if t['id'] == '$id':
        t['retries'] = t.get('retries',0) + 1
        break
with open('$TASKS_FILE','w') as f: json.dump(data, f, indent=2)"
      else
        bash "$TASK_MGR" update "$id" "failed"
        ALERTS="${ALERTS}❌ $id: 에이전트 실패 (${max_retries}회 재시도 소진)\n"
        log "FAILED: $id max retries exceeded"
      fi
    fi
  fi

  # --- PR created: check CI ---
  if [ "$status" = "pr_created" ] || [ "$status" = "reviewing" ]; then
    if [ -z "$pr_number" ] || [ "$pr_number" = "None" ]; then
      continue
    fi
    
    CI_STATUS=$(gh pr checks "$pr_number" --repo "justinykidy/$project" --json state --jq '.[].state' 2>/dev/null | sort -u)
    
    if echo "$CI_STATUS" | grep -q "FAILURE"; then
      log "CI_FAIL: $id PR #$pr_number"
      if [ "$retries" -lt "$max_retries" ]; then
        # Get failure logs and restart with fix context
        FAIL_LOG=$(gh run list --repo "justinykidy/$project" --branch "$branch" --status failure --json databaseId --jq '.[0].databaseId' 2>/dev/null)
        if [ -n "$FAIL_LOG" ]; then
          gh run view "$FAIL_LOG" --repo "justinykidy/$project" --log-failed 2>/dev/null | tail -50 > "$CLAWDBOT_DIR/pipeline/ci-failure-$id.log"
        fi
        bash "$CLAWDBOT_DIR/restart-agent.sh" "$id" "$project" "$branch" "$agent" "$prompt_file" "$tmux_sess" "ci-fix"
        python3 -c "
import json
with open('$TASKS_FILE') as f: data = json.load(f)
for t in data['tasks']:
    if t['id'] == '$id':
        t['retries'] = t.get('retries',0) + 1
        t['status'] = 'running'
        break
with open('$TASKS_FILE','w') as f: json.dump(data, f, indent=2)"
      else
        ALERTS="${ALERTS}❌ $id: CI 실패, 재시도 소진 (PR #$pr_number)\n"
      fi
    elif echo "$CI_STATUS" | grep -q "PENDING"; then
      : # Still running, do nothing
    elif echo "$CI_STATUS" | grep -q "SUCCESS"; then
      if [ "$status" != "reviewing" ]; then
        # CI passed → trigger code review
        log "CI_PASS: $id PR #$pr_number → triggering reviews"
        bash "$TASK_MGR" update "$id" "reviewing"
        bash "$CLAWDBOT_DIR/auto-review.sh" "$project" "$pr_number" "$id" &
      fi
    fi
  fi

done <<< "$TASKS"

# --- Check for fully reviewed PRs ---
python3 -c "
import json
with open('$TASKS_FILE') as f: data = json.load(f)
for t in data.get('tasks', []):
    if t['status'] != 'reviewing': continue
    rs = t.get('review_status', {})
    if all(v in ('done','skipped') for v in rs.values() if v is not None):
        # All reviews done
        pr = t.get('pr_number','')
        print(f'READY|{t[\"id\"]}|{t[\"project\"]}|{pr}')
" 2>/dev/null | while IFS='|' read -r tag id project pr; do
  log "ALL_REVIEWS_DONE: $id PR #$pr"
  ALERTS="${ALERTS}✅ $id: PR #$pr 준비 완료 — CI 통과 + 3중 리뷰 완료. 확인해줘!\nhttps://github.com/justinykidy/$project/pull/$pr\n"
done

# Send alerts if any
if [ -n "$ALERTS" ]; then
  openclaw system event --text "$(echo -e "$ALERTS")" --mode now 2>/dev/null || true
fi
