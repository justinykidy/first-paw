# WORKFLOW.md — 코딩 작업 프로세스 (시스템화 버전)

**이 파일은 코딩 작업이 들어올 때마다 반드시 읽고 따라야 하는 규칙.**
**한 단계도 건너뛰지 마. 내 "판단"으로 스킵하거나 변경하지 마.**
**모든 분기는 측정 가능한 조건으로 결정된다. 주관적 판단 = 규칙 위반.**

---

## ⚠️ 최상위 규칙 (이 파일의 모든 것보다 우선)

1. **모든 코딩 작업은 예외 없이 전체 파이프라인을 거친다.**
   - "단순해 보이는" 작업도 파이프라인을 거친다.
   - 유일한 예외: 저스틴이 **명시적으로** "파이프라인 스킵해" 또는 "직접 고쳐"라고 말한 경우.
   - 캣이 스스로 "이건 단순하니까 스킵해도 되겠지"라고 판단하는 것은 **금지**.

2. **에이전트 선택은 규칙 테이블을 따른다. 캣의 감으로 고르지 않는다.**

3. **모든 단계 전환은 `pipeline-gate.sh`가 허락해야 한다. exit 0이 아니면 멈춘다.**

4. **저스틴이 컨펌해야만 넘어가는 단계가 2개 있다: 플랜 컨펌(1-6), 머지 컨펌(6단계). 이 2개는 자동화 불가.**

5. **그 외 모든 단계는 100% 자동. 저스틴에게 중간 질문 금지. 실패하면 규칙대로 처리.**

---

## ⚠️ 에이전트 통신 규칙 (MANDATORY)

**모든 에이전트 간 소통은 파일을 통해서만 한다. 인라인 프롬프트에 플랜/리뷰 내용을 넣지 마.**

- **역할 정의:** `.clawdbot/roles/{role}.md` — 에이전트에게 역할 파일 읽게 함
- **파이프라인 데이터:** `.clawdbot/pipeline/{project}/` — 플랜, 리뷰, 프롬프트 전부 여기
- **에이전트 프롬프트는 3줄:** (1) 역할 파일 읽어 (2) 입력 파일 읽어 (3) 출력 파일에 써
- **구조:** `.clawdbot/templates/pipeline-structure.md` 참조
- **/tmp 사용 금지** — 추적 안 되고 세션 끝나면 사라짐

---

## ⚠️ 파이프라인 게이트 시스템 (MANDATORY)

**모든 작업은 `pipeline-gate.sh`를 통해 상태를 추적한다. 예외 없음.**

```bash
PG="$HOME/.openclaw/workspace/pipeline-gate.sh"

$PG init "<project-name>"           # 프로젝트 시작
$PG complete <step> [verdict]       # 단계 완료 기록
$PG gate <step>                     # 진행 가능 체크 (exit 0 = OK)
$PG status                          # 현재 상태
$PG reset                           # 리비전 루프용 리셋
```

**규칙:**
- `$PG gate <step>`이 exit 0 아니면 → **멈춘다. 예외 없음.**
- `$PG complete <step>` 호출 없이 다음 단계로 → **금지. 예외 없음.**
- meta verdict가 APPROVE가 아니면 user_confirm 게이트 자동 블로킹.
- 리비전 3회 초과 → 자동 블로킹 → 저스틴에게 에스컬레이션.

---

## 1단계: 요구사항 구체화 (Discovery)

**파이프라인 시작. `$PG init <project>` 실행.**

저스틴한테 아래 질문을 **전부** 한다. "해당 안 되는 것 같으니 스킵"하지 마. 저스틴이 "몰라" / "알아서 해"라고 하면 그 항목은 캣이 기본값을 정해서 기록하고 넘어간다.

| # | 질문 | 기본값 (저스틴이 안 정하면) |
|---|------|--------------------------|
| 1 | 뭘 만드는 건지 (한 줄 정의) | — (필수, 기본값 없음) |
| 2 | 누가 쓰는 건지 | 저스틴 본인용 |
| 3 | MVP 범위 (반드시 들어갈 것 / 나중에 할 것) | 전부 MVP |
| 4 | 기술 스택 | 웹=HTML+JS+CSS, 백엔드=Node.js |
| 5 | 새 프로젝트 vs 기존 프로젝트에 추가 | first-paw에 추가 |
| 6 | 외부 의존성 (API, DB 등) | 없음 |
| 7 | 배포 환경 | GitHub Pages (정적) |
| 8 | 우선순위 (속도 vs 품질) | 품질 |

- 저스틴이 "시작해" / "ㅇㅋ" / "됐어" 하면 → `$PG complete discovery` → 다음 단계.
- 저스틴의 답변을 `.clawdbot/pipeline/{project}/requirements.md`에 **그대로** 기록.

---

## 2단계: 플래닝 (Planner)

`$PG gate planner` → exit 0이면 진행.

### 2-1. Planner 실행 (Claude Opus)
- 별도 세션에서 실행 (sessions_spawn, runtime=subagent 또는 ACP)
- 입력: `.clawdbot/pipeline/{project}/requirements.md`
- 출력: `.clawdbot/pipeline/{project}/plan-v{N}.md`
- 템플릿: `.clawdbot/templates/plan.md` 형식 **필수**
- 완료 → `$PG complete planner`

### 2-2. 3중 병렬 리뷰
`$PG gate review_correctness` → exit 0이면 진행.

**3개를 동시에 spawn한다. 순서 없음. 서로 못 봄.**

| 리뷰어 | 실행 방법 | 입력 | 출력 | 타임아웃 |
|--------|----------|------|------|---------|
| Correctness | `codex --model gpt-5.3-codex` in tmux | plan-v{N}.md | review-correctness-v{N}.md | 5분 |
| Architecture | `gemini` in tmux | plan-v{N}.md | review-architecture-v{N}.md | 5분 |
| Feasibility | `claude -p` | plan-v{N}.md | review-feasibility-v{N}.md | 5분 |

- 타임아웃 초과 → 해당 리뷰 스킵, Meta Reviewer에게 "X 리뷰어 타임아웃" 명시.
- 완료 시 각각:
  - `$PG complete review_correctness <verdict>`
  - `$PG complete review_architecture <verdict>`
  - `$PG complete review_feasibility <verdict>`

### 2-3. Meta Reviewer
`$PG gate meta` → exit 0이면 진행.

- **반드시 Planner와 별도 세션.** 같은 세션 금지.
- 입력: plan-v{N}.md + 3개 리뷰 파일
- 출력: meta-review-v{N}.md
- verdict → `$PG complete meta <verdict>`

### 2-4. 자동 리비전 루프

```
meta verdict가 APPROVE가 아닌 경우:
  1. $PG reset (리비전 카운터 +1)
  2. reset이 실패하면 (3회 초과) → 저스틴에게 에스컬레이션. 멈춤.
  3. Planner 재실행 (meta 피드백 기반, 변경 섹션만)
  4. $PG complete planner
  5. 3 리뷰어 재실행
  6. Meta 재실행
  7. APPROVE면 → 2-5로. 아니면 → 1번으로 돌아감.
```

**이 루프 중에 저스틴에게 연락하지 않는다. 최종 결과만 보고한다.**

### 2-5. 플랜 컨펌 (저스틴 필수)
`$PG gate user_confirm` → exit 0이면 진행.

저스틴에게 **반드시** 아래 내용을 보낸다:

```
📋 플랜 완료 — {project}

뭘 만드는지: {한 줄}
파일 구조: {목록}
리비전 횟수: {N}회
리뷰어 합의:
  - Correctness: {verdict} — {주요 이슈 or "이슈 없음"}
  - Architecture: {verdict} — {주요 이슈 or "이슈 없음"}  
  - Feasibility: {verdict} — {주요 이슈 or "이슈 없음"}
리스크: {요약}
예상 규모: 파일 {N}개, 예상 {N}분

진행할까?
```

- 저스틴 "ㅇㅋ" / "진행해" → `$PG complete user_confirm` → 3단계로.
- 저스틴 수정 요청 → Planner에게 전달, 리뷰 루프 **재실행** (스킵 금지).
- 저스틴 "다시 해" → `$PG init` 부터 재시작.

---

## 3단계: 코더 에이전트

`$PG gate coder` → exit 0이면 진행.

### 3-1. 에이전트 선택 (규칙 기반 — 캣 판단 금지)

아래 테이블을 **위에서 아래로** 순서대로 매칭한다. 첫 번째로 매칭되는 규칙을 사용.

| 순서 | 조건 (plan의 내용 기반) | 에이전트 | 이유 |
|------|----------------------|---------|------|
| 1 | 저스틴이 에이전트를 지정한 경우 | 저스틴이 말한 것 | 사용자 명시 |
| 2 | plan의 files에 .html, .css, .svg만 있고 .js/.ts 없음 | gemini → claude 체인 | Gemini 디자인 + Claude 구현 |
| 3 | plan의 files에 .tsx, .jsx, .vue, .svelte 포함 | claude | 프론트엔드 |
| 4 | 나머지 전부 | codex | 기본값 (90% 여기) |

**이 테이블에 없는 판단은 할 수 없다. 애매하면 codex.**

### 3-2. 실행

```bash
# 1. worktree 생성
cd ~/first-paw
git worktree add -b feat/{project} ~/first-paw-worktrees/feat-{project} main

# 2. coder-prompt.md 생성 (plan에서 implementation_steps 추출)
# → .clawdbot/pipeline/{project}/coder-prompt.md

# 3. task-manager.sh에 등록
bash .clawdbot/task-manager.sh add {task-id} first-paw feat/{project} {tmux-session} {agent} {prompt-file}

# 4. tmux에서 에이전트 실행
tmux new-session -d -s {tmux-session} "cd ~/first-paw-worktrees/feat-{project} && {agent-command}"
```

에이전트 프롬프트에 **반드시** 포함:
1. 역할 파일 읽기: `cat .clawdbot/roles/coder.md`
2. 태스크 파일 읽기: `cat .clawdbot/pipeline/{project}/coder-prompt.md`
3. 완료 후: `git add -A && git commit && git push && gh pr create && openclaw system event --text "Done: {id}" --mode now`

완료 → `$PG complete coder`

### 3-3. 모니터링 (자동 — cron이 처리)

monitor.sh가 10분마다:
- tmux 세션 확인
- 죽었으면 PR 있는지 확인
- PR 없으면 자동 재시작 (최대 3회)
- 3회 초과 → 저스틴에게 알림

**캣이 수동으로 모니터링하지 않는다. cron이 한다.**

### 3-4. 코더 완료 보고

에이전트가 끝나면 (system event 수신 또는 monitor가 감지) 저스틴에게:

```
🔨 코딩 완료 — {project}
PR: {링크}
CI 돌리고 리뷰 진입합니다.
```

---

## 4단계: CI

`$PG gate ci` → exit 0이면 진행.

```bash
# CI 상태 확인 (최대 10분 대기, 30초 간격)
for i in $(seq 1 20); do
  STATUS=$(gh pr checks {PR#} --repo justinykidy/first-paw 2>&1)
  if echo "$STATUS" | grep -q "pass"; then
    break
  elif echo "$STATUS" | grep -q "fail"; then
    # CI 실패 → 자동 수정 에이전트 spawn
    # 실패 로그 수집 → restart-agent.sh ci-fix 모드
    break
  fi
  sleep 30
done
```

- CI 통과 → `$PG complete ci`
- CI 실패 → 자동 수정 에이전트 (최대 3회). 3회 초과 → 저스틴에게 알림. 멈춤.

---

## 5단계: 코드 리뷰 (3중 — 전부 완료 대기 필수)

`$PG gate code_review` → exit 0이면 진행.

**auto-review.sh가 실행한다. 3개를 동시에 트리거.**

| 리뷰어 | 방법 | 초점 |
|--------|------|------|
| Codex | codex CLI로 diff 리뷰 → gh pr review | 로직 오류, 엣지 케이스, 에러 핸들링 |
| Claude | claude CLI로 diff 리뷰 → gh pr review | critical 이슈만 (검증 역할) |
| Gemini | `@gemini-code-assist review` 코멘트 | 보안, 확장성 |

**3개 전부 도착할 때까지 대기. 1-2개만 오고 다음으로 넘어가는 것은 금지.**

리뷰 결과 처리:
| 조건 | 행동 |
|------|------|
| critical 또는 warning 이슈 존재 | 수정 에이전트 spawn (3개 리뷰 이슈 전부 종합) → 수정 → 푸시 → CI 재확인 |
| suggestion만 존재 | 수정 없이 다음 단계 |
| 이슈 없음 | 다음 단계 |

수정 에이전트 최대 2회. 2회 후에도 critical 남으면 → 저스틴에게 알림. 멈춤.

완료 → `$PG complete code_review`

---

## 6단계: 머지 컨펌 (저스틴 필수)

`$PG gate merge_confirm` → exit 0이면 진행.

저스틴에게 **반드시** 아래 내용을 보낸다:

```
✅ PR 준비 완료 — {project}

PR: {링크}
변경: {뭘 만들었는지 한 줄}
파일: {목록} ({+N}줄 / {-N}줄)
CI: ✅ 통과
리뷰:
  - Codex: {통과/이슈 N개 수정됨}
  - Claude: {통과/이슈 N개 수정됨}
  - Gemini: {통과/이슈 N개 수정됨}
남은 suggestion: {있으면 목록}
테스트: {URL 또는 명령}
스크린샷: {UI 변경이면 첨부}

머지해도 될까?
```

- 저스틴 "ㅇㅋ" / "머지해" → `$PG complete merge_confirm` → 7단계.
- 저스틴 수정 요청 → 수정 에이전트 → 수정 → CI → 리뷰 → 다시 6단계.

---

## 7단계: 머지 & 정리

`$PG gate merge` → exit 0이면 진행.

```bash
gh pr merge {PR#} --repo justinykidy/first-paw --squash --delete-branch
```

정리:
```bash
git worktree remove ~/first-paw-worktrees/feat-{project} --force
bash .clawdbot/task-manager.sh update {task-id} merged
bash .clawdbot/record-success.sh {task-id} first-paw {PR#}
```

`$PG complete merge`

---

## 자기 개선 루프 (Ralph Loop V2)

**실패 시 (에이전트 3회 재시도 소진, CI 3회 실패 등):**
```bash
bash .clawdbot/learn-from-failure.sh {task-id} {project}
```
→ 실패 원인 분석 → 개선 프롬프트 생성 → learned-patterns.json에 기록

**성공 시 (머지 완료):**
```bash
bash .clawdbot/record-success.sh {task-id} {project} {PR#}
```
→ 성공 패턴 기록

이 데이터는 다음 작업의 에이전트 프롬프트에 반영된다:
- learned-patterns.json에서 같은 유형의 과거 실패를 찾아 "이건 하지 마" 지시에 포함.

---

## 세션 격리 규칙 (변경 불가)

| 에이전트 | 볼 수 있는 것 | 볼 수 없는 것 |
|---------|-------------|-------------|
| Planner | requirements.md, 이전 Meta 피드백 | 개별 리뷰어 피드백 |
| Correctness | plan-v{N}.md | 다른 리뷰어 |
| Architecture | plan-v{N}.md + 코드베이스 | 다른 리뷰어 |
| Feasibility | plan-v{N}.md | 다른 리뷰어 |
| Meta Reviewer | plan + 3개 리뷰 전부 | — |
| Coder | coder-prompt.md (확정 플랜 기반) | 리뷰 내용 |

---

## 에러 핸들링 (규칙 기반 — 판단 금지)

| 상황 | 행동 | 저스틴 알림 |
|------|------|-----------|
| 리뷰어 API 실패 | 1회 재시도 → 실패 시 스킵, Meta에 명시 | ❌ |
| 리뷰어 출력 파싱 실패 | JSON 재요청 1회 → raw 텍스트로 Meta에 전달 | ❌ |
| 리비전 3회 초과 | 멈춤 | ✅ 미해결 이슈 목록 |
| 에이전트 3회 재시도 소진 | 멈춤 + learn-from-failure.sh | ✅ 실패 보고 |
| CI 3회 실패 | 멈춤 + learn-from-failure.sh | ✅ 실패 로그 |
| 코드 리뷰 2회 수정 후에도 critical | 멈춤 | ✅ 남은 이슈 목록 |
| Planner 템플릿 미준수 | 재생성 1회 → 실패 시 부분 플랜으로 진행 | ❌ |

**"멈춤"은 진짜 멈추는 것. 다음 단계로 넘어가지 않는다.**

---

## 레포 정보
- **first-paw**: https://github.com/justinykidy/first-paw
  - worktree 경로: `/home/nearjustino/first-paw-worktrees/<branch-name>`
  - 메인 레포: `/home/nearjustino/first-paw`

---

## 금지 목록 (이것들을 하면 규칙 위반)

1. ❌ "이건 단순하니까 파이프라인 스킵" (저스틴 명시 없이)
2. ❌ "이 리뷰어는 스킵해도 될 것 같아"
3. ❌ "CI 한번 더 돌려볼까" (규칙: 3회까지 자동, 그 후 멈춤)
4. ❌ "저스틴한테 중간에 물어보자" (컨펌 포인트 2개 외에는 금지)
5. ❌ "에이전트 타입을 내 감으로 고르자" (테이블 따라감)
6. ❌ "리비전 루프 중인데 저스틴한테 보고하자" (최종 결과만)
7. ❌ "gate가 fail인데 일단 진행하자"
8. ❌ "$PG complete 안 하고 다음 단계로"
9. ❌ "저스틴 컨펌 없이 머지"
10. ❌ "/tmp에 파이프라인 데이터 저장"
