---
name: ip-ops-harness
description: "카카오엔터테인먼트 'IP 사업 운영 하네스' 오케스트레이터. 발굴(후보 스캔·신호 카드) → 투자 판단(주장 검증·등급 초안) → 확장 기획(포맷·글로벌·권리) → 제작 지원(설정집·피치·콘티) → 검증(원작 일관성·권리 범위·출시 전 반응 테스트) → 유통(진출 계획·현지화·마케팅 소재 요청서) → 성과 분석(블라인드 사후 검증·적중표·판단 기준 수정)의 7단계를 전문 에이전트 16명으로 조율하고, 판정 회의의 사람 결정과 실제 결과를 판정 원장에 남긴다. 'IP 진단해줘', '이 IP 투자할 만해?', '어떤 IP부터 볼지 후보 스캔', '진단해서 판정서까지 만들어줘', '판정 회의 결과 기록', '사후 검증·백테스트 돌려줘', '적중표', '공연·드라마·애니 제작 준비물 만들어줘', '해외 진출 계획', '파일럿 8주 차 보고'에 사용한다. 2차 판정(내부 지표 추가), 특정 단계만 다시, 다른 IP로 재실행, 이전 판정 업데이트·보완, 결과 개선 같은 후속 요청에도 사용한다. 한 관점만 묻는 요청(공개 자료 조사만, 확장 지도만, 시장 적합성만, 권리 점검만, 설정집만, 원작 일관성 검수만, 이미 있는 판정문을 판정서로 옮기기만)은 해당 스킬을 직접 쓴다."
---

# IP 사업 운영 하네스

CIPO의 질문 "보유한 IP 하나의 가치를 얼마나 오래, 크게, 여러 사업에서 만들어 낼 수 있는가"에 답하는 업무 체계다. IP를 고르고 넓히는 판단을 일곱 단계로 나누고, 단계마다 역할별 AI가 근거와 초안을 만들며, **결정은 사람이 한다.** 결정과 실제 결과는 판정 원장에 쌓여 다음 판단 기준을 고치는 재료가 된다.

## 운영 원칙

제안서의 설계 원칙을 실행 규칙으로 옮긴 것이다. 예외 상황에서도 이 이유를 기준으로 판단한다.

1. **준비와 결정을 나눈다.** AI는 근거와 등급 초안까지만 만든다. 사람의 결정은 사용자가 전한 내용만 `ledger.py add-decision --source "발언"`으로 기록한다. 침묵이나 짐작을 결정으로 기록하지 않는다. 사람 결정 없이 ④ 제작 단계를 시작하지 않는다.
2. **분석과 심사를 나눈다.** 분석가 셋이 쓰고, 심사위원이 주장을 뽑고, 검증자가 원문과 맞추고, 심사위원이 등급을 낸다. 같은 에이전트가 쓰고 심사하지 않는다.
3. **성과가 다음 판단으로 돌아온다.** 모든 판정은 날짜와 함께 원장에 남긴다. 결과가 나오면 대조하고, 수정안은 사용자 승인을 받아 `harness:evolve`로 스킬에 반영한다.
4. **이미 있는 자산과 잇는다.** 헬릭스 숏츠 같은 사내 도구는 요청서로 연결한다. 새 플랫폼이나 자체 모델을 만들지 않는다.
5. **데이터는 승인된 만큼만 본다.** 내부 지표는 `policy/data-approval.md`가 승인 상태일 때만 쓰고, 승인 확인과 개인 식별 열 차단은 스크립트가 한다.
6. **창작은 제작진이 결정한다.** 제작 준비물은 검토용이다. AI 이미지를 생성하지 않는다.

## 요청 분류

| 요청 | 단계 | 실행 모드 | 절차 |
| --- | --- | --- | --- |
| 어떤 IP를 진단할지 후보 스캔 | ① | 워크플로 `ip-scan` | `references/diagnosis.md` §1 |
| IP 진단, 투자 판단, 1차 판정 | ①→③→② | 워크플로 `ip-diagnosis`(round 1) | `references/diagnosis.md` §2 |
| 내부 지표를 붙인 2차 판정 | 같음 | 워크플로 `ip-diagnosis`(round 2) | `references/diagnosis.md` §3 |
| 특정 분석만 다시, 판정만 다시 | 일부 | 서브에이전트 + 워크플로 `from` | `references/diagnosis.md` §4 |
| 판정 회의 결과 기록 | 사람 결정 | 메인 | 이 문서 「판정 회의 기록」 |
| 제작 준비물(설정집·피치·콘티) | ④→⑤ | 지속형 에이전트 | `references/production.md` §1~2 |
| 출시 전 반응 테스트 설계 | ⑤ | 서브에이전트 | `references/production.md` §3 |
| 진출 계획·현지화·마케팅 소재 요청서 | ⑥ | 서브에이전트 | `references/production.md` §4 |
| 사후 검증(백테스트), 적중표 | ⑦ | 서브에이전트 + 메인 잠금 | `references/backtest.md` |
| 실제 결과 기록, 적중 갱신, 기준 수정안 | ⑦ | 서브에이전트 | `references/backtest.md` §6 |
| 파일럿 착수·중간·최종 보고 | 공통 | 서브에이전트 | `references/pilot.md` |

한 요청이 여러 줄에 걸치면 위에서부터 순서대로 실행한다. 이 스킬을 불러온 것은 표의 워크플로 사용에 동의한 것으로 본다. 기본 규모는 `references/diagnosis.md`의 표준 실행이고, 사용자가 "철저히", "전수"를 요청할 때만 늘린다.

## 에이전트 구성

| 단계 | 에이전트(`subagent_type`) | 모델 | 스킬 | 주 산출물 |
| --- | --- | --- | --- | --- |
| ① 발굴 | `ent-researcher` | sonnet | `ent-research` | `10_researcher_signals.md`, 스캔 카드 |
| ① 발굴 | `internal-data-analyst` | sonnet | `internal-signal-analysis` | `11_data_internal-signals.md` |
| ② 투자 판단 | `ip-investment-judge` | opus | `ip-investment-review` | `30_judge_claims.md`, `31_judge_verdict.md` |
| ② 투자 판단 | `evidence-verifier` | sonnet | `ip-investment-review`(검증 기준) | 주장별 검증(워크플로 반환값) |
| ③ 확장 기획 | `format-expansion-planner` | opus | `format-expansion` | `20_planner_expansion-map.md` |
| ③ 확장 기획 | `global-fit-analyst` | opus | `global-fit` | `21_global_fit.md` |
| ③·⑤ | `rights-revenue-analyst` | sonnet | `rights-revenue-check` | `22_rights_revenue.md`, `53_rights_scope.md` |
| ④ 제작 | `story-bible-keeper` | sonnet | `story-bible` | `50_bible/` |
| ④ 제작 | `adaptation-designer` | opus | `adaptation-pitch` | `51_designer_pitch_v{n}.md` |
| ⑤ 검증 | `canon-consistency-checker` | opus | `canon-check` | (리더 저장) `52_checker_round{n}.md` |
| ⑥ 유통 | `launch-planner` | sonnet | `launch-planning` | `60_launch_plan.md` |
| ⑦ 성과 분석 | `backtest-curator` | opus | `backtest-protocol`, `ent-research` | `blind/case-{X}/10_curator_dossier.md`, `sealed/` |
| ⑦ 성과 분석 | `blind-panelist` | opus | `backtest-protocol` + 진단 스킬 4종 | `blind/case-{X}/20~30_panel_*.md` |
| ⑦·⑤ | `performance-analyst` | opus | `performance-review` | 적중표, `54_analyst_pretest.md`, 결과 기록 |
| 공통 | `verdict-writer` | sonnet | `verdict-dossier` | `40_writer_dossier.md`, 보고서 |
| 공통 | `dossier-reviewer` | opus | `verdict-dossier`(점검표) | 검토 결과(워크플로 반환값·리더 저장) |

모델은 업무로 골랐다. 정해진 틀로 수집·정리·문서화하는 일은 sonnet, 교차 검증·판정·창작·실험 설계는 opus다. 장기 자율 계획은 메인(오케스트레이터)이 맡으므로 fable 에이전트는 두지 않았다.

**호출 방법.** 워크플로에서는 `agentType`, 그 밖에서는 `Agent(subagent_type: "{이름}", ...)`로 부른다. 정의 파일을 세션 중에 만들어 찾지 못하면 `subagent_type: "general-purpose"`, `model: {표의 모델}`로 부르고 프롬프트 첫 줄에 "`.claude/agents/{이름}.md`를 읽고 그 역할과 원칙을 따르라"를 넣는다. 이때는 프론트매터의 `tools` 제한이 적용되지 않으므로, 읽기 전용 에이전트(`evidence-verifier`, `canon-consistency-checker`, `dossier-reviewer`)에는 "파일을 만들거나 고치지 않는다", `blind-panelist`에는 "WebSearch·WebFetch·Bash를 쓰지 않고 블라인드 폴더만 읽는다", `internal-data-analyst`에는 "원본 CSV를 열지 않고 웹을 쓰지 않는다"를 반드시 넣는다.

## 공통 규칙

**경로.** 모든 경로는 프로젝트 루트 기준이다.

| 경로 | 내용 | 수명 |
| --- | --- | --- |
| `_workspace/00_input/` | 사용자 브리프, `internal/{ip}/`(집계 CSV), `source/{ip}/`(원고·설정 자료) | 입력 |
| `_workspace/scan/{YYYYMMDD}/` | 후보 스캔 인자·결과 | 작업 |
| `_workspace/ips/{ip}/r{n}/` | n차 진단 파일 10~41 | 작업 |
| `_workspace/ips/{ip}/prod-{format}/` | 제작·검증 파일 50~54 | 작업 |
| `_workspace/ips/{ip}/launch/` | 유통 계획 60 | 작업 |
| `_workspace/ips/runs/` | 워크플로 실행 기록(`{이름}.json`, `{이름}.meta.json`) | 작업 |
| `_workspace/backtest/{pair}/` | 사후 검증(`sealed/`와 `blind/` 분리) | 작업 |
| `ledger/` | 판정 원장(verdicts·decisions·outcomes) | **영구** |
| `deliverables/` | 판정서·적중표·보고서 최종본 | 최종 |
| `policy/data-approval.md` | 보안 승인 기록(사람이 작성) | 영구 |

`{ip}`는 영문 소문자와 하이픈으로 만든 슬러그다. `_workspace/`는 지우지 않는다. 사후 검증과 판정 근거 추적에 필요하다.

**기준일.** 메인이 환경의 오늘 날짜를 확인해 `YYYY-MM-DD`로 모든 에이전트·워크플로·스크립트(`--today`)에 넘긴다. 워크플로 안에서는 날짜 함수를 쓰지 않는다.

**판정 원장.** `python3 .claude/skills/ip-ops-harness/scripts/ledger.py {명령}`. 명령은 스크립트 첫 주석에 있다. 원장 파일을 직접 고치지 않는다.

**동결.** 단계가 바뀔 때 다음 단계가 읽을 파일의 해시를 남긴다(`shasum {파일들} > {폴더}/freeze_{단계}.sha`). 다음 단계를 마치기 전에 `shasum -c`로 바뀌지 않았는지 확인한다.

## 0단계: 기존 작업 확인

1. `ledger.py show --ip {ip}`, `_workspace/ips/{ip}/`, `_workspace/ips/runs/`, `_workspace/backtest/`를 확인한다.
2. 상황별로 고른다.

| 상황 | 할 일 |
| --- | --- |
| 처음 보는 IP | 1차 진단(round 1) |
| 1차 판정이 있고, 승인된 내부 데이터가 들어왔다 | 2차 진단(round 2, `priorVerdict`에 1차 판정문) |
| "○○만 다시", "판정만 다시" | `references/diagnosis.md` §4의 부분 재실행 |
| 같은 차수를 처음부터 다시(새 공개 자료 반영) | 기존 `r{n}/`을 `r{n}_{YYYYMMDD-HHMM}/`로 옮기고 같은 차수로 새로 실행. 원장에는 새 판정이 추가된다 |
| 워크플로가 중간에 멈췄다 | `runs/{이름}.meta.json`의 `runId`로 `resumeFromRunId` 재개. 바뀌지 않은 `agent()`는 캐시를 쓴다 |
| 판정 회의가 끝났다는 말 | 「판정 회의 기록」 |
| 제작·유통·사후 검증 요청 | 해당 references 절차. 제작은 원장에 사람 결정이 있는지 먼저 본다 |

## 판정 회의 기록(사람 결정)

판정 회의는 사람이 한다. 오케스트레이터는 결과를 받아 적는다.

1. 사용자에게서 결정을 듣는다: 누가(역할), 언제, 전체 등급, 포맷별 결정, 뒤집기 조건 확인 담당·기한. 빠진 칸은 묻는다. 채워 넣지 않는다.
2. 원장에 기록한다.
   ```bash
   python3 .claude/skills/ip-ops-harness/scripts/ledger.py --today {기준일} add-decision \
     --verdict {판정 id} --decider "CIPO" --date {회의일} --grade B \
     --format "공연=A" --format "실사 드라마=C" --note "권리 확인 1–2주 차, 법무" \
     --source "{사용자가 전한 결정 문장 그대로}"
   ```
   포맷 이름은 판정문의 이름을 그대로 쓴다. 그래야 `diff`와 `hits`가 맞춰진다.
3. `ledger.py diff --ip {ip}`로 AI 초안과 다른 칸을 확인한다. 다른 칸의 이유를 사용자가 말하지 않았으면 묻는다. 이유가 다음 판단 기준을 고치는 재료다.
4. 판정서 사본의 결정 칸을 채워 `deliverables/판정서_{IP명}_{n}차_결정.md`로 저장한다. 원본 `40_writer_dossier.md`는 그대로 둔다.

## 데이터 전달

| 경계 | 방법 |
| --- | --- |
| 워크플로 내부 단계 | 스키마 반환값 + 파일 경로(각 에이전트가 파일을 쓰고 경로를 반환) |
| 워크플로 → 메인 | 반환 JSON을 `_workspace/ips/runs/{이름}.json`에 저장 → `ledger.py add-verdicts` |
| 판정 → 제작 | 원장의 사람 결정 + 판정문·권리 점검 파일 경로 |
| 제작 내부(지속형) | 파일 + SendMessage(경로와 바뀐 장면만, 문구를 메시지로 고쳐 보내지 않는다) |
| 사후 검증 | `sealed/`(실명)와 `blind/`(가림) 분리 + 누출 검사 + `lock.sha` |

## 오류 처리

| 상황 | 대응 |
| --- | --- |
| 워크플로의 `agent()` 실패 | 스크립트가 `null`을 걸러 내고 `log()`로 알린다. 공개 신호·주장 추출·판정이 실패한 IP는 중단되고 `missingIps`에 남는다. 분석 하나가 빠지면 `(부분 심사)`로 진행한다. 검증이 실패한 주장은 조건부로 넘어간다 |
| 워크플로 전체 실패 | 실행 기록(journal)에서 실제 반환값을 확인하고, 고친 뒤 `resumeFromRunId`로 재개한다. 빈 결과를 성공으로 보지 않는다 |
| 서브에이전트 실패 | 한 번 다시 부른다. 또 실패하면 그 산출물 없이 진행하고 보고서에 누락을 적는다 |
| 지속형 에이전트 무응답 | SendMessage로 상태를 묻고 다시 지시한다. 그래도 없으면 같은 정의를 새 이름(`designer-2`)으로 실행하고 최신 파일 경로를 넘긴다 |
| 내부 데이터 스크립트 거부(3·4·5) | 우회하지 않는다. 사유를 사용자에게 알리고 공개 자료만으로 진행할지 묻는다 |
| 사후 검증 누출(blind_check 1) | 큐레이터가 고칠 때까지 다음 단계로 가지 않는다. 판정 뒤 누출이면 판정을 버리고 다시 한다 |
| 사용량 한도·인증 만료·권한 거부 | 다시 시도하지 않는다. 산출물을 직접 열어 어디까지 됐는지 확인하고 `_workspace/errors.md`에 적어 보고한다. 한도라면 풀리는 시각도 알린다 |
| 분석·출처끼리 충돌 | 지우지 않는다. 심사위원이 비교해 택한 쪽과 이유를 남긴다 |
| 메인이 빈 곳을 메울 때 | 직접 확인한 사실만 넣는다. 에이전트의 판단(왜 그 자료를 뺐는지, 어떤 등급인지)과 사람의 결정은 추측해 채우지 않는다 |
| 프록시 차단 | 우회하지 않는다. 오류를 그대로 기록하고 다른 공개 출처를 찾게 한다 |

## 운영 메모

첫 시연(2026-10-06, 카카오엔터 CIPO 제안 패키지)에서 확인한 것이다.

- **'리더'는 사람이 아니다.** 판정서·보고서에 메인 AI가 한 확인을 "사람이 했다"고 쓰지 않는다. 사람의 검토가 없었던 실행은 그 사실을 한계에 적는다.
- **숫자 기준은 하나다.** 같은 IP의 조회수가 보도 시점마다 다르면 가장 최근 A등급 값 하나를 쓰고 이전 값은 추이로만 쓴다.
- **최종 검토는 빠뜨린 단서를 본다.** 등급을 그대로 옮겨도 하방 조건이 빠지면 원문보다 밝게 읽힌다. 판정서 검토 점검표의 1~3번이 이 문제를 잡는다.
- **이미 한 확장을 새 제안처럼 쓰면 기각된다.** 시연에서 전시·굿즈가 이미 실행된 것을 놓친 분석이 기각됐다. 신호 카드의 「이미 실행된 확장」이 비어 있으면 리서처에게 다시 확인시킨다.
- **영문 요약을 거친 숫자는 단위가 틀린다.** 억·만 단위는 한국어 원문 문장으로 확인한다.

## 테스트 시나리오

### 정상 흐름: 1차 진단 → 판정 회의 → 2차 진단
1. 사용자가 "괴담출근 1차 진단해줘"라고 한다. 0단계에서 원장에 기록이 없음을 확인한다.
2. `ip-diagnosis`를 round 1, standard로 실행한다. `r1/`에 10·20·21·22·30·31·40 파일이 생기고, 반환값이 `runs/`에 저장되고, 원장에 판정 1건이 추가되고, `deliverables/판정서_괴담출근_1차_{날짜}.md`가 생긴다.
3. 사용자가 "회의에서 CIPO가 전체 B 유지, 공연은 A로 올렸어"라고 하면 `add-decision`으로 기록하고 `diff`로 공연 칸이 다름을 보이며 이유를 묻는다.
4. 승인 기록이 `승인`·`허용`으로 바뀌고 `internal/goedam-chulgeun/`에 CSV가 들어오면 round 2를 `internal: true`, `priorVerdict: r1/31_judge_verdict.md`로 실행한다. 판정서 10절에 1차 대비 바뀐 칸이 나온다.

### 오류 흐름: 내부 데이터 거부 + 검증자 실패
1. round 2 실행 중 `internal_metrics.py`가 종료 코드 3(승인 없음)으로 거부한다. 내부 신호 에이전트는 거부 사유를 반환하고, 워크플로는 "내부 신호 실패 → 공개 자료만으로 진행"을 기록한다.
2. 검증 묶음 하나가 실패해 해당 주장 12개가 `조건부`로 넘어간다. `log()`에 실패 건수가 남고, 반환값 `verifier_failures`가 1이다.
3. 메인은 사용자에게 "보안 승인 전이라 내부 지표 없이 판정했고, 검증 1건 실패로 주장 12개가 조건부 처리됐다"고 보고하고, 승인 뒤 round 2를 다시 실행하자고 제안한다.

### 후속 요청 흐름: 공연 제작 준비물
1. 사용자가 "괴담출근 공연 쪽 준비물 만들어줘"라고 한다. 원장에 공연 진행 결정이 있는지 확인한다. 없으면 결정 여부를 묻는다.
2. `references/production.md`대로 설정집 → 피치 v1 → 일관성 검수·권리 범위 점검(병렬) → v2 → 동결 → 출시 전 반응 테스트 설계 순서로 진행한다.
