#!/bin/bash
# select-agent.sh — 작업 유형에 따라 에이전트 자동 선택
# Usage: select-agent.sh <task-description>
# Output: agent type (codex|claude|gemini-then-claude)

DESC="$*"

# Pattern matching for agent selection
if echo "$DESC" | grep -qiE 'UI|frontend|component|CSS|style|layout|design|beautiful|pretty'; then
  if echo "$DESC" | grep -qiE 'beautiful|design|pretty|aesthetic'; then
    echo "gemini-then-claude"  # Gemini designs, Claude implements
  else
    echo "claude"
  fi
elif echo "$DESC" | grep -qiE 'backend|API|database|logic|algorithm|refactor|migration|complex|multi.?file'; then
  echo "codex"
elif echo "$DESC" | grep -qiE 'bug|fix|error|crash|broken'; then
  echo "codex"
elif echo "$DESC" | grep -qiE 'simple|typo|rename|config|env|one.?line'; then
  echo "direct"  # Cat handles directly
else
  echo "codex"  # Default: codex handles 90%
fi
