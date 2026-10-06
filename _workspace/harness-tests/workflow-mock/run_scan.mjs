import fs from 'fs'
const src = fs.readFileSync(process.argv[2], 'utf8').replace('export const meta', 'const meta')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const logs = []
async function agent(prompt, opts) {
  const t = opts.agentType, title = opts.label.split(':')[1]
  if (opts.label.startsWith('카드')) return title === '실패작' ? null : { ip: title, slug: 'x', platform: '카카오페이지', headroom: 'h', evidence_level: '중', sources: ['u'], kakao_origin: true }
  if (opts.label.startsWith('심사')) return title === '심사실패' ? null : { ip: title, priority: '심층 진단', scores: { headroom: '상', signal: '중', synergy: '상', urgency: '중' }, reason: 'r', counter: 'c' }
  if (opts.label === '순위') { const n = (prompt.match(/"priority"/g) || []).length; return { picks: [{ ip: 'A', why: `심사 ${n}개 비교` }], benchmarks: [], note: 'n' } }
}
const parallel = th => Promise.all(th.map(t => t().catch(() => null)))
const pipeline = (items, ...st) => Promise.all(items.map(async it => { let x = it; for (const s of st) { try { x = await s(x, it) } catch (e) { return null } } return x }))
const fn = new AsyncFunction('args', 'agent', 'parallel', 'pipeline', 'phase', 'log', 'budget', src)
const out = await fn(JSON.parse(process.argv[3]), agent, parallel, pipeline, () => {}, m => logs.push(m), {})
console.log(logs.join('\n')); console.log(JSON.stringify({ total: out.total, carded: out.carded, screened: out.screened, missing: out.missing, picks: out.rank.picks }))
