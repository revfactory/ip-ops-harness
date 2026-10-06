# 제작·검증·유통 절차(④⑤⑥)

## 목차
1. 시작 조건과 설정집(④)
2. 피치·콘티와 검수 반복(④⑤) — 지속형 에이전트
3. 출시 전 반응 테스트 설계(⑤)
4. 유통 실행 계획(⑥)

제안서의 8주 파일럿은 ①②③⑦만 다룬다. 이 절차는 파일럿 결과를 보고 ④~⑥을 잇기로 했을 때, 또는 사용자가 특정 IP·포맷의 준비물을 요청했을 때 쓴다.

---

## 1. 시작 조건과 설정집 — 실행 모드: 서브에이전트 위임

1. **사람 결정 확인.** `ledger.py show --ip {ip}`에서 이 포맷을 진행하기로 한 결정을 찾는다. 없으면 만들지 말고 사용자에게 묻는다: "판정 회의에서 {포맷} 진행이 결정됐나요? 결정됐다면 누가 언제 정했는지 알려 주세요." 답을 받으면 「판정 회의 기록」대로 기록하고 시작한다.
2. **원고 확인.** `_workspace/00_input/source/{ip}/`에 원고·설정 자료가 있는지 본다. 없으면 공개 자료 임시본으로 만들 수 있지만, 일관성 검수 기준으로는 약하다는 점을 사용자에게 알린다.
3. **설정집.**
   ```
   Agent(subagent_type: "story-bible-keeper",
         prompt: "IP {IP명}({ip}) {포맷} 준비용 설정집을 만든다. story-bible 스킬을 따른다. 기준일 {기준일}.
                  원고: _workspace/00_input/source/{ip}/  판정문: {최신 31_judge_verdict.md}
                  범위: {판정문이 정한 범위, 예: 1부}  출력: _workspace/ips/{ip}/prod-{format}/50_bible/")
   ```
4. 설정집을 동결한다: `shasum _workspace/ips/{ip}/prod-{format}/50_bible/*.md > _workspace/ips/{ip}/prod-{format}/freeze_bible.sha`

## 2. 피치·콘티와 검수 반복 — 실행 모드: 지속형 에이전트 협업

기획자와 검수자가 의견을 주고받으며 2회까지 고친다. 기획자가 자기 각색 이유를 기억해야 지적을 정확히 반영하므로 지속형으로 둔다.

1. **실행(한 메시지에서 둘 다).**
   - `Agent(name: "designer", subagent_type: "adaptation-designer", prompt: "{IP명} {포맷} 피치 자료 v1을 쓴다. adaptation-pitch 스킬을 따른다. 입력: 판정문, 50_bible/, 22_rights_revenue.md, 아래 판정 원장 기록. 출력: prod-{format}/51_designer_pitch_v1.md. 첫 보고로 쓸 수 있는 도구 목록을 알린다.\n{ledger.py show --ip {ip} 출력}")`
   - `Agent(name: "canon-checker", subagent_type: "canon-consistency-checker", prompt: "대기하다가 리더의 검수 요청을 받는다. canon-check 스킬을 따른다. 기준: prod-{format}/50_bible/. 첫 보고로 쓸 수 있는 도구 목록을 알린다. 파일을 만들거나 고치지 않는다.")`
2. **v1이 나오면 병렬 점검.**
   - `SendMessage({to: "canon-checker"}, "prod-{format}/51_designer_pitch_v1.md를 검수하라.")` → 결과를 `prod-{format}/52_checker_round1.md`로 저장
   - 동시에 `Agent(subagent_type: "rights-revenue-analyst", prompt: "rights-revenue-check 스킬의 권리 범위 모드로 51_designer_pitch_v1.md를 점검한다. 판정 원장 기록은 아래에 붙였다. 출력: prod-{format}/53_rights_scope.md\n{ledger.py show --ip {ip} 출력}")`
3. **반영.** `SendMessage({to: "designer"}, "52_checker_round1.md와 53_rights_scope.md를 반영해 v2를 써라. 반영하지 않은 의견은 이유를 수정 기록에 남겨라.")` 지적 문구를 메시지로 다시 써 보내지 않고 파일 경로만 보낸다. 같은 내용을 메시지와 파일로 두 번 보내면 서로 다른 버전이 반영된다.
4. **반복.** 검수 판정이 `통과`가 될 때까지 최대 2회. 2회 뒤에도 `재작업`이면 멈추고 사용자에게 남은 지적을 보인다.
5. **동결.** 최종 버전을 `designer`에게 동결한다고 알리고 `shasum prod-{format}/51_designer_pitch_v*.md > prod-{format}/freeze_pitch.sha`. 설정집 해시도 `shasum -c freeze_bible.sha`로 확인한다. 검수 중 설정집 보강이 있었으면 보강된 항목이 최종 피치와 맞는지 검수자에게 한 번 더 확인받는다.
6. **납품.** `deliverables/제작준비물_{IP명}_{포맷}_v{n}.md`로 복사하고 맨 위에 검수 판정, 권리 범위 점검 요약, "결정은 작가·PD·제작사"를 붙인다.

| 이름 | 정의 | 산출물 |
| --- | --- | --- |
| `designer` | `adaptation-designer` | `51_designer_pitch_v{n}.md` |
| `canon-checker` | `canon-consistency-checker` | (리더 저장) `52_checker_round{n}.md` |

## 3. 출시 전 반응 테스트 설계 — 실행 모드: 서브에이전트 위임

```
Agent(subagent_type: "performance-analyst",
      prompt: "performance-review 스킬 「5. 출시 전 반응 테스트 설계」를 따른다. 입력: 동결된 피치 자료, 판정문.
               성공 기준과 결정 규칙을 테스트 전에 정한다. 출력: prod-{format}/54_analyst_pretest.md")
```

테스트를 실제로 할지, 결과를 보고 출시·수정할지는 제작 책임자가 정한다. 결정을 들으면 원장에 기록한다.

## 4. 유통 실행 계획 — 실행 모드: 서브에이전트 위임

```
Agent(subagent_type: "launch-planner",
      prompt: "launch-planning 스킬을 따른다. 기준일 {기준일}. 입력: 최신 31_judge_verdict.md, 21_global_fit.md, 22_rights_revenue.md,
               ledger.py show --ip {ip} 출력(아래 붙임), 있으면 prod-*/50_bible/glossary.md와 피치 자료.
               출력: _workspace/ips/{ip}/launch/60_launch_plan.md")
```

- 원장 출력은 메인이 실행해 프롬프트에 붙인다. 이 절의 모든 에이전트에 같다. 셸 도구가 없는 에이전트(adaptation-designer, rights-revenue-analyst, launch-planner)는 원장을 직접 읽을 수 없다.
- 추적 지표 표는 ⑦ 성과 분석의 기준이 된다. 사용자가 승인하면 `_workspace/ips/{ip}/launch/tracking.md`로 따로 저장해 둔다.
- 진출 국가와 시점, 번역 검수 책임, 소재 승인은 사람이 정한다.
