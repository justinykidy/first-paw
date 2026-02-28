# 🐱 first-paw

캣과 저스틴의 첫 번째 프로젝트.

## Agent System

이 프로젝트는 AI 에이전트 스웜으로 개발됩니다:

- **캣 (Orchestrator)** — 작업 분배, 프롬프트 작성, 진행 모니터링
- **Codex (gpt-5.3-codex)** — 백엔드, 복잡한 로직, 멀티파일 리팩토링
- **Claude Code** — 프론트엔드, git 작업, 빠른 수정
- **Gemini Code Assist** — 자동 PR 리뷰 (GitHub App)

## Workflow

1. 저스틴이 캣에게 작업 요청
2. 캣이 복잡도 판단 → 적절한 에이전트 spawn
3. 에이전트가 worktree에서 작업 → PR 생성
4. CI + 코드 리뷰 자동 실행
5. 저스틴이 최종 확인 → merge
