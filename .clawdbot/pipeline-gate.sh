#!/bin/bash
# pipeline-gate.sh — 플래닝 파이프라인 상태 추적 + 게이트 체크
# 사용법:
#   ./pipeline-gate.sh init <project>           → 새 파이프라인 시작
#   ./pipeline-gate.sh complete <step>           → 단계 완료 기록
#   ./pipeline-gate.sh gate <step>               → 이 단계로 진행 가능한지 체크 (exit 0 = OK, exit 1 = 블로킹)
#   ./pipeline-gate.sh status                    → 현재 상태 출력
#   ./pipeline-gate.sh reset                     → 리비전 루프용 리셋 (리뷰 단계만)

PIPELINE_DIR="${CLAWDBOT_DIR:-$HOME/.openclaw/workspace/.clawdbot}/pipeline"
STATEFILE="${PIPELINE_STATE:-}"

# 단계 순서 및 의존성
# discovery → planner → reviewers → meta → [revision loop] → user_confirm → coder → ci → code_review → merge_confirm → merge
STEPS=(discovery planner review_correctness review_architecture review_feasibility meta user_confirm coder ci code_review merge_confirm merge)

_resolve_state() {
  # If STATEFILE already set (via env), use it
  if [ -n "$STATEFILE" ]; then return; fi
  # Otherwise find current project from latest state
  local latest
  latest=$(find "$PIPELINE_DIR" -name "state.json" -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | awk '{print $2}')
  STATEFILE="${latest:-}"
}

init() {
  local project="$1"
  mkdir -p "$PIPELINE_DIR/$project"
  STATEFILE="$PIPELINE_DIR/$project/state.json"
  cat > "$STATEFILE" << EOF
{
  "project": "$project",
  "version": 1,
  "revision_count": 0,
  "max_revisions": 3,
  "started_at": "$(date -Iseconds)",
  "steps": {
    "discovery": {"status": "pending", "completed_at": null},
    "planner": {"status": "pending", "completed_at": null},
    "review_correctness": {"status": "pending", "completed_at": null, "verdict": null},
    "review_architecture": {"status": "pending", "completed_at": null, "verdict": null},
    "review_feasibility": {"status": "pending", "completed_at": null, "verdict": null},
    "meta": {"status": "pending", "completed_at": null, "verdict": null},
    "user_confirm": {"status": "pending", "completed_at": null},
    "coder": {"status": "pending", "completed_at": null},
    "ci": {"status": "pending", "completed_at": null},
    "code_review": {"status": "pending", "completed_at": null},
    "merge_confirm": {"status": "pending", "completed_at": null},
    "merge": {"status": "pending", "completed_at": null}
  }
}
EOF
  echo "✅ Pipeline initialized for: $project (state: $STATEFILE)"
}

complete() {
  _resolve_state
  local step="$1"
  local verdict="${2:-}"
  
  if [ ! -f "$STATEFILE" ]; then
    echo "❌ No pipeline state. Run: ./pipeline-gate.sh init <project>"
    exit 1
  fi
  
  # Gate check — can't complete a step if prerequisites aren't met
  gate "$step" quiet
  if [ $? -ne 0 ]; then
    exit 1
  fi
  
  # Update state
  local now
  now="$(date -Iseconds)"
  
  if [ -n "$verdict" ]; then
    python3 -c "
import json, sys
with open('$STATEFILE') as f: state = json.load(f)
state['steps']['$step']['status'] = 'done'
state['steps']['$step']['completed_at'] = '$now'
state['steps']['$step']['verdict'] = '$verdict'
with open('$STATEFILE', 'w') as f: json.dump(state, f, indent=2)
"
  else
    python3 -c "
import json, sys
with open('$STATEFILE') as f: state = json.load(f)
state['steps']['$step']['status'] = 'done'
state['steps']['$step']['completed_at'] = '$now'
with open('$STATEFILE', 'w') as f: json.dump(state, f, indent=2)
"
  fi
  echo "✅ Step completed: $step ${verdict:+(verdict: $verdict)}"
}

gate() {
  _resolve_state
  local step="$1"
  local quiet="${2:-}"
  
  if [ ! -f "$STATEFILE" ]; then
    echo "❌ No pipeline state."
    return 1
  fi
  
  # Define prerequisites for each step
  local -A PREREQS
  PREREQS[discovery]=""
  PREREQS[planner]="discovery"
  PREREQS[review_correctness]="planner"
  PREREQS[review_architecture]="planner"
  PREREQS[review_feasibility]="planner"
  PREREQS[meta]="review_correctness review_architecture review_feasibility"
  PREREQS[user_confirm]="meta"
  PREREQS[coder]="user_confirm"
  PREREQS[ci]="coder"
  PREREQS[code_review]="ci"
  PREREQS[merge_confirm]="code_review"
  PREREQS[merge]="merge_confirm"
  
  local prereqs="${PREREQS[$step]}"
  if [ -z "$prereqs" ]; then
    return 0
  fi
  
  for prereq in $prereqs; do
    local status
    status=$(python3 -c "
import json
with open('$STATEFILE') as f: state = json.load(f)
print(state['steps'].get('$prereq', {}).get('status', 'pending'))
")
    if [ "$status" != "done" ]; then
      if [ "$quiet" != "quiet" ]; then
        echo "🚫 BLOCKED: '$step' requires '$prereq' to be completed first (current: $status)"
      fi
      return 1
    fi
  done
  
  # Special gate: user_confirm requires meta verdict == APPROVE
  if [ "$step" == "user_confirm" ]; then
    local meta_verdict
    meta_verdict=$(python3 -c "
import json
with open('$STATEFILE') as f: state = json.load(f)
print(state['steps']['meta'].get('verdict', 'unknown'))
")
    if [ "$meta_verdict" != "APPROVE" ]; then
      if [ "$quiet" != "quiet" ]; then
        echo "🚫 BLOCKED: Meta verdict is '$meta_verdict', not APPROVE. Must revise plan first."
        echo "   Run: ./pipeline-gate.sh reset  (then re-run planner → reviewers → meta)"
      fi
      return 1
    fi
  fi
  
  return 0
}

reset_reviews() {
  _resolve_state
  # Reset review + meta steps for revision loop
  if [ ! -f "$STATEFILE" ]; then
    echo "❌ No pipeline state."
    exit 1
  fi
  
  python3 -c "
import json
with open('$STATEFILE') as f: state = json.load(f)
state['revision_count'] = state.get('revision_count', 0) + 1
if state['revision_count'] > state.get('max_revisions', 3):
    print('❌ Max revisions reached (' + str(state['max_revisions']) + '). Escalate to user.')
    exit(1)
state['version'] = state.get('version', 1) + 1
for step in ['review_correctness', 'review_architecture', 'review_feasibility', 'meta', 'user_confirm']:
    state['steps'][step] = {'status': 'pending', 'completed_at': None, 'verdict': None}
with open('$STATEFILE', 'w') as f: json.dump(state, f, indent=2)
print('🔄 Reviews reset for revision ' + str(state['revision_count']) + ' (plan v' + str(state['version']) + ')')
"
}

show_status() {
  _resolve_state
  if [ ! -f "$STATEFILE" ]; then
    echo "❌ No pipeline state."
    exit 1
  fi
  
  python3 -c "
import json
with open('$STATEFILE') as f: state = json.load(f)
print(f\"📋 Pipeline: {state['project']} (v{state['version']}, revision {state['revision_count']}/{state['max_revisions']})\")
print('─' * 50)
order = ['discovery','planner','review_correctness','review_architecture','review_feasibility','meta','user_confirm','coder','ci','code_review','merge_confirm','merge']
for step in order:
    info = state['steps'].get(step, {})
    status = info.get('status', 'pending')
    verdict = info.get('verdict')
    icon = '✅' if status == 'done' else '⏳'
    v = f' ({verdict})' if verdict else ''
    print(f'  {icon} {step}{v}')
"
}

case "${1:-}" in
  init) init "${2:?project name required}" ;;
  complete) complete "${2:?step name required}" "${3:-}" ;;
  gate) gate "${2:?step name required}" ;;
  status) show_status ;;
  reset) reset_reviews ;;
  *) echo "Usage: $0 {init|complete|gate|status|reset} [args]"; exit 1 ;;
esac
