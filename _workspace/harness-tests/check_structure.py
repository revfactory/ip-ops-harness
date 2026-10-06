import os, re, sys, glob
root = sys.argv[1]
A = os.path.join(root, '.claude/agents'); K = os.path.join(root, '.claude/skills')
problems = []
def fm(path):
    t = open(path, encoding='utf-8').read()
    m = re.match(r'^---\n(.*?)\n---\n', t, re.S)
    if not m: problems.append(f'프론트매터 없음: {path}'); return {}, t
    d = {}
    for line in m.group(1).splitlines():
        mm = re.match(r'^(\w+):\s*(.*)$', line)
        if mm: d[mm.group(1)] = mm.group(2)
    return d, t
agents = {}
for p in sorted(glob.glob(f'{A}/*.md')):
    d, t = fm(p); n = os.path.basename(p)[:-3]
    agents[n] = (d, t)
    for k in ('name','description','model'):
        if k not in d: problems.append(f'에이전트 {n}: {k} 없음')
    if d.get('name') != n: problems.append(f'에이전트 이름 불일치: {n} vs {d.get("name")}')
    if not re.search(r'^# model: ', t, re.M): problems.append(f'에이전트 {n}: 모델 선택 이유 주석 없음')
    for sec in ('## 핵심 역할','## 작업 원칙','## 입력·출력 규칙','## 오류 처리','## 협업'):
        if sec not in t: problems.append(f'에이전트 {n}: {sec} 없음')
skills = {}
for p in sorted(glob.glob(f'{K}/*/SKILL.md')):
    d, t = fm(p); n = os.path.basename(os.path.dirname(p))
    skills[n] = (d, t)
    for k in ('name','description'):
        if k not in d: problems.append(f'스킬 {n}: {k} 없음')
    if d.get('name') != n: problems.append(f'스킬 이름 불일치: {n} vs {d.get("name")}')
    lines = t.count('\n')
    if lines >= 500: problems.append(f'스킬 {n}: {lines}줄(500 이상)')
    # 스킬 안에서 참조한 references/ scripts/ workflows/ 파일 존재
    for ref in set(re.findall(r'(?:references|scripts|workflows)/[\w\-.]+\.(?:md|py|js)', t)):
        if not os.path.exists(os.path.join(K, n, ref)):
            # 다른 스킬 경로로 쓴 경우 허용
            hits = glob.glob(f'{K}/*/{ref}')
            if not hits: problems.append(f'스킬 {n}: 참조 파일 없음 {ref}')
# 에이전트 본문이 언급한 스킬 이름이 존재하는가
skill_names = set(skills)
for n, (d, t) in agents.items():
    for m in re.findall(r'`([a-z][a-z0-9\-]+)` 스킬', t):
        if m not in skill_names: problems.append(f'에이전트 {n}: 없는 스킬 참조 {m}')
# 스킬·워크플로가 언급한 에이전트 이름이 존재하는가
agent_names = set(agents)
for f in glob.glob(f'{K}/**/*.*', recursive=True):
    if not f.endswith(('.md','.js')): continue
    t = open(f, encoding='utf-8').read()
    for m in re.findall(r"(?:subagent_type|agentType)\W{0,4}([a-z][a-z0-9\-]+)", t):
        if m not in agent_names and m not in ('general','general-purpose'):
            problems.append(f'{os.path.relpath(f, root)}: 없는 에이전트 유형 {m}')
# 모든 에이전트가 오케스트레이터 표에 있는가
orch = skills['ip-ops-harness'][1]
for n in agent_names:
    if f'`{n}`' not in orch: problems.append(f'오케스트레이터 표에 없는 에이전트: {n}')
# 모든 스킬이 어딘가에서 연결되는가
alltext = '\n'.join(t for _, t in agents.values()) + orch
for n in skill_names:
    if n != 'ip-ops-harness' and n not in alltext: problems.append(f'연결되지 않은 스킬: {n}')
# v1 잔재, commands 디렉터리
for f in glob.glob(f'{root}/.claude/**/*.*', recursive=True):
    if f.endswith(('.md','.js','.py')):
        t = open(f, encoding='utf-8').read()
        for bad in ('TeamCreate','TeamDelete','team_name','CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS'):
            if bad in t: problems.append(f'v1 잔재 {bad}: {f}')
if os.path.exists(f'{root}/.claude/commands'): problems.append('.claude/commands 존재')
# 300줄 넘는 참조 문서에 목차
for f in glob.glob(f'{K}/*/references/*.md'):
    t = open(f, encoding='utf-8').read()
    if t.count('\n') > 300 and '목차' not in t: problems.append(f'목차 없음(300줄 초과): {f}')
from collections import Counter
print(f'에이전트 {len(agents)}명, 스킬 {len(skills)}개')
print('모델 분포:', dict(Counter(d.get("model") for d,_ in agents.values())))
print('스킬 줄 수:', {n: t.count(chr(10)) for n,(d,t) in skills.items()})
print('문제', len(problems), '건'); [print(' -', p) for p in problems]
