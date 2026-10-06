# 진단 절차: 후보 스캔과 IP 진단(①→③→②)

## 목차
1. 후보 스캔(`ip-scan`)
2. 1차 진단(`ip-diagnosis`, round 1)
3. 2차 진단(내부 지표 추가, round 2)
4. 부분 재실행
5. 워크플로 없이 실행할 때

---

## 1. 후보 스캔 — 실행 모드: 워크플로 조율

**언제:** "어떤 IP부터 볼까", "후보 골라줘", "포트폴리오 훑어줘"

1. **목록 확정(메인).** 사용자가 후보를 주면 그대로 쓴다. 조건만 주면(예: "확장 전인 카카오페이지 판타지 IP") `ent-researcher`를 한 번 불러 후보 이름 목록만 받는다. 대형 성공작, 확장 중, 확장 전 IP를 섞는다.
2. **규모 확인.** 후보 하나에 에이전트 2명(카드·심사)이 들고, 마지막 순위 1명이 더 든다. 기본 상한은 10개(약 21명)다. 사용자가 "전수", "포트폴리오 전체"를 말했을 때만 늘리고, 실행 전에 후보 수와 에이전트 수를 알린다.
3. **실행.**
   ```
   Workflow(scriptPath: ".claude/skills/ip-ops-harness/workflows/ip-scan.js",
            args: { items: [{ title: "...", hint: "..." }], today: "{기준일}", take: 3, criteria: "{사용자 조건}" })
   ```
   호출 결과의 실행 id를 `_workspace/scan/{YYYYMMDD}/scan.meta.json`에 적는다.
4. **저장과 보고.** 반환값을 `_workspace/scan/{YYYYMMDD}/scan_result.json`에 저장한다. 사용자에게 `rank.picks`(고른 이유), `benchmarks`(기준점으로 둔 후보), 후보별 우선순위 표, 누락 수를 보인다.
5. **사람의 결정.** 심층 진단에 올릴 후보는 사람(스토리 사업 책임자)이 정한다. 사용자의 선택을 `_workspace/scan/{YYYYMMDD}/decision.md`에 발언 그대로 적는다.

## 2. 1차 진단 — 실행 모드: 워크플로 조율

**언제:** "이 IP 진단해줘", "투자할 만해?", "확장 가능성 판단해줘"(IP가 정해져 있을 때)

### 2-1. 사전 확인(메인)
- IP 정식 이름과 슬러그를 정한다. 카카오엔터 원천인지 모르면 사용자에게 확인하거나 리서처 결과를 보고 판단한다.
- 같은 IP의 기존 판정을 `ledger.py show --ip {slug}`로 본다.
- 내부 지표 사용 여부(`internal`)는 **둘 다** 맞을 때만 `true`다: `policy/data-approval.md`의 `상태: 승인`·`외부 AI 전송: 허용`, 그리고 `_workspace/00_input/internal/{slug}/` 폴더가 있다. 메인은 CSV를 열지 않고 폴더가 있는지만 본다.

### 2-2. 실행
```
Workflow(scriptPath: ".claude/skills/ip-ops-harness/workflows/ip-diagnosis.js",
         args: { ips: [{ slug: "goedam-chulgeun", title: "괴담에 떨어져도 출근을 해야 하는구나", internal: false }],
                 round: 1, today: "{기준일}", depth: "standard" })
```
- 실행 직후 `_workspace/ips/runs/diagnosis_r1_{YYYYMMDD-HHMM}.meta.json`에 `{ runId, args, started }`를 적는다.
- IP 여러 개는 `ips`에 함께 넣는다. 파이프라인이라 IP끼리 서로 기다리지 않는다.

### 2-3. 규모
| depth | 검증 묶음 | IP 하나당 에이전트(주장 36개 기준) |
| --- | --- | --- |
| standard(기본) | 12개씩, 관점 1개 | 신호 1~2 + 분석 3 + 주장 1 + 검증 3 + 판정 1 + 판정서 2~4 ≈ 11~14 |
| thorough("철저히") | 8개씩, 관점 2개(출처·숫자 / 논리·반대 근거) | ≈ 16~19 |

### 2-4. 완료 뒤(메인)
알림을 받기 전에 결과를 단정하지 않는다.
1. 반환값을 `_workspace/ips/runs/diagnosis_r1_{YYYYMMDD-HHMM}.json`에 저장한다(실행 id를 `run_id`로 넣는다).
2. IP마다 `review`·`first_review`를 `_workspace/ips/{ip}/r1/41_reviewer_check.json`에 저장한다.
3. 원장에 기록한다. 시작부터 완료까지의 벽시계 분을 `--minutes`로 넣는다(IP를 동시에 진행했으면 IP마다 같은 값이다. 보고할 때 그렇게 밝힌다).
   ```bash
   python3 .claude/skills/ip-ops-harness/scripts/ledger.py --today {기준일} add-verdicts \
     --file _workspace/ips/runs/diagnosis_r1_{...}.json --minutes {분}
   ```
4. 판정서를 `deliverables/판정서_{IP명}_1차_{YYYYMMDD}.md`로 복사한다. 최종 검토가 `수정 필요`면 복사하되 사용자에게 남은 지적을 그대로 보인다.
5. `missingIps`, `missing_analyses`, `verifier_failures`가 있으면 보고에 적는다.
6. 사용자에게 보고한다: 한 줄 판정(그대로), 포맷별 판정 표, 심사 결과(통과·조건부·기각 수와 검증자 제안 대비 바꾼 수), 판정 회의에서 정할 것(판정서 1절), 누락. 판정 회의가 끝나면 결과를 알려 달라고 덧붙인다.

## 3. 2차 진단 — 내부 지표 추가

1차와 같은 절차에 아래만 다르다.
- `round: 2`, IP마다 `internal: true`, `priorVerdict: "_workspace/ips/{ip}/r1/31_judge_verdict.md"`
- 리서처는 1차 신호 카드를 읽고 바뀐 공개 수치만 갱신한다. 분석가는 1차 분석을 읽고 새 근거로 바뀌는 칸만 고친다.
- 판정문의 「판정 변경」과 판정서 10절에 1차 대비 바뀐 칸이 나온다. `ledger.py report`의 "1차와 2차 판정이 달라진 포맷"이 이 값을 센다.
- 내부 신호 에이전트가 승인 확인에서 거부되면 워크플로는 공개 자료만으로 진행한다. 이 경우 2차 판정이라 부르지 말고 사용자에게 다시 실행할지 묻는다.

## 4. 부분 재실행

| 요청 예 | 할 일 |
| --- | --- |
| "글로벌 분석만 다시, 일본 쪽 보강" | ① 기존 `21_global_fit.md`를 `r{n}/_prev_{YYYYMMDD-HHMM}/`로 복사 ② `Agent(subagent_type: "global-fit-analyst")`에 기존 파일과 피드백을 주고 같은 경로를 고치게 한다 ③ 판정이 바뀌어야 하면 `ip-diagnosis`를 `from: "claims"`로 실행 |
| "권리 법무 답변 들어왔어, 판정 다시" | 법무 답변을 `_workspace/00_input/legal_{ip}_{YYYYMMDD}.md`에 저장 → `rights-revenue-analyst`로 `22`를 갱신 → `from: "claims"` |
| "신호부터 다시"(새 공개 자료) | 0단계 표대로 `r{n}/`을 옮기고 `from: "signals"`(기본)로 새로 실행 |
| "판정서만 다시 써줘" | `verdict-writer`를 서브에이전트로 부른다(기존 판정서·판정문·피드백). 이어서 `dossier-reviewer`로 검토한다. 원장은 바뀌지 않는다 |
| 워크플로가 중간에 멈춤 | `meta.json`의 `runId`로 `resumeFromRunId`. 같은 프롬프트의 `agent()`는 캐시를 쓴다 |

`from: "claims"`나 `"analyses"`로 실행하기 전에, 덮어쓸 30·31·40 파일을 `r{n}/_prev_{YYYYMMDD-HHMM}/`로 복사한다. 원장에는 새 판정이 같은 id의 새 버전(같은 날) 또는 새 id(다른 날)로 쌓인다.

## 5. 워크플로 없이 실행할 때

Workflow 도구를 쓸 수 없는 환경에서는 같은 순서를 서브에이전트 위임으로 실행한다.

1. 신호: `ent-researcher`(+ 승인 시 `internal-data-analyst`)를 한 메시지에서 병렬 호출
2. 분석: 세 분석가를 한 메시지에서 병렬 호출
3. 주장 추출: `ip-investment-judge`(30 파일)
4. 검증: 주장을 12개씩 나눠 `evidence-verifier`를 병렬 호출 → 메인이 `ip-investment-review` 「3. 주장 검증」의 규칙으로 제안 분류를 정해 `r{n}/30_proposed_classification.md`에 쓴다(메인은 규칙만 적용하고 판단을 보태지 않는다)
5. 판정: `ip-investment-judge`(31 파일)
6. 판정서: `verdict-writer` → `dossier-reviewer` → 높음·중간 지적이 있으면 한 번 고치고 다시 검토

각 호출의 프롬프트는 `workflows/ip-diagnosis.js`의 같은 단계 프롬프트를 쓴다. 완료 뒤 처리는 2-4와 같다. 이때 원장 기록용 JSON은 메인이 판정문에서 옮겨 `add-verdict --json`으로 넣는다.
