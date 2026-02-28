# Pipeline Directory Structure

프로젝트마다 이 구조를 따른다. 모든 에이전트 통신은 파일을 통해서만 한다.

```
.clawdbot/pipeline/{project-name}/
├── requirements.md              ← 캣이 저스틴과 대화 후 작성
├── plan-v1.md                   ← Planner 출력
├── plan-v2.md                   ← Planner 리비전 (있으면)
├── review-correctness-v1.md     ← Correctness Reviewer 출력
├── review-architecture-v1.md    ← Architecture Reviewer 출력
├── review-feasibility-v1.md     ← Feasibility Reviewer 출력
├── meta-review-v1.md            ← Meta Reviewer 출력
├── review-correctness-v2.md     ← 리비전 후 재리뷰 (있으면)
├── review-architecture-v2.md
├── review-feasibility-v2.md
├── meta-review-v2.md
├── coder-prompt.md              ← 확정 플랜 기반 코더 지시서
├── pr-diff.txt                  ← PR diff (코드 리뷰용)
├── code-review-codex.md         ← Codex 코드 리뷰
├── code-review-claude.md        ← Claude 코드 리뷰
├── code-review-gemini.md        ← Gemini 코드 리뷰
└── fix-prompt.md                ← 리뷰 이슈 기반 수정 지시서 (있으면)
```

## 에이전트 호출 패턴

```bash
# 에이전트에게 넘길 때: 역할 파일 + 입력 파일 경로만 전달
codex --model gpt-5.3-codex --dangerously-bypass-approvals-and-sandbox \
  "Read your role: cat .clawdbot/roles/reviewer-correctness.md
   Read the plan: cat .clawdbot/pipeline/{project}/plan-v1.md
   Write your review to: .clawdbot/pipeline/{project}/review-correctness-v1.md
   When done: openclaw system event --text 'Done: review-correctness' --mode now"
```

## 핵심 원칙
1. **모든 입력/출력은 파일** — 인라인 프롬프트에 플랜 전체를 넣지 마
2. **역할은 roles/ 파일로** — 매번 역할 설명을 인라인으로 쓰지 마
3. **결과는 pipeline/{project}/에** — /tmp 사용 금지
4. **에이전트 프롬프트는 3줄** — 역할 파일 읽어, 입력 파일 읽어, 출력 파일에 써
