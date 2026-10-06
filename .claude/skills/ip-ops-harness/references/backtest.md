# 사후 검증 절차(⑦)

## 목차
1. 쌍 선정과 봉인 준비
2. 블라인드 자료 만들기
3. 블라인드 판정
4. 잠금과 기록
5. 결과 수집과 적중표
6. 실제 진단의 결과 기록과 기준 수정안

**실행 모드:** 서브에이전트 위임 + 메인의 단계 사이 검사. 단계마다 메인이 누출 검사와 잠금을 직접 실행해야 하고, 사례가 한 쌍뿐이라 워크플로로 묶을 이득이 작다. 규약 전문은 `backtest-protocol` 스킬에 있다.

---

## 1. 쌍 선정과 봉인 준비(메인 + 사람)

1. 후보 쌍을 제시한다. 원작 규모와 편성이 비슷한데 결과가 엇갈린 두 작품이다. 최종 선정은 사람(해당 사업부와 함께)이 한다. 지난 결정을 평가하려는 것이 아님을 함께 밝힌다.
2. 중립 쌍 코드를 정한다(예: `bt-2026q4-1`). 작품명·슬러그를 폴더 이름에 쓰지 않는다. 사례 코드 A·B는 성공·부진 순서와 무관하게 정한다.
3. `_workspace/backtest/{pair}/sealed/key.json`을 만든다(형식은 `backtest-protocol` §2). `cutoff`와 `cutoff_basis`를 적는다. 결정 시점이 확인되지 않았으면 확인된 가장 이른 공식 발표 전날로 잡고, 실제 계약일은 내부 확인 대상으로 남긴다.

## 2. 블라인드 자료 만들기

1. 사례 둘을 한 메시지에서 병렬로 맡긴다.
   ```
   Agent(subagent_type: "backtest-curator",
         prompt: "backtest-protocol 스킬을 따른다. 쌍 {pair}, 사례 {X}: 실명 {작품명}, 컷오프 {날짜}({근거}).
                  key.json: _workspace/backtest/{pair}/sealed/key.json (terms를 채운다)
                  블라인드 출력: _workspace/backtest/{pair}/blind/case-{X}/10_curator_dossier.md
                  봉인 출력: _workspace/backtest/{pair}/sealed/case-{X}_sources.md
                  실제 결과는 수집하지 않는다.")
   ```
2. 누출 검사(메인):
   ```bash
   python3 .claude/skills/backtest-protocol/scripts/blind_check.py --key _workspace/backtest/{pair}/sealed/key.json \
     --case {X} _workspace/backtest/{pair}/blind/case-{X}/ > _workspace/backtest/{pair}/blindcheck_{X}_dossier.txt; echo $?
   ```
   종료 코드 1이면 보고서 경로를 주고 큐레이터에게 고치게 한다(최대 2회). `WARN` 줄은 큐레이터가 확인한다.
3. 두 사례의 블라인드 자료가 깨끗하면 해시를 남긴다: `shasum _workspace/backtest/{pair}/blind/case-*/10_curator_dossier.md > _workspace/backtest/{pair}/freeze_dossier.sha`

## 3. 블라인드 판정

판정단 프롬프트에는 실명, 슬러그, 쌍의 성격(성공·부진 한 쌍이라는 사실)을 넣지 않는다. 쌍이라는 사실을 알면 두 사례를 상대 비교하게 된다.

1. **렌즈 분석(사례마다 3개, 두 사례 6개를 한 메시지에서 병렬).**
   ```
   Agent(subagent_type: "blind-panelist",
         prompt: "렌즈: {format|global|rights}. backtest-protocol 스킬 「5. 블라인드 판정 규칙」과 {format-expansion|global-fit|rights-revenue-check} 스킬을 따른다.
                  읽을 것: _workspace/backtest/{pair}/blind/case-{X}/10_curator_dossier.md 만.
                  WebSearch·WebFetch·Bash를 쓰지 않는다. 출력: 같은 폴더의 {20_panel_format|21_panel_global|22_panel_rights}.md")
   ```
2. 누출 검사(`analysis` 단계). 걸리면 그 사례의 렌즈 분석을 버리고 자료부터 고친다.
3. **최종 판정(사례마다 1개, 병렬).** 렌즈 `judge`, 입력은 같은 폴더의 10·20·21·22, 출력 `30_panel_verdict.md`. `ip-investment-review` 「7. 블라인드 판정」과 끝의 `## 인식 점검`을 지시한다.
4. 누출 검사(`verdict` 단계). 종료 코드 2면 그 사례에 "오염 가능" 표시를 남긴다.

## 4. 잠금과 기록(메인)

1. 잠근다: `shasum _workspace/backtest/{pair}/blind/case-*/30_panel_verdict.md > _workspace/backtest/{pair}/lock.sha`
2. 사례마다 원장 기록용 JSON을 판정문에서 옮겨 `_workspace/backtest/{pair}/sealed/verdict_{X}.json`에 쓴다. 메인은 판정문에 있는 값만 옮긴다.
   ```json
   { "mode": "backtest", "pair": "{pair}", "case": "A", "ip": "{key.json의 slug}", "title": "{실명}",
     "round": 1, "date": "{기준일}", "grade": "B", "one_liner": "{판정문 그대로}",
     "formats": [{ "format": "실사 드라마", "grade": "B", "reason": "..." }],
     "claims": { "pass": 0, "conditional": 0, "rejected": 0 }, "recognized": false,
     "lock": "{lock.sha의 해당 줄 해시}", "paths": { "verdict": "..." } }
   ```
3. `ledger.py --today {기준일} add-verdict --json _workspace/backtest/{pair}/sealed/verdict_{X}.json`

## 5. 결과 수집과 적중표

```
Agent(subagent_type: "performance-analyst",
      prompt: "performance-review 스킬을 따른다. 쌍 {pair}. 먼저 shasum -c _workspace/backtest/{pair}/lock.sha로 잠금을 확인하고, 통과해야만 진행한다.
               sealed/key.json으로 실명을 확인하고 두 사례의 실제 결과를 포맷별로 모아 ledger.py add-outcome으로 기록한다(포맷 이름은 블라인드 판정의 이름 그대로).
               ledger.py hits --mode backtest --pair {pair} 출력으로 적중표를 쓴다.
               출력: sealed/40_analyst_outcomes.md, {pair}/41_analyst_hit-table.md")
```

- 완료 뒤 메인이 `ledger.py hits --mode backtest --pair {pair}`를 직접 한 번 더 실행해 적중표의 숫자와 같은지 확인한다.
- 적중표를 `deliverables/적중표_{pair}_{YYYYMMDD}.md`로 복사한다. 실명은 적중표 단계에서 공개해도 된다.
- 판단 기준 수정안이 있으면 사용자에게 보이고, 승인하면 `harness:evolve`로 반영한다.

## 6. 실제 진단의 결과 기록과 기준 수정안

사후 검증이 아니어도, 실제 진단한 IP의 확장 결과가 나오면 같은 방식으로 기록한다.

1. 사용자가 결과를 알려 주거나 조사를 요청하면 `performance-analyst`에게 결과 확인과 `add-outcome` 기록을 맡긴다.
2. `ledger.py hits --mode live --ip {ip}`로 대조한다. AI 적중과 사람 적중을 함께 보인다.
3. 같은 방향의 빗나감이 두 사례 이상 쌓이면 수정 제안으로 올린다. 한 사례면 관찰로 둔다.
