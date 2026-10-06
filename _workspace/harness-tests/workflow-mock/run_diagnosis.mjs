import fs from 'fs'
const src = fs.readFileSync(process.argv[2], 'utf8').replace('export const meta', 'const meta')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const logs = [], calls = []
const sleep = ms => new Promise(r => setTimeout(r, ms))
// 시나리오: ip-a(내부 O, 주장 20개, 검증 묶음 2 중 1개 실패, 판정서 1차 검토 수정 필요),
//          ip-b(글로벌 분석 실패 → 부분 심사), ip-c(공개 신호 실패 → 중단)
let reviewCount = {}
async function agent(prompt, opts) {
  calls.push(opts.label); await sleep(1)
  const [kind, slug, batch] = opts.label.split(':')
  const t = opts.agentType
  if (t === 'ent-researcher') return slug === 'ip-c' ? null : { path: `_workspace/ips/${slug}/r1/10_researcher_signals.md`, summary: 's', gaps: [] }
  if (t === 'internal-data-analyst') return { path: `_workspace/ips/${slug}/r1/11_data_internal-signals.md`, summary: 'i', gaps: [] }
  if (['format-expansion-planner', 'global-fit-analyst', 'rights-revenue-analyst'].includes(t)) {
    if (slug === 'ip-b' && t === 'global-fit-analyst') return null
    return { path: `_workspace/ips/${slug}/r1/${kind}.md`, summary: 'a', gaps: [] }
  }
  if (t === 'ip-investment-judge' && kind === '주장') {
    const n = slug === 'ip-a' ? 20 : 5
    return { claims: Array.from({ length: n }, (_, i) => ({ id: `P-${String(i + 1).padStart(2, '0')}`, claim: `주장 ${i + 1}`, source_file: 'x', evidence: 'e', core: i < 3 })) }
  }
  if (t === 'evidence-verifier') {
    if (slug === 'ip-a' && batch === '2') return null
    const ids = [...prompt.matchAll(/"id": "(P-\d+)"/g)].map(m => m[1])
    return { results: ids.map(id => ({ id, status: id === 'P-02' ? 'refuted' : id === 'P-03' ? 'uncertain' : 'confirmed', best_source_grade: id === 'P-04' ? 'C' : 'A', note: 'n' })) }
  }
  if (t === 'ip-investment-judge' && kind === '판정') {
    if (!prompt.includes('P-01 | 통과') || (slug === 'ip-a' && !prompt.includes('P-02 | 기각'))) throw new Error('분류 전달 실패')
    return { path: `_workspace/ips/${slug}/r1/31_judge_verdict.md`, grade: 'B', partial: prompt.includes('누락된 분석'), one_liner: 'B · 조건부 — 테스트',
      formats: [{ format: '공연', grade: 'B · 조건부', reason: 'r' }, { format: '실사 드라마', grade: 'C · 관찰', reason: 'r' }],
      flip_conditions: ['권리'], final_counts: { pass: 10, conditional: 8, rejected: 2 }, overrides: 1 }
  }
  if (t === 'verdict-writer') return { path: `_workspace/ips/${slug}/r1/40_writer_dossier.md`, summary: prompt.includes('검토 의견') ? 'v2' : 'v1', gaps: [] }
  if (t === 'dossier-reviewer') {
    reviewCount[slug] = (reviewCount[slug] || 0) + 1
    if (slug === 'ip-a' && reviewCount[slug] === 1) return { result: '수정 필요', issues: [{ severity: '높음', where: '2절', problem: '단서 누락', fix: 'f' }, { severity: '낮음', where: '12', problem: 'p', fix: 'f' }] }
    return { result: '통과', issues: [] }
  }
  throw new Error('예상하지 못한 호출 ' + opts.label)
}
const parallel = thunks => Promise.all(thunks.map(t => t().catch(() => null)))
const pipeline = (items, ...stages) => Promise.all(items.map(async it => {
  let x = it
  for (const st of stages) { try { x = await st(x, it) } catch (e) { logs.push('stage error: ' + e.message); return null } }
  return x
}))
const args = JSON.parse(process.argv[3])
const fn = new AsyncFunction('args', 'agent', 'parallel', 'pipeline', 'phase', 'log', 'budget', src)
const out = await fn(args, agent, parallel, pipeline, () => {}, m => logs.push(m), { total: 0, remaining: () => Infinity })
fs.writeFileSync(process.argv[4], JSON.stringify(out, null, 1))
console.log('로그:'); logs.forEach(l => console.log(' ', l))
console.log('호출 수:', calls.length)
console.log('반환 요약:', JSON.stringify({ missingIps: out.missingIps, results: out.results.map(r => ({ ip: r.ip, partial: r.partial, missing: r.missing_analyses, vfail: r.verifier_failures, vjobs: r.verifier_jobs, proposed: r.proposed_counts, revised: r.revised, review: r.review.result, internal: r.internal_used })) }, null, 1))
