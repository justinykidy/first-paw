# Planning Loop — 자동 리비전 프로세스

## 핵심 규칙
**리비전 3회까지는 100% 자동. 저스틴에게 묻지 마. 중간 보고도 하지 마.**

## 플로우

```
Meta Reviewer verdict = REVISE or REJECT
  │
  ├─ $PG reset
  │   → 리비전 카운터 +1
  │   → 리뷰 단계 (review_*, meta, user_confirm) 리셋
  │
  ├─ Planner 재실행 (별도 세션)
  │   → 입력: Meta Review 피드백 (변경 지시사항만)
  │   → 출력: plan-v{N+1}.md (변경 섹션만 수정, 나머지 유지)
  │   → $PG complete planner
  │
  ├─ 3 리뷰어 병렬 재실행
  │   → 변경된 섹션의 diff + 전체 플랜 전달
  │   → 각각 review-{type}-v{N+1}.md 출력
  │   → $PG complete review_correctness <verdict>
  │   → $PG complete review_architecture <verdict>
  │   → $PG complete review_feasibility <verdict>
  │
  ├─ Meta Reviewer 재실행
  │   → 플랜 v{N+1} + 3개 리뷰 v{N+1} 입력
  │   → meta-review-v{N+1}.md 출력
  │   → $PG complete meta <verdict>
  │
  └─ verdict 체크
      ├─ APPROVE → $PG gate user_confirm → 저스틴에게 플랜 보고
      ├─ REVISE → 이 루프 반복 (revision_count <= 3)
      └─ REJECT → 이 루프 반복 (revision_count <= 3)
```

## 리비전 3회 초과 시

```
$PG reset → ❌ "Max revisions reached"
  │
  └─ 저스틴에게 에스컬레이션:
      - 미해결 이슈 목록
      - 각 리뷰어의 최신 의견
      - 리비전 히스토리 (v1→v2→v3→v4에서 뭐가 바뀌었는지)
      - 제안: "이 부분을 직접 결정해주면 진행할 수 있어"
```

## ❌ 절대 하면 안 되는 것

1. "고쳤으니 리뷰어 스킵해도 되겠지" → **무조건 리뷰어 재실행**
2. 리비전 중간에 저스틴에게 보고 → **최종 결과만 보고**
3. `$PG gate user_confirm`이 fail인데 저스틴에게 플랜 보여주기
4. Planner와 Meta Reviewer를 같은 세션에서 실행
5. 리뷰어끼리 서로의 피드백을 보게 하기

## 효율 관리

- 리비전 시 **전체 플랜 재전송 ❌** → 변경 섹션 + diff만 전달
- 리뷰어에게도 "이전 리뷰 vs 변경사항" 형태로 전달
- Meta Reviewer에게는 항상 전체 컨텍스트 (플랜 + 3리뷰) 전달
