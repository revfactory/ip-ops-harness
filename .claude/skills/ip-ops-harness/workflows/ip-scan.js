export const meta = {
  name: 'ip-scan',
  description: '후보 IP마다 공개 신호 카드를 만들고 스크리닝 심사한 뒤, 전체를 비교해 심층 진단 우선순위를 정한다',
  phases: [
    { title: '신호 수집', detail: '후보별 스크리닝 카드' },
    { title: '스크리닝', detail: '후보별 적대적 스크리닝 심사' },
    { title: '순위', detail: '전체 후보를 비교해 심층 진단 우선순위를 정한다' },
  ],
}

// args = {
//   items: [{ title, hint? }],   // 메인이 사전 확인으로 확정한 후보 목록
//   today: 'YYYY-MM-DD',
//   take: 3,                     // 심층 진단으로 올릴 후보 수(제안)
//   criteria: '...'              // 선택: 사용자가 준 선정 조건
// }
const today = args.today
const items = args.items || []
const take = args.take || 3
if (!today) return { error: 'args.today(YYYY-MM-DD)가 필요하다' }
if (!items.length) return { error: 'args.items가 비어 있다' }

const CARD = { type: 'object', required: ['ip', 'slug', 'platform', 'headroom', 'evidence_level', 'sources'], properties: {
  ip: { type: 'string' }, slug: { type: 'string' }, platform: { type: 'string' }, publisher: { type: 'string' },
  period: { type: 'string' }, scale: { type: 'string' }, engagement: { type: 'string' }, global: { type: 'string' },
  expansions_done: { type: 'array', items: { type: 'string' } },
  headroom: { type: 'string' }, urgency: { type: 'string' },
  kakao_origin: { type: 'boolean' },
  evidence_level: { type: 'string', enum: ['상', '중', '하'] },
  sources: { type: 'array', items: { type: 'string' } } } }
const LEVEL = { type: 'string', enum: ['상', '중', '하'] }
const SCREEN = { type: 'object', required: ['ip', 'priority', 'scores', 'reason', 'counter'], properties: {
  ip: { type: 'string' },
  priority: { type: 'string', enum: ['심층 진단', '관찰', '제외'] },
  scores: { type: 'object', required: ['headroom', 'signal', 'synergy', 'urgency'], properties: {
    headroom: LEVEL, signal: LEVEL, synergy: LEVEL, urgency: LEVEL } },
  reason: { type: 'string' }, counter: { type: 'string' } } }
const RANK = { type: 'object', required: ['picks', 'note'], properties: {
  picks: { type: 'array', items: { type: 'object', required: ['ip', 'why'], properties: {
    ip: { type: 'string' }, why: { type: 'string' } } } },
  benchmarks: { type: 'array', items: { type: 'object', required: ['ip', 'why'], properties: {
    ip: { type: 'string' }, why: { type: 'string' } } } },
  note: { type: 'string' } } }

const screened = await pipeline(
  items,
  it => agent(
    `"${it.title}"의 후보 스크리닝 카드를 만든다. 기준일 ${today}. ent-research 스킬 references/ip-signals.md 「후보 스크리닝 카드」를 따른다.\n` +
    (it.hint ? `참고: ${it.hint}\n` : '') +
    `카카오엔터 원천 IP인지(kakao_origin) 반드시 확인한다. 파일은 쓰지 않고 카드만 반환한다. slug는 영문 소문자와 하이픈으로 만든다.`,
    { label: `카드:${it.title}`, phase: '신호 수집', agentType: 'ent-researcher', schema: CARD }),
  card => {
    if (!card) return null
    return agent(
      `ip-investment-review 스킬 「1. 스크리닝」 기준으로 다음 후보를 심사한다. 근거가 약하면 낮게 매긴다. 파일은 쓰지 않는다.\n` +
      (args.criteria ? `사용자 선정 조건: ${args.criteria}\n` : '') +
      `${JSON.stringify(card, null, 1)}`,
      { label: `심사:${card.ip}`, phase: '스크리닝', agentType: 'ip-investment-judge', schema: SCREEN })
      .then(s => (s ? { card, screen: s } : { card, screen: null }))
  },
)

const ok = screened.filter(Boolean)
const judged = ok.filter(x => x.screen)
log(`후보 ${items.length}개 중 카드 ${ok.length}개, 심사 ${judged.length}개 완료. 누락 ${items.length - judged.length}개`)
if (!judged.length) return { error: '심사를 마친 후보가 없다', cards: ok.map(x => x.card) }

phase('순위')
const rank = await agent(
  `다음 후보 ${judged.length}개의 카드와 스크리닝 결과를 비교해 심층 진단할 후보 ${take}개를 고른다. ip-investment-review 스킬 「1. 스크리닝」을 따른다.\n` +
  `고른 이유가 "이미 성공했으니까"인 후보는 picks가 아니라 benchmarks(기준점)로 둔다. 카카오엔터 원천이 아닌 후보는 고르지 않는다. 파일은 쓰지 않는다.\n` +
  `${JSON.stringify(judged, null, 1)}`,
  { label: '순위', phase: '순위', agentType: 'ip-investment-judge', schema: RANK })
if (!rank) log('순위 결정 실패: 후보별 스크리닝 결과만 반환한다')

return {
  today, total: items.length, carded: ok.length, screened: judged.length,
  missing: items.filter((it, i) => !screened[i] || !screened[i].screen).map(it => it.title),
  rank, candidates: judged,
}
