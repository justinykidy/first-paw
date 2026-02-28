#!/bin/bash
# restart-agent.sh — 실패한 에이전트 재시작
# Usage: restart-agent.sh <id> <project> <branch> <agent-type> <prompt-file> <tmux-session> [ci-fix]
set -euo pipefail

ID="$1"
PROJECT="$2"
BRANCH="$3"
AGENT="$4"
PROMPT_FILE="$5"
TMUX_SESS="$6"
MODE="${7:-restart}"  # "restart" or "ci-fix"

CLAWDBOT_DIR="${CLAWDBOT_DIR:-$HOME/.openclaw/workspace/.clawdbot}"
WORKTREE_DIR="$HOME/${PROJECT}-worktrees/$BRANCH"

# Kill old tmux session if exists
tmux kill-session -t "$TMUX_SESS" 2>/dev/null || true

# Ensure worktree exists
if [ ! -d "$WORKTREE_DIR" ]; then
  cd "$HOME/$PROJECT"
  git worktree add -B "$BRANCH" "$WORKTREE_DIR" main 2>/dev/null || true
fi

# Build prompt
if [ "$MODE" = "ci-fix" ]; then
  CI_LOG="$CLAWDBOT_DIR/pipeline/ci-failure-$ID.log"
  EXTRA_CONTEXT=""
  if [ -f "$CI_LOG" ]; then
    EXTRA_CONTEXT="CI failed. Error log: cat $CI_LOG — Fix the issues, then commit and push."
  fi
  
  case "$AGENT" in
    codex)
      CMD="cd $WORKTREE_DIR && codex --model gpt-5.3-codex --dangerously-bypass-approvals-and-sandbox \"$EXTRA_CONTEXT Read your original task: cat $PROMPT_FILE — Fix CI failures, commit, push.\""
      ;;
    claude)
      CMD="cd $WORKTREE_DIR && claude --dangerously-skip-permissions -p \"$EXTRA_CONTEXT Read your original task: cat $PROMPT_FILE — Fix CI failures, commit, push.\""
      ;;
  esac
else
  case "$AGENT" in
    codex)
      CMD="cd $WORKTREE_DIR && codex --model gpt-5.3-codex --dangerously-bypass-approvals-and-sandbox \"Read your role: cat $CLAWDBOT_DIR/roles/coder.md — Read your task: cat $PROMPT_FILE — Execute the plan. When done: git add -A && git commit -m 'feat: implement task' && git push origin $BRANCH && gh pr create --base main --head $BRANCH --fill && openclaw system event --text 'Done: $ID' --mode now\""
      ;;
    claude)
      CMD="cd $WORKTREE_DIR && claude --dangerously-skip-permissions -p \"Read your role: cat $CLAWDBOT_DIR/roles/coder.md — Read your task: cat $PROMPT_FILE — Execute the plan. When done: git add -A && git commit -m 'feat: implement task' && git push origin $BRANCH && gh pr create --base main --head $BRANCH --fill && openclaw system event --text 'Done: $ID' --mode now\""
      ;;
  esac
fi

# Start in tmux
tmux new-session -d -s "$TMUX_SESS" "$CMD"
echo "✅ Restarted $ID ($AGENT) in tmux:$TMUX_SESS [mode=$MODE]"
