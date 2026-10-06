#!/usr/bin/env python3
"""작품 단위 비식별 집계 지표를 계산한다.

순서: 보안 승인 확인 → 개인 식별 열·행 단위 데이터 차단 → 지표 계산 → JSON·Markdown 출력.
에이전트는 원본 CSV를 직접 읽지 않고 이 스크립트의 출력만 쓴다.

종료 코드
  0 정상
  3 보안 승인 없음·만료·외부 AI 전송 미허용
  4 개인 식별 가능 열 또는 행 단위 데이터로 보이는 파일
  5 입력 파일·열 문제
"""
import argparse
import csv
import json
import os
import re
import sys
from datetime import date

EXIT_POLICY, EXIT_PII, EXIT_INPUT = 3, 4, 5
MAX_ROWS = 2000  # 작품 단위 집계라면 이보다 많을 수 없다(회차 수·국가 수 기준)

PII_PATTERNS = [
    r"user", r"member", r"uid", r"account", r"e-?mail", r"phone", r"mobile",
    r"^name$", r"^full_?name$", r"nick", r"birth", r"address", r"ip_?addr",
    r"device", r"adid", r"idfa", r"gaid", r"cookie", r"session",
    r"회원", r"이메일", r"전화", r"휴대", r"^이름$", r"닉네임", r"생년", r"주소", r"기기", r"계정",
]

SPECS = {
    "summary.csv": {"required": ["period", "unique_readers", "total_views"],
                    "optional": ["completion_rate", "revisit_rate"]},
    "episodes.csv": {"required": ["episode", "readers"], "optional": []},
    "countries.csv": {"required": ["country"], "one_of": ["readers", "views"], "optional": []},
}


def fail(code, msg):
    print(f"[거부] {msg}", file=sys.stderr)
    sys.exit(code)


def read_policy(path, today):
    if not os.path.exists(path):
        fail(EXIT_POLICY, f"보안 승인 기록이 없다: {path}")
    fields = {}
    pat = re.compile(r"^\s*[-*]?\s*(상태|외부 AI 전송|만료일|승인자|승인일|허용 범위)\s*[:：]\s*(.*?)\s*$")
    with open(path, encoding="utf-8") as f:
        for line in f:
            m = pat.match(line)
            if m:
                fields[m.group(1)] = m.group(2)
    if fields.get("상태") != "승인":
        fail(EXIT_POLICY, f"승인 상태가 아니다(상태: {fields.get('상태') or '없음'}). 1–2주 차 보안 검토 승인 뒤에 실행한다.")
    if fields.get("외부 AI 전송") != "허용":
        fail(EXIT_POLICY, f"내부 지표를 외부 AI에 보내는 것이 허용되지 않았다(외부 AI 전송: {fields.get('외부 AI 전송') or '없음'}).")
    approved_on = fields.get("승인일", "")
    if approved_on:
        try:
            if date.fromisoformat(approved_on) > today:
                fail(EXIT_POLICY, f"승인일({approved_on})이 기준일({today})보다 늦다. 승인 기록을 확인한다.")
        except ValueError:
            fail(EXIT_POLICY, f"승인일 형식이 잘못됐다: {approved_on} (YYYY-MM-DD)")
    expiry = fields.get("만료일", "")
    if expiry:
        try:
            if date.fromisoformat(expiry) < today:
                fail(EXIT_POLICY, f"승인이 만료됐다(만료일 {expiry}).")
        except ValueError:
            fail(EXIT_POLICY, f"만료일 형식이 잘못됐다: {expiry} (YYYY-MM-DD)")
    return fields


def check_pii(fname, header):
    for col in header:
        c = col.strip().lower()
        for p in PII_PATTERNS:
            if re.search(p, c):
                fail(EXIT_PII, f"{fname}: 개인 식별 가능 열로 보인다 → '{col}'. 작품 단위 집계만 받는다.")


def load_csv(path, spec, fname):
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
        header = rows[0].keys() if rows else []
    if not rows:
        fail(EXIT_INPUT, f"{fname}: 데이터 행이 없다.")
    check_pii(fname, header)
    if len(rows) > MAX_ROWS:
        fail(EXIT_PII, f"{fname}: 행이 {len(rows)}개다. 작품 단위 집계로 보기 어렵다(상한 {MAX_ROWS}).")
    missing = [c for c in spec["required"] if c not in header]
    if missing:
        fail(EXIT_INPUT, f"{fname}: 필요한 열이 없다 → {missing}")
    if "one_of" in spec and not any(c in header for c in spec["one_of"]):
        fail(EXIT_INPUT, f"{fname}: {spec['one_of']} 가운데 하나가 필요하다.")
    return rows


def num(v, fname, col):
    try:
        return float(str(v).replace(",", "").strip())
    except ValueError:
        fail(EXIT_INPUT, f"{fname}: '{col}' 값이 숫자가 아니다 → {v!r}")


def rate(v, fname, col):
    if v is None or str(v).strip() == "":
        return None
    x = num(v, fname, col)
    return x / 100 if x > 1 else x


def unit_check(rows, warnings):
    """비율 열에 0~1 값과 % 값이 섞여 있으면 경고한다. 스크립트가 조용히 맞춰 버리면 데이터 품질 문제가 가려진다."""
    for col in ("completion_rate", "revisit_rate"):
        raw = [(r["period"], float(str(r[col]).replace(",", "")))
               for r in rows if r.get(col) not in (None, "") and str(r[col]).strip()]
        ratio = [p for p, v in raw if v <= 1]
        percent = [p for p, v in raw if v > 1]
        if ratio and percent:
            warnings.append(f"{col} 단위가 기간마다 다르다(0~1: {', '.join(ratio)} / %: {', '.join(percent)}). "
                            f"스크립트는 1보다 큰 값을 %로 보고 맞췄다. 데이터 담당에게 확인한다")


def summarize(rows):
    out = []
    for r in rows:
        ur = num(r["unique_readers"], "summary.csv", "unique_readers")
        tv = num(r["total_views"], "summary.csv", "total_views")
        out.append({
            "period": r["period"].strip(),
            "unique_readers": int(ur),
            "total_views": int(tv),
            "views_per_reader": round(tv / ur, 2) if ur else None,
            "completion_rate": rate(r.get("completion_rate"), "summary.csv", "completion_rate"),
            "revisit_rate": rate(r.get("revisit_rate"), "summary.csv", "revisit_rate"),
        })
    return out


def episodes(rows):
    pts = sorted((int(num(r["episode"], "episodes.csv", "episode")),
                  num(r["readers"], "episodes.csv", "readers")) for r in rows)
    first_ep, first = pts[0]
    if first <= 0:
        fail(EXIT_INPUT, "episodes.csv: 첫 회차 열람자가 0이다.")
    ret = {ep: v / first for ep, v in pts}

    def at(k):
        cands = [ep for ep in ret if ep >= k]
        return round(ret[min(cands)], 3) if cands else None

    half = next((ep for ep, r in sorted(ret.items()) if r < 0.5), None)
    step = max(1, len(pts) // 10)
    return {
        "count": len(pts),
        "first_episode": first_ep,
        "last_episode": pts[-1][0],
        "retention": {"ep3": at(3), "ep10": at(10), "ep30": at(30), "last": round(ret[pts[-1][0]], 3)},
        "half_point_episode": half,
        "curve_sample": [{"episode": ep, "retention": round(ret[ep], 3)} for ep, _ in pts[::step]],
    }


def countries(rows, min_cell):
    metric = "readers" if "readers" in rows[0] else "views"
    vals = [(r["country"].strip(), num(r[metric], "countries.csv", metric)) for r in rows]
    total = sum(v for _, v in vals)
    shown, small = [], []
    for c, v in sorted(vals, key=lambda x: -x[1]):
        (shown if v >= min_cell else small).append((c, v))
    out = [{"country": c, "value": int(v), "share": round(v / total, 4)} for c, v in shown]
    if small:
        sv = sum(v for _, v in small)
        out.append({"country": f"기타(소수 국가 {len(small)}개)",
                    "value": int(sv) if sv >= min_cell else None,
                    "share": round(sv / total, 4) if sv >= min_cell else None,
                    "suppressed": sv < min_cell})
    return {"metric": metric, "total": int(total), "min_cell": min_cell, "rows": out}


def pct(x):
    return "—" if x is None else f"{x * 100:.1f}%"


def to_md(res):
    lines = [f"### 내부 집계 지표: {res['ip']} (기준일 {res['today']})", ""]
    if res.get("summary"):
        lines += ["| 기간 | 순 독자 수 | 누적 열람 | 독자 1인당 열람 | 완독률 | 재방문율 |",
                  "| --- | --- | --- | --- | --- | --- |"]
        for s in res["summary"]:
            lines.append(f"| {s['period']} | {s['unique_readers']:,} | {s['total_views']:,} | "
                         f"{s['views_per_reader']} | {pct(s['completion_rate'])} | {pct(s['revisit_rate'])} |")
        lines.append("")
    if res.get("episodes"):
        e = res["episodes"]
        r = e["retention"]
        lines += [f"회차 {e['first_episode']}–{e['last_episode']}화({e['count']}개) 기준 1화 대비 열람자 비율: "
                  f"3화 {pct(r['ep3'])}, 10화 {pct(r['ep10'])}, 30화 {pct(r['ep30'])}, 마지막 회차 {pct(r['last'])}. "
                  f"50% 아래로 처음 내려간 회차: {e['half_point_episode'] or '없음'}", ""]
    if res.get("countries"):
        c = res["countries"]
        lines += [f"| 국가 | {c['metric']} | 비중 |", "| --- | --- | --- |"]
        for row in c["rows"]:
            v = "숨김" if row.get("suppressed") else f"{row['value']:,}"
            lines.append(f"| {row['country']} | {v} | {pct(row['share'])} |")
        lines.append(f"\n{c['min_cell']} 미만인 국가는 묶거나 숨겼다.")
    if res.get("compare"):
        lines += ["", "| 비교 IP(최근 기간) | 독자 1인당 열람 | 완독률 | 재방문율 |", "| --- | --- | --- | --- |"]
        for name, s in res["compare"].items():
            lines.append(f"| {name} | {s['views_per_reader']} | {pct(s['completion_rate'])} | {pct(s['revisit_rate'])} |")
    if res["warnings"]:
        lines += ["", "주의: " + " / ".join(res["warnings"])]
    return "\n".join(lines)


def analyze_dir(d, min_cell, warnings):
    res = {}
    found = False
    for fname, spec in SPECS.items():
        p = os.path.join(d, fname)
        if not os.path.exists(p):
            warnings.append(f"{fname} 없음")
            continue
        found = True
        rows = load_csv(p, spec, fname)
        if fname == "summary.csv":
            unit_check(rows, warnings)
            res["summary"] = summarize(rows)
        elif fname == "episodes.csv":
            res["episodes"] = episodes(rows)
        else:
            res["countries"] = countries(rows, min_cell)
    others = [f for f in os.listdir(d) if f.endswith(".csv") and f not in SPECS]
    if others:
        warnings.append(f"규약 밖 파일은 읽지 않았다: {others}")
    if not found:
        fail(EXIT_INPUT, f"{d}: summary.csv, episodes.csv, countries.csv 가운데 하나도 없다.")
    return res


def main():
    ap = argparse.ArgumentParser(description="작품 단위 비식별 집계 지표 계산")
    ap.add_argument("--ip", required=True)
    ap.add_argument("--data", required=True, help="_workspace/00_input/internal/{ip}")
    ap.add_argument("--policy", default="policy/data-approval.md")
    ap.add_argument("--out", help="JSON 출력 경로")
    ap.add_argument("--md", help="Markdown 출력 경로(없으면 표준 출력)")
    ap.add_argument("--min-cell", type=int, default=50)
    ap.add_argument("--today", help="YYYY-MM-DD(기본: 시스템 날짜)")
    ap.add_argument("--compare", nargs="*", default=[], help="비교 IP 데이터 폴더(summary.csv)")
    a = ap.parse_args()

    today = date.fromisoformat(a.today) if a.today else date.today()
    policy = read_policy(a.policy, today)
    if not os.path.isdir(a.data):
        fail(EXIT_INPUT, f"데이터 폴더가 없다: {a.data}")

    warnings = []
    if today != date.today():
        warnings.append(f"기준일({today})이 시스템 날짜({date.today()})와 다르다. 승인·만료 판단은 기준일로 했다")
    res = {"ip": a.ip, "today": today.isoformat(),
           "policy": {k: policy.get(k, "") for k in ("승인자", "승인일", "만료일", "허용 범위")}}
    res.update(analyze_dir(a.data, a.min_cell, warnings))
    if a.compare:
        res["compare"] = {}
        for d in a.compare:
            p = os.path.join(d, "summary.csv")
            if not os.path.exists(p):
                warnings.append(f"비교 폴더에 summary.csv 없음: {d}")
                continue
            s = summarize(load_csv(p, SPECS["summary.csv"], f"{d}/summary.csv"))
            res["compare"][os.path.basename(os.path.normpath(d))] = s[-1]
    res["warnings"] = warnings

    if a.out:
        os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
        with open(a.out, "w", encoding="utf-8") as f:
            json.dump(res, f, ensure_ascii=False, indent=2)
    md = to_md(res)
    if a.md:
        with open(a.md, "w", encoding="utf-8") as f:
            f.write(md + "\n")
    print(md)


if __name__ == "__main__":
    main()
