export const meta = {
  name: 'ip-diagnosis',
  description: 'IP마다 신호 수집, 확장 기획 3관점, 주장 검증, 최종 판정, 판정서 작성·검토를 이어서 실행한다',
  phases: [
    { title: '신호', detail: '공개 신호 카드와 내부 집계 신호를 만든다' },
    { title: '확장 기획', detail: '확장 지도, 글로벌 적합성, 권리 점검을 병렬로 만든다' },
    { title: '주장 검증', detail: '판단에 영향을 주는 주장을 뽑아 묶음별로 원문과 다시 맞춘다' },
    { title: '판정', detail: '검증 결과로 등급 초안과 포맷별 판정을 낸다' },
    { title: '판정서', detail: '판정 회의용 판정서를 쓰고 판정문과 대조해 검토한다' },
  ],
}

// args = {
//   ips: [{ slug, title, internal?: boolean, priorVerdict?: '_workspace/ips/{ip}/r1/31_judge_verdict.md' }],
//   round: 1 | 2,            // 1차: 공개 자료, 2차: 공개 자료 + 내부 지표
//   today: 'YYYY-MM-DD',     // 메인이 넘긴다. 스크립트에서 날짜 함수를 쓰지 않는다
//   depth: 'standard' | 'thorough',
//   from: 'signals' | 'analyses' | 'claims',   // 어느 단계부터 실행할지. 앞 단계 파일은 이미 있어야 한다
//   ws: '_workspace/ips'
// }
const ws = args.ws || '_workspace/ips'
const round = args.round || 1
const today = args.today
const from = args.from || 'signals'
const thorough = args.depth === 'thorough'
const SPEC = [
  { key: 'planner', agentType: 'format-expansion-planner', file: '20_planner_expansion-map.md', skill: 'format-expansion' },
  { key: 'global', agentType: 'global-fit-analyst', file: '21_global_fit.md', skill: 'global-fit' },
  { key: 'rights', agentType: 'rights-revenue-analyst', file: '22_rights_revenue.md', skill: 'rights-revenue-check(확장 기획 모드)' },
]
const BATCH = thorough ? 8 : 12
const LENSES = thorough
  ? [
      { key: 'source', text: '출처·숫자 관점: 원문을 직접 열어 숫자·단위·날짜·주체가 주장과 일치하는지 확인한다.' },
      { key: 'logic', text: '논리·반대 근거 관점: 근거가 사실이어도 주장까지 이어지는지, 더 강한 반대 근거가 있는지 확인한다.' },
    ]
  : [{ key: 'both', text: '출처·숫자와 논리를 함께 본다: 원문을 열어 숫자·단위·날짜·주체를 확인하고, 근거가 주장까지 이어지는지 판단한다.' }]

const FILE = { type: 'object', required: ['path', 'summary'], properties: {
  path: { type: 'string' }, summary: { type: 'string' },
  gaps: { type: 'array', items: { type: 'string' } } } }
const CLAIMS = { type: 'object', required: ['claims'], properties: {
  claims: { type: 'array', items: { type: 'object',
    required: ['id', 'claim', 'source_file', 'evidence', 'core'], properties: {
      id: { type: 'string' }, claim: { type: 'string' }, source_file: { type: 'string' },
      evidence: { type: 'string' }, core: { type: 'boolean' } } } } } }
const CHECKS = { type: 'object', required: ['results'], properties: {
  results: { type: 'array', items: { type: 'object',
    required: ['id', 'status', 'best_source_grade', 'note'], properties: {
      id: { type: 'string' },
      status: { type: 'string', enum: ['confirmed', 'refuted', 'uncertain'] },
      best_source_grade: { type: 'string', enum: ['A', 'B', 'C', 'none'] },
      note: { type: 'string' }, url: { type: 'string' } } } } } }
const VERDICT = { type: 'object',
  required: ['path', 'grade', 'one_liner', 'formats', 'final_counts', 'overrides'], properties: {
    path: { type: 'string' },
    grade: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
    partial: { type: 'boolean' },
    one_liner: { type: 'string' },
    formats: { type: 'array', items: { type: 'object', required: ['format', 'grade', 'reason'], properties: {
      format: { type: 'string' }, grade: { type: 'string' }, reason: { type: 'string' } } } },
    flip_conditions: { type: 'array', items: { type: 'string' } },
    final_counts: { type: 'object', required: ['pass', 'conditional', 'rejected'], properties: {
      pass: { type: 'integer' }, conditional: { type: 'integer' }, rejected: { type: 'integer' } } },
    overrides: { type: 'integer' } } }
const REVIEW = { type: 'object', required: ['result', 'issues'], properties: {
  result: { type: 'string', enum: ['통과', '수정 필요'] },
  issues: { type: 'array', items: { type: 'object', required: ['severity', 'where', 'problem', 'fix'], properties: {
    severity: { type: 'string', enum: ['높음', '중간', '낮음'] },
    where: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } } } } } }

if (!today) return { error: 'args.today(YYYY-MM-DD)가 필요하다' }
const ips = args.ips || []
if (!ips.length) return { error: 'args.ips가 비어 있다' }

const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}
const isStrong = g => g === 'A' || g === 'B'

// 검증 결과로 제안 분류를 정한다. 최종 분류는 심사위원이 확정한다.
function classify(claim, checks) {
  const mine = checks.filter(x => x.id === claim.id)
  const memo = mine.map(x => `[${x.status}/${x.best_source_grade}] ${x.note}${x.url ? ` (${x.url})` : ''}`).join(' | ')
  let proposed = '조건부'
  if (mine.some(x => x.status === 'refuted')) proposed = '기각'
  else if (mine.length === LENSES.length && mine.every(x => x.status === 'confirmed' && isStrong(x.best_source_grade))) proposed = '통과'
  return { ...claim, proposed, checks: memo || '검증 결과 없음' }
}

const results = await pipeline(
  ips,

  // 1. 신호: 공개 신호 카드(필수) + 내부 신호(승인된 IP만)
  ip => {
    const dir = `${ws}/${ip.slug}/r${round}`
    if (from !== 'signals') {
      return { ip, dir, pub: { path: `${dir}/10_researcher_signals.md` },
        internal: ip.internal ? { path: `${dir}/11_data_internal-signals.md` } : null }
    }
    const jobs = [() => agent(
      `IP "${ip.title}"(슬러그 ${ip.slug})의 심층 신호 카드를 만든다. 기준일 ${today}, ${round}차 판정.\n` +
      `ent-research 스킬과 references/ip-signals.md의 「심층 신호 카드」 형식을 따른다.\n` +
      (ip.priorVerdict ? `이전 차수 신호 카드(${ws}/${ip.slug}/r${round - 1}/10_researcher_signals.md)를 읽고 기준일 이후 바뀐 공개 수치만 갱신한다.\n` : '') +
      `출력 파일: ${dir}/10_researcher_signals.md\n반환: path(출력 파일), summary(핵심 신호 3줄), gaps(확인하지 못한 항목).`,
      { label: `신호:${ip.slug}`, phase: '신호', agentType: 'ent-researcher', schema: FILE })]
    if (ip.internal) jobs.push(() => agent(
      `IP "${ip.title}"(슬러그 ${ip.slug})의 내부 집계 지표를 분석한다. 기준일 ${today}.\n` +
      `internal-signal-analysis 스킬을 따른다. 스크립트가 승인 확인에서 거부하면 분석하지 말고 거부 사유를 summary에 적어 반환한다.\n` +
      `데이터: _workspace/00_input/internal/${ip.slug}/\n` +
      (ip.priorVerdict ? `이전 판정문: ${ip.priorVerdict} (뒤집기 조건 대조 표를 채운다)\n` : '') +
      `출력 파일: ${dir}/11_data_internal-signals.md\n반환: path, summary(판정에 영향을 줄 지표 3줄), gaps.`,
      { label: `내부:${ip.slug}`, phase: '신호', agentType: 'internal-data-analyst', schema: FILE }))
    return parallel(jobs).then(([pub, internal]) => {
      if (!pub) { log(`${ip.slug}: 공개 신호 카드 실패 → 이 IP는 중단`); return null }
      if (ip.internal && !internal) log(`${ip.slug}: 내부 신호 실패 → 공개 자료만으로 진행`)
      return { ip, dir, pub, internal: ip.internal ? internal : null }
    })
  },

  // 2. 확장 기획: 같은 신호를 세 관점에서 독립 분석
  s => {
    if (!s) return null
    const spec = SPEC
    if (from === 'claims') {
      return { ...s, analyses: spec.map(x => ({ key: x.key, path: `${s.dir}/${x.file}`, summary: '(기존 파일)' })), missing: [] }
    }
    const inputs = [`${s.dir}/10_researcher_signals.md`]
      .concat(s.internal ? [`${s.dir}/11_data_internal-signals.md`] : []).join(', ')
    const prior = s.ip.priorVerdict
      ? `\n이전 차수 판정문: ${s.ip.priorVerdict}. 같은 IP의 이전 차수 폴더에 있는 분석을 읽고 새 근거로 바뀌는 칸만 고치며, 바꾼 이유를 수정 기록에 남긴다.` : ''
    return parallel(spec.map(x => () => agent(
      `IP "${s.ip.title}" ${round}차 판정용 분석. 기준일 ${today}. ${x.skill} 스킬을 따른다.\n입력: ${inputs}${prior}\n` +
      `출력 파일: ${s.dir}/${x.file}\n반환: path, summary(한 줄 결론 포함 3줄), gaps.`,
      { label: `${x.key}:${s.ip.slug}`, phase: '확장 기획', agentType: x.agentType, schema: FILE })))
      .then(r => {
        const analyses = spec.map((x, i) => (r[i] ? { key: x.key, path: r[i].path, summary: r[i].summary } : null)).filter(Boolean)
        const missing = spec.filter((x, i) => !r[i]).map(x => x.key)
        if (missing.length) log(`${s.ip.slug}: 분석 누락 ${missing.join(', ')} → 부분 심사로 진행`)
        if (!analyses.length) return null
        return { ...s, analyses, missing }
      })
  },

  // 3. 주장 검증: 심사위원이 주장을 뽑고, 검증자가 묶음별로 원문과 맞춘다
  a => {
    if (!a) return null
    const files = a.analyses.map(x => x.path).join(', ')
    return agent(
      `IP "${a.ip.title}" ${round}차 최종 심사의 1단계 주장 추출. ip-investment-review 스킬 「2. 주장 추출」을 따른다. 아직 판정하지 않는다.\n` +
      `분석 파일: ${files}\n신호 파일: ${a.dir}/10_researcher_signals.md${a.internal ? `, ${a.dir}/11_data_internal-signals.md` : ''}\n` +
      `출력 파일: ${a.dir}/30_judge_claims.md(표). 같은 목록을 claims로 반환한다.`,
      { label: `주장:${a.ip.slug}`, phase: '주장 검증', agentType: 'ip-investment-judge', schema: CLAIMS })
      .then(c => {
        if (!c || !c.claims.length) { log(`${a.ip.slug}: 주장 추출 실패 → 이 IP는 중단`); return null }
        const batches = chunk(c.claims, BATCH)
        const jobs = batches.flatMap((b, bi) => LENSES.map(l => () => agent(
          `다음 주장 ${b.length}개를 검증한다. ip-investment-review 스킬의 references/claim-verification.md를 따른다. 파일을 만들거나 고치지 않는다.\n` +
          `관점: ${l.text}\n근거 파일 위치: ${a.dir}/ 아래 10~22 파일. 주장마다 원문을 직접 확인한다.\n` +
          `받은 id를 하나도 빠뜨리지 말고 반환한다.\n주장 목록:\n${JSON.stringify(b, null, 1)}`,
          { label: `검증:${a.ip.slug}:${bi + 1}:${l.key}`, phase: '주장 검증', agentType: 'evidence-verifier', schema: CHECKS })))
        return parallel(jobs).then(r => {
          const failed = r.filter(x => !x).length
          if (failed) log(`${a.ip.slug}: 검증 ${jobs.length}건 중 ${failed}건 실패 → 해당 주장은 조건부로 넘긴다`)
          const checks = r.filter(Boolean).flatMap(x => x.results)
          return { ...a, claims: c.claims.map(cl => classify(cl, checks)), verifierFailures: failed, verifierJobs: jobs.length }
        })
      })
  },

  // 4. 판정: 제안 분류를 받아 최종 분류와 등급 초안을 낸다
  v => {
    if (!v) return null
    const table = v.claims.map(c => `${c.id} | ${c.proposed} | ${c.core ? 'core' : ''} | ${c.claim} | ${c.checks}`).join('\n')
    return agent(
      `IP "${v.ip.title}" ${round}차 최종 판정. ip-investment-review 스킬 「4. 최종 판정」과 「6. 판정문 형식」을 따른다. 기준일 ${today}.\n` +
      `검증자 결과로 정한 제안 분류(id | 제안 분류 | core | 주장 | 검증 메모):\n${table}\n` +
      `제안 분류를 바꾸면 주장별 심사 표의 '바꾼 이유'에 근거를 적고 overrides에 센다.\n` +
      `분석 파일: ${v.analyses.map(x => x.path).join(', ')}` +
      (v.missing.length ? `\n누락된 분석: ${v.missing.join(', ')} → 판정문 맨 위에 적고 partial=true로 반환한다.` : '') +
      (v.ip.priorVerdict ? `\n이전 차수 판정문: ${v.ip.priorVerdict} → 바뀐 칸을 「판정 변경」에 적는다.` : '') +
      `\n출력 파일: ${v.dir}/31_judge_verdict.md\n` +
      `반환: path, grade, partial, one_liner(판정문 한 줄 판정 그대로), formats(포맷별 판정 표 그대로), flip_conditions, final_counts{pass,conditional,rejected}, overrides.`,
      { label: `판정:${v.ip.slug}`, phase: '판정', agentType: 'ip-investment-judge', schema: VERDICT })
      .then(r => {
        if (!r) { log(`${v.ip.slug}: 최종 판정 실패`); return null }
        return { ...v, verdict: r }
      })
  },

  // 5. 판정서: 작성 → 검토 → (높음·중간 지적이 있으면) 한 번 고치고 다시 검토
  d => {
    if (!d) return null
    const dossier = `${d.dir}/40_writer_dossier.md`
    const write = extra => agent(
      `IP "${d.ip.title}" ${round}차 판정서를 쓴다. verdict-dossier 스킬을 따른다. 기준일 ${today}.\n` +
      `판정문: ${d.verdict.path}\n분석·신호 파일: ${d.dir}/ 아래 10~31 파일\n` +
      (d.ip.priorVerdict ? `이전 차수 판정서: ${ws}/${d.ip.slug}/r${round - 1}/40_writer_dossier.md\n` : '') +
      `출력 파일: ${dossier}${extra}\n반환: path, summary, gaps.`,
      { label: `판정서:${d.ip.slug}`, phase: '판정서', agentType: 'verdict-writer', schema: FILE })
    const review = () => agent(
      `판정서 ${dossier}를 판정문 ${d.verdict.path}와 대조해 검토한다. verdict-dossier 스킬의 references/review-checklist.md를 따른다. 파일을 만들거나 고치지 않는다.`,
      { label: `검토:${d.ip.slug}`, phase: '판정서', agentType: 'dossier-reviewer', schema: REVIEW })
    return write('').then(w => {
      if (!w) { log(`${d.ip.slug}: 판정서 작성 실패`); return { ...d, dossier: null, review: null, revised: false } }
      return review().then(r1 => {
        const serious = r1 ? r1.issues.filter(i => i.severity !== '낮음') : []
        if (!r1 || r1.result === '통과' || !serious.length) return { ...d, dossier: w, review: r1, revised: false }
        return write(`\n검토 의견(높음·중간만 반영하고, 반영하지 않은 의견은 이유와 함께 「수정 기록」에 남긴다):\n${JSON.stringify(serious, null, 1)}`)
          .then(w2 => review().then(r2 => ({ ...d, dossier: w2 || w, firstReview: r1, review: r2 || r1, revised: true })))
      })
    })
  },
)

const done = results.filter(Boolean)
const missingIps = ips.filter(ip => !done.some(x => x.ip.slug === ip.slug)).map(ip => ip.slug)
log(`IP ${ips.length}개 중 ${done.length}개 판정 완료${missingIps.length ? `, 중단: ${missingIps.join(', ')}` : ''}`)

return {
  round, today, depth: thorough ? 'thorough' : 'standard', missingIps,
  results: done.map(x => ({
    ip: x.ip.slug, title: x.ip.title, round, date: today, mode: 'live',
    grade: x.verdict.grade, partial: !!x.verdict.partial || x.missing.length > 0,
    one_liner: x.verdict.one_liner, formats: x.verdict.formats,
    flip_conditions: x.verdict.flip_conditions || [],
    claims: x.verdict.final_counts, overrides: x.verdict.overrides,
    proposed_counts: {
      pass: x.claims.filter(c => c.proposed === '통과').length,
      conditional: x.claims.filter(c => c.proposed === '조건부').length,
      rejected: x.claims.filter(c => c.proposed === '기각').length,
    },
    missing_analyses: x.missing, internal_used: !!x.internal,
    verifier_failures: x.verifierFailures, verifier_jobs: x.verifierJobs,
    paths: { dir: x.dir, verdict: x.verdict.path, dossier: x.dossier ? x.dossier.path : null },
    review: x.review, first_review: x.firstReview || null, revised: !!x.revised,
    claims_detail: x.claims,
  })),
}
