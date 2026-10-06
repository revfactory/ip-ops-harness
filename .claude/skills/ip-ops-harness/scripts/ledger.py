#!/usr/bin/env python3
"""판정 원장: AI 등급 초안, 사람의 결정, 실제 결과를 날짜와 함께 남기고 대조한다.

파일(추가만 하는 JSONL, 같은 id를 다시 쓰면 version이 올라가고 최신 버전을 쓴다)
  ledger/verdicts.jsonl   AI 판정(실제 진단 live · 사후 검증 backtest)
  ledger/decisions.jsonl  사람의 결정(판정 회의). 사용자 발언을 근거(--source)로만 기록한다
  ledger/outcomes.jsonl   실제 결과

명령
  add-verdicts --file RUN.json [--minutes N]   진단 워크플로 반환값(results 배열)을 한꺼번에 기록
  add-verdict  --json ONE.json                 판정 하나 기록(사후 검증 등)
  add-decision --verdict ID --decider 역할 --date D --source "사용자 발언"
               [--grade B] [--format 포맷=등급 ...] [--note 메모]
  add-outcome  --ip SLUG --format 포맷 --date D --result 성공|부진|미정 --evidence 근거 [--url URL]
  show   [--ip SLUG]
  diff   [--ip SLUG]                           AI 초안과 사람 결정이 다른 칸
  hits   [--mode live|backtest] [--pair P] [--ip SLUG]   판정과 실제 결과 대조(적중표 데이터)
  report                                       파일럿 측정 지표 요약
"""
import argparse
import json
import os
import re
import sys
from datetime import date

ORDER = {"A": 4, "B": 3, "C": 2, "D": 1}


def letter(g):
    m = re.match(r"\s*([ABCD])(?![A-Za-z])", str(g or ""))
    return m.group(1) if m else None


def fkey(name):
    return re.sub(r"\s+", "", str(name)).lower()


class Ledger:
    def __init__(self, d):
        self.d = d
        os.makedirs(d, exist_ok=True)

    def path(self, kind):
        return os.path.join(self.d, f"{kind}.jsonl")

    def read(self, kind):
        p = self.path(kind)
        if not os.path.exists(p):
            return []
        with open(p, encoding="utf-8") as f:
            rows = [json.loads(line) for line in f if line.strip()]
        latest = {}
        for r in rows:
            if r["id"] not in latest or r.get("version", 1) >= latest[r["id"]].get("version", 1):
                latest[r["id"]] = r
        return list(latest.values())

    def append(self, kind, rec):
        same = [r for r in self.read(kind) if r["id"] == rec["id"]]
        rec["version"] = (max(r.get("version", 1) for r in same) + 1) if same else 1
        with open(self.path(kind), "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        return rec

    def next_id(self, kind, prefix):
        return f"{prefix}-{len(self.read(kind)) + 1:04d}"


def die(msg):
    print(f"[오류] {msg}", file=sys.stderr)
    sys.exit(2)


def verdict_record(r, today, minutes=None):
    need = ["ip", "title", "round", "date", "grade", "one_liner", "formats"]
    miss = [k for k in need if r.get(k) in (None, "")]
    if miss:
        die(f"판정 기록에 필요한 값이 없다: {miss} (ip={r.get('ip')})")
    if not letter(r["grade"]):
        die(f"등급은 A~D여야 한다: {r['grade']!r}")
    fm = r["formats"]
    if isinstance(fm, list):
        formats = {x["format"]: x["grade"] for x in fm}
        reasons = {x["format"]: x.get("reason", "") for x in fm}
    else:
        formats, reasons = dict(fm), {}
    mode = r.get("mode", "live")
    rid = r.get("id") or (f"{r['pair']}-{r['case']}" if mode == "backtest" else f"{r['ip']}-r{r['round']}-{r['date']}")
    claims = r.get("claims") or {}
    return {
        "id": rid, "recorded_at": today, "mode": mode,
        "ip": r["ip"], "title": r["title"], "round": int(r["round"]), "date": r["date"],
        "grade": letter(r["grade"]), "partial": bool(r.get("partial")), "one_liner": r["one_liner"],
        "formats": formats, "format_reasons": reasons,
        "claims": {k: int(claims.get(k, 0)) for k in ("pass", "conditional", "rejected")},
        "overrides": int(r.get("overrides") or 0),
        "minutes": minutes if minutes is not None else r.get("minutes"),
        "paths": r.get("paths", {}), "run_id": r.get("run_id"),
        "pair": r.get("pair"), "case": r.get("case"),
        "recognized": r.get("recognized"), "lock": r.get("lock"),
    }


def cmd_add_verdicts(L, a, today):
    with open(a.file, encoding="utf-8") as f:
        run = json.load(f)
    results = run.get("results", run if isinstance(run, list) else [])
    if not results:
        die("results 배열이 비어 있다")
    for r in results:
        r.setdefault("run_id", run.get("run_id") if isinstance(run, dict) else None)
        rec = L.append("verdicts", verdict_record(r, today, a.minutes))
        print(f"판정 기록: {rec['id']} v{rec['version']} — {rec['one_liner']}")


def cmd_add_verdict(L, a, today):
    with open(a.json, encoding="utf-8") as f:
        r = json.load(f)
    rec = L.append("verdicts", verdict_record(r, today, a.minutes))
    print(f"판정 기록: {rec['id']} v{rec['version']} — {rec['grade']}")


def cmd_add_decision(L, a, today):
    vs = {v["id"]: v for v in L.read("verdicts")}
    if a.verdict not in vs:
        die(f"판정 id가 없다: {a.verdict}. `show`로 id를 확인한다")
    if not a.source or len(a.source.strip()) < 5:
        die("--source에 사람의 결정을 전한 사용자 발언을 그대로 적는다. 근거 없는 결정은 기록하지 않는다")
    formats = {}
    for item in a.format or []:
        if "=" not in item:
            die(f"--format은 포맷=등급 형식이다: {item}")
        k, v = item.split("=", 1)
        formats[k.strip()] = v.strip()
    if a.grade and not letter(a.grade):
        die(f"등급은 A~D여야 한다: {a.grade}")
    v = vs[a.verdict]
    unknown = [k for k in formats if fkey(k) not in {fkey(x) for x in v["formats"]}]
    if unknown:
        print(f"[주의] 판정에 없는 포맷 이름: {unknown}. 판정의 포맷 이름과 맞추면 diff·hits가 정확해진다")
    rec = {"id": L.next_id("decisions", "D"), "recorded_at": today, "verdict_id": a.verdict, "ip": v["ip"],
           "date": a.date, "decider": a.decider, "grade": letter(a.grade) if a.grade else None,
           "formats": formats, "note": a.note or "", "source": a.source.strip()}
    rec = L.append("decisions", rec)
    print(f"결정 기록: {rec['id']} ({a.decider}, {a.date}) → 판정 {a.verdict}")


def cmd_add_outcome(L, a, today):
    if a.result not in ("성공", "부진", "미정"):
        die("--result는 성공·부진·미정 가운데 하나다")
    rec = {"id": L.next_id("outcomes", "O"), "recorded_at": today, "ip": a.ip, "format": a.format,
           "date": a.date, "result": a.result, "evidence": a.evidence, "url": a.url or ""}
    rec = L.append("outcomes", rec)
    print(f"결과 기록: {rec['id']} {a.ip} / {a.format} = {a.result}")


def cmd_show(L, a, _):
    for kind in ("verdicts", "decisions", "outcomes"):
        rows = [r for r in L.read(kind) if not a.ip or r.get("ip") == a.ip]
        print(f"\n## {kind} ({len(rows)})")
        for r in sorted(rows, key=lambda x: (x.get("date", ""), x["id"])):
            if kind == "verdicts":
                fm = ", ".join(f"{k} {v}" for k, v in r["formats"].items())
                extra = f" · 사례 {r['case']}" if r["mode"] == "backtest" else ""
                print(f"- {r['id']} [{r['mode']}{extra}] {r['date']} {r['title']} {r['round']}차: "
                      f"{r['grade']}{' (부분 심사)' if r['partial'] else ''} — {r['one_liner']} | {fm}")
            elif kind == "decisions":
                fm = ", ".join(f"{k} {v}" for k, v in r["formats"].items())
                print(f"- {r['id']} {r['date']} {r['decider']} → {r['verdict_id']}: 등급 {r['grade'] or '—'}"
                      f" | {fm or '—'} | 메모: {r['note'] or '—'} | 근거: \"{r['source']}\"")
            else:
                print(f"- {r['id']} {r['date']} {r['ip']} / {r['format']}: {r['result']} — {r['evidence']} {r['url']}")


def diffs(L, ip=None):
    vs = {v["id"]: v for v in L.read("verdicts")}
    out = []
    for d in L.read("decisions"):
        v = vs.get(d["verdict_id"])
        if not v or (ip and v["ip"] != ip):
            continue
        cells = []
        if d.get("grade"):
            cells.append(("전체 등급", v["grade"], d["grade"]))
        vf = {fkey(k): (k, g) for k, g in v["formats"].items()}
        for k, g in d["formats"].items():
            name, ai = vf.get(fkey(k), (k, None))
            cells.append((name, ai, g))
        for name, ai, human in cells:
            out.append({"decision": d["id"], "verdict": v["id"], "ip": v["ip"], "cell": name,
                        "ai": ai, "human": human, "differs": letter(ai) != letter(human)})
    return out


def cmd_diff(L, a, _):
    rows = diffs(L, a.ip)
    if not rows:
        print("비교할 결정 기록이 없다")
        return
    print("| 판정 | 칸 | AI 초안 | 사람 결정 | 다름 |\n| --- | --- | --- | --- | --- |")
    for r in rows:
        print(f"| {r['verdict']} | {r['cell']} | {r['ai'] or '—'} | {r['human']} | {'예' if r['differs'] else ''} |")
    n = sum(r["differs"] for r in rows)
    print(f"\n비교한 칸 {len(rows)}개 중 {n}개가 다르다. 다른 칸의 이유는 판정서의 결정 기록에 남긴다.")


def hit_rows(L, mode=None, pair=None, ip=None):
    outs = {}
    for o in sorted(L.read("outcomes"), key=lambda x: (x["date"], x["id"])):
        outs[(o["ip"], fkey(o["format"]))] = o  # 같은 칸은 가장 최근 결과
    decisions = {}
    for d in L.read("decisions"):
        for k, g in d["formats"].items():
            decisions[(d["verdict_id"], fkey(k))] = g
    rows = []
    for v in L.read("verdicts"):
        if (mode and v["mode"] != mode) or (pair and v.get("pair") != pair) or (ip and v["ip"] != ip):
            continue
        for fmt, g in v["formats"].items():
            o = outs.get((v["ip"], fkey(fmt)))
            pred = letter(g)
            actual = o["result"] if o else None
            evaluable = bool(pred and actual in ("성공", "부진"))
            human = decisions.get((v["id"], fkey(fmt)))
            rows.append({
                "verdict": v["id"], "mode": v["mode"], "pair": v.get("pair"), "case": v.get("case"),
                "ip": v["ip"], "format": fmt, "ai": g, "human": human, "actual": actual or "기록 없음",
                "ai_hit": (pred in ("A", "B")) == (actual == "성공") if evaluable else None,
                "human_hit": ((letter(human) in ("A", "B")) == (actual == "성공")) if (evaluable and letter(human)) else None,
                "contaminated": bool(v.get("recognized")),
            })
    return rows


def pair_discrimination(L, pair=None):
    by_pair = {}
    for v in L.read("verdicts"):
        if v["mode"] == "backtest" and v.get("pair") and (not pair or v["pair"] == pair):
            by_pair.setdefault(v["pair"], []).append(v)
    outs = {(o["ip"], fkey(o["format"])): o["result"] for o in L.read("outcomes")}
    res = []
    for p, vs in by_pair.items():
        if len(vs) != 2:
            res.append({"pair": p, "format": "—", "result": f"사례 {len(vs)}개(2개 필요)"})
            continue
        a, b = vs
        fa = {fkey(k): (k, g) for k, g in a["formats"].items()}
        for kb, (name, gb) in {fkey(k): (k, g) for k, g in b["formats"].items()}.items():
            if kb not in fa:
                continue
            ga = fa[kb][1]
            oa, ob = outs.get((a["ip"], kb)), outs.get((b["ip"], kb))
            if {oa, ob} != {"성공", "부진"} or not (letter(ga) and letter(gb)):
                continue
            succ, flop = (ga, gb) if oa == "성공" else (gb, ga)
            diff = ORDER[letter(succ)] - ORDER[letter(flop)]
            res.append({"pair": p, "format": name, "success_grade": succ, "flop_grade": flop,
                        "result": "구분 성공" if diff > 0 else ("동점" if diff == 0 else "역판정"),
                        "contaminated": bool(a.get("recognized") or b.get("recognized"))})
    return res


def cmd_hits(L, a, _):
    rows = hit_rows(L, a.mode, a.pair, a.ip)
    if not rows:
        print("대조할 판정이 없다")
        return
    print("| 판정 | 사례 | 포맷 | AI 판정 | 사람 결정 | 실제 결과 | AI 적중 | 사람 적중 | 비고 |")
    print("| --- | --- | --- | --- | --- | --- | --- | --- | --- |")
    yn = {True: "적중", False: "빗나감", None: "판정 불가"}
    for r in rows:
        print(f"| {r['verdict']} | {r['case'] or '—'} | {r['format']} | {r['ai']} | {r['human'] or '—'} | {r['actual']} | "
              f"{yn[r['ai_hit']]} | {yn[r['human_hit']] if r['human'] else '—'} | {'오염 가능' if r['contaminated'] else ''} |")
    ev = [r for r in rows if r["ai_hit"] is not None]
    clean = [r for r in ev if not r["contaminated"]]
    print(f"\nAI 적중: 평가 가능 {len(ev)}칸 중 {sum(r['ai_hit'] for r in ev)}칸"
          f" (오염 가능 제외 시 {len(clean)}칸 중 {sum(r['ai_hit'] for r in clean)}칸). "
          f"평가 불가(결과 없음·미정·등급 없음) {len(rows) - len(ev)}칸")
    pd = pair_discrimination(L, a.pair)
    if pd:
        print("\n| 쌍 | 포맷 | 성공 사례 판정 | 부진 사례 판정 | 결과 | 비고 |\n| --- | --- | --- | --- | --- | --- |")
        for r in pd:
            print(f"| {r['pair']} | {r['format']} | {r.get('success_grade', '—')} | {r.get('flop_grade', '—')} | "
                  f"{r['result']} | {'오염 가능' if r.get('contaminated') else ''} |")
    print("\n규칙: A·B는 '추진', C·D는 '보류'로 보고 실제 결과 성공·부진과 맞춘다. 실행되지 않은 포맷은 평가하지 않는다.")


def cmd_report(L, a, _):
    vs = L.read("verdicts")
    live = [v for v in vs if v["mode"] == "live"]
    bt = [v for v in vs if v["mode"] == "backtest"]
    print("## 파일럿 측정 지표(판정 원장 기준)\n")
    print("| 지표 | 값 |\n| --- | --- |")
    print(f"| 실제 진단 판정 수 | {len(live)}건(IP {len({v['ip'] for v in live})}개, "
          f"1차 {sum(v['round'] == 1 for v in live)} · 2차 {sum(v['round'] == 2 for v in live)}) |")
    print(f"| 사후 검증 판정 수 | {len(bt)}건(쌍 {len({v.get('pair') for v in bt})}개) |")
    mins = [v["minutes"] for v in vs if v.get("minutes")]
    print(f"| 판정서 초안까지 걸린 시간 | {'기록 없음' if not mins else f'평균 {sum(mins) / len(mins):.0f}분(기록 {len(mins)}건)'} |")
    tot = sum(sum(v["claims"].values()) for v in live)
    cut = sum(v["claims"]["conditional"] + v["claims"]["rejected"] for v in live)
    print(f"| 심사가 깎은 주장 | {tot}개 중 조건부·기각 {cut}개 |")
    print(f"| 검증자 제안 분류를 심사위원이 바꾼 주장 | {sum(v['overrides'] for v in live)}개 |")
    d = diffs(L)
    print(f"| 초안과 결정의 차이 | 비교한 {len(d)}칸 중 {sum(r['differs'] for r in d)}칸 |")
    changed = []
    for ip in {v["ip"] for v in live}:
        r1 = max((v for v in live if v["ip"] == ip and v["round"] == 1), key=lambda v: v["date"], default=None)
        r2 = max((v for v in live if v["ip"] == ip and v["round"] == 2), key=lambda v: v["date"], default=None)
        if r1 and r2:
            f1 = {fkey(k): letter(g) for k, g in r1["formats"].items()}
            n = sum(1 for k, g in r2["formats"].items() if f1.get(fkey(k)) != letter(g))
            changed.append(f"{ip} {n}칸")
    print(f"| 1차와 2차 판정이 달라진 포맷 | {', '.join(changed) or '2차 판정 없음'} |")
    hr = [r for r in hit_rows(L) if r["ai_hit"] is not None]
    print(f"| 적중 | 평가 가능 {len(hr)}칸 중 {sum(r['ai_hit'] for r in hr)}칸 |")
    pd = [r for r in pair_discrimination(L) if r["result"] in ("구분 성공", "동점", "역판정")]
    if pd:
        print(f"| 사후 검증 쌍 구분 | {len(pd)}칸 중 구분 성공 {sum(r['result'] == '구분 성공' for r in pd)}칸 |")
    print(f"| 결정 기록 | {len(L.read('decisions'))}건 |")


def main():
    ap = argparse.ArgumentParser(description="판정 원장")
    ap.add_argument("--ledger-dir", default="ledger")
    ap.add_argument("--today", help="기록일 YYYY-MM-DD(기본: 시스템 날짜)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("add-verdicts"); p.add_argument("--file", required=True); p.add_argument("--minutes", type=float)
    p = sub.add_parser("add-verdict"); p.add_argument("--json", required=True); p.add_argument("--minutes", type=float)
    p = sub.add_parser("add-decision")
    p.add_argument("--verdict", required=True); p.add_argument("--decider", required=True)
    p.add_argument("--date", required=True); p.add_argument("--source", required=True)
    p.add_argument("--grade"); p.add_argument("--format", action="append"); p.add_argument("--note")
    p = sub.add_parser("add-outcome")
    p.add_argument("--ip", required=True); p.add_argument("--format", required=True); p.add_argument("--date", required=True)
    p.add_argument("--result", required=True); p.add_argument("--evidence", required=True); p.add_argument("--url")
    p = sub.add_parser("show"); p.add_argument("--ip")
    p = sub.add_parser("diff"); p.add_argument("--ip")
    p = sub.add_parser("hits"); p.add_argument("--mode", choices=["live", "backtest"]); p.add_argument("--pair"); p.add_argument("--ip")
    sub.add_parser("report")
    a = ap.parse_args()
    today = a.today or date.today().isoformat()
    L = Ledger(a.ledger_dir)
    {"add-verdicts": cmd_add_verdicts, "add-verdict": cmd_add_verdict, "add-decision": cmd_add_decision,
     "add-outcome": cmd_add_outcome, "show": cmd_show, "diff": cmd_diff, "hits": cmd_hits,
     "report": cmd_report}[a.cmd](L, a, today)


if __name__ == "__main__":
    main()
