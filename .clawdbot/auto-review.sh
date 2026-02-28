#!/bin/bash
# auto-review.sh — PR에 3중 AI 코드 리뷰 트리거
# Usage: auto-review.sh <project> <pr-number> <task-id>
set -euo pipefail

PROJECT="$1"
PR="$2"
TASK_ID="$3"
REPO="justinykidy/$PROJECT"
CLAWDBOT_DIR="${CLAWDBOT_DIR:-$HOME/.openclaw/workspace/.clawdbot}"
TASKS_FILE="$CLAWDBOT_DIR/active-tasks.json"
PIPELINE_DIR="$CLAWDBOT_DIR/pipeline"

mkdir -p "$PIPELINE_DIR"

# Get PR diff
DIFF=$(gh pr diff "$PR" --repo "$REPO" 2>/dev/null)
echo "$DIFF" > "$PIPELINE_DIR/pr-diff-$TASK_ID.txt"

update_review_status() {
  local reviewer="$1" status="$2"
  python3 -c "
import json
with open('$TASKS_FILE') as f: data = json.load(f)
for t in data['tasks']:
    if t['id'] == '$TASK_ID':
        if 'review_status' not in t: t['review_status'] = {}
        t['review_status']['$reviewer'] = '$status'
        break
with open('$TASKS_FILE','w') as f: json.dump(data, f, indent=2)"
}

# --- 1. Codex Reviewer ---
(
  SCRATCH=$(mktemp -d)
  cd "$SCRATCH" && git init -q
  REVIEW=$(codex --model gpt-5.3-codex -q "You are a code reviewer. Review this PR diff for logic errors, edge cases, missing error handling, security issues. Be concise. Focus on bugs that will actually break things.

DIFF:
$DIFF

Output your review in markdown." 2>/dev/null || echo "REVIEW_FAILED")
  
  if [ "$REVIEW" != "REVIEW_FAILED" ]; then
    gh pr review "$PR" --repo "$REPO" --comment --body "## 🔍 Codex Review

$REVIEW" 2>/dev/null
    update_review_status "codex" "done"
  else
    update_review_status "codex" "skipped"
  fi
  rm -rf "$SCRATCH"
) &
CODEX_PID=$!

# --- 2. Claude Code Reviewer ---
(
  REVIEW=$(claude -p "You are a code reviewer. Review this PR diff. Focus on critical issues only — logic bugs, security holes, missing error handling. Skip style nitpicks.

DIFF:
$DIFF

Output your review in markdown." 2>/dev/null || echo "REVIEW_FAILED")
  
  if [ "$REVIEW" != "REVIEW_FAILED" ]; then
    gh pr review "$PR" --repo "$REPO" --comment --body "## 🔍 Claude Review

$REVIEW" 2>/dev/null
    update_review_status "claude" "done"
  else
    update_review_status "claude" "skipped"
  fi
) &
CLAUDE_PID=$!

# --- 3. Gemini Code Assist ---
(
  gh pr comment "$PR" --repo "$REPO" --body "@gemini-code-assist review" 2>/dev/null
  update_review_status "gemini" "done"
) &
GEMINI_PID=$!

# Wait for all reviewers
wait $CODEX_PID 2>/dev/null || true
wait $CLAUDE_PID 2>/dev/null || true
wait $GEMINI_PID 2>/dev/null || true

echo "✅ All reviews triggered for PR #$PR ($TASK_ID)"
