#!/usr/bin/env python3
"""사후 검증 블라인드 자료·판정의 누출 검사.

검사 항목
  ERROR  작품명·별칭·가린 용어(두 사례 모두)가 남아 있다
  ERROR  해당 사례의 컷오프 이후 날짜가 있다
  WARN   결과를 암시하는 단어(시청률, 종영, 흥행 등)가 있다
  RECOG  판정 파일의 '## 인식 점검' 절에서 판정단이 이 사례의 작품명을 맞혔다

종료 코드: 0 깨끗함 · 1 누출(ERROR) 있음 · 2 누출은 없지만 판정단이 작품을 알아봄
"""
import argparse
import json
import os
import re
import sys
from datetime import date

DEFAULT_LEAK_WORDS = ["시청률", "종영", "최종회", "흥행", "참패", "부진", "역주행", "화제성 1위", "넷플릭스 1위", "방영 후"]
TEXT_EXT = (".md", ".txt", ".json", ".csv")
FULL = re.compile(r"(20\d{2})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?")
YM = re.compile(r"(20\d{2})\s*[-./년]\s*(\d{1,2})\s*월?(?!\s*[-./]?\s*\d)")
Y = re.compile(r"(20\d{2})\s*년")


def norm(s):
    return re.sub(r"[\s·・\-_,.:'\"“”‘’!?()\[\]]+", "", s).lower()


def files_in(paths):
    for p in paths:
        if os.path.isdir(p):
            for root, _, names in os.walk(p):
                for n in sorted(names):
                    if n.endswith(TEXT_EXT):
                        yield os.path.join(root, n)
        elif os.path.exists(p):
            yield p
        else:
            print(f"WARN {p}: 경로가 없다")


def dates_after(line, cutoff):
    hits = []
    rest = line
    for m in FULL.finditer(line):
        y, mo, d = map(int, m.groups())
        try:
            if date(y, mo, d) > cutoff:
                hits.append(m.group(0))
        except ValueError:
            pass
    rest = FULL.sub(" ", rest)
    for m in YM.finditer(rest):
        y, mo = int(m.group(1)), int(m.group(2))
        if 1 <= mo <= 12 and (y, mo) > (cutoff.year, cutoff.month):
            hits.append(m.group(0))
    rest = YM.sub(" ", rest)
    for m in Y.finditer(rest):
        if int(m.group(1)) > cutoff.year:
            hits.append(m.group(0))
    return hits


def main():
    ap = argparse.ArgumentParser(description="블라인드 자료 누출 검사")
    ap.add_argument("--key", required=True, help="sealed/key.json")
    ap.add_argument("--case", required=True, help="검사하는 사례 코드(예: A)")
    ap.add_argument("paths", nargs="+")
    a = ap.parse_args()

    with open(a.key, encoding="utf-8") as f:
        key = json.load(f)
    cases = key.get("cases", {})
    if a.case not in cases:
        print(f"ERROR key.json에 사례 {a.case}가 없다")
        sys.exit(1)
    cutoff = date.fromisoformat(cases[a.case]["cutoff"])
    leak_words = key.get("leak_words") or DEFAULT_LEAK_WORDS

    terms = []  # (정규화 용어, 원래 용어, 사례 코드)
    for code, c in cases.items():
        for t in [c.get("title", "")] + c.get("aliases", []) + c.get("terms", []):
            t = (t or "").strip()
            if len(norm(t)) < 2:
                if t:
                    print(f"WARN key.json 사례 {code}: '{t}'는 너무 짧아 검사하지 않는다")
                continue
            terms.append((norm(t), t, code))
    own_titles = [norm(t) for t in [cases[a.case].get("title", "")] + cases[a.case].get("aliases", []) if len(norm(t or "")) >= 2]

    errors = warns = 0
    recognized = False
    for path in files_in(a.paths):
        in_recog = False
        with open(path, encoding="utf-8", errors="replace") as f:
            for i, line in enumerate(f, 1):
                if line.startswith("## "):
                    in_recog = line.strip().startswith("## 인식 점검")
                n = norm(line)
                if in_recog:
                    if any(t in n for t in own_titles):
                        recognized = True
                        print(f"RECOG {path}:{i}: 판정단이 이 사례의 작품명을 적었다 → 오염 가능으로 표시")
                    continue
                for tn, t, code in terms:
                    if tn in n:
                        errors += 1
                        print(f"ERROR {path}:{i}: 가려야 할 용어 '{t}'(사례 {code})")
                for d in dates_after(line, cutoff):
                    errors += 1
                    print(f"ERROR {path}:{i}: 컷오프({cutoff}) 이후 날짜 '{d.strip()}'")
                for w in leak_words:
                    if w in line:
                        warns += 1
                        print(f"WARN  {path}:{i}: 결과를 암시할 수 있는 단어 '{w}'")

    print(f"요약: 누출 {errors}건, 주의 {warns}건, 인식 {'예' if recognized else '아니오'} (사례 {a.case}, 컷오프 {cutoff})")
    sys.exit(1 if errors else (2 if recognized else 0))


if __name__ == "__main__":
    main()
