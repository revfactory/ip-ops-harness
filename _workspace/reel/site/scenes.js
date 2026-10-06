/* IP 사업 운영 하네스 — 30초 쇼릴
 * 128BPM, 1박 0.46875초, 1마디 1.875초, 16마디 = 30초.
 * 콘셉트: IP 하나(빛 점)가 하네스를 통과하는 한 번의 카메라 이동. 아홉 정거장은 큰 타원 고리 둘레에 있고,
 * 카메라가 빠지면 지나온 길이 고리였음이 드러난다. 고리 가운데에는 판정 원장이 있다.
 * 모든 화면은 t의 순수 함수다(엔진 규약).
 */
const { ease, prog, kf, clamp, lerp, rand, css, h, s } = REEL;
REEL.config({ duration: 30, fps: 60 });

const W = 1920, H = 1080, CX = 960, CY = 540, PI = Math.PI;
const B = 60 / 128, BAR = B * 4;
const at = (bar, beat = 0) => bar * BAR + beat * B;
const COL = { bg: '#07080B', ink: '#F3F0E8', dim: '#5D6172', dim2: '#2A2E3A', ai: '#36E2FF', human: '#FFC933', alert: '#FF4B3A', paper: '#F1EEE6', dark: '#0B0C10' };
const rad = d => (d * PI) / 180;


/* ---------- 흔들림·플래시(임팩트 목록 하나로 관리) ---------- */
const IMPACTS = [
  [at(1), 16], [at(2), 9], [at(3), 7], [at(5, 2), 7], [at(6, 1), 13], [at(7, 1), 18],
  [at(11, 1), 7], [at(12), 14], [at(14), 12], [at(14, 1), 5], [at(14, 2), 5],
];
function shake(t) {
  let x = 0, y = 0;
  for (const [ti, a] of IMPACTS) {
    const d = t - ti;
    if (d < 0 || d > 0.6) continue;
    const env = a * Math.exp(-d * 11);
    x += env * Math.sin(d * 83 + ti * 7);
    y += env * Math.cos(d * 71 + ti * 3);
  }
  return [x, y];
}

/* ---------- 글자 단위 분해(색 구간 지원) ---------- */
// segs: [['결정은 ', null], ['사람', 'human'], ['이.', null]]
function chars(parent, segs) {
  const seg = new Intl.Segmenter('ko', { granularity: 'grapheme' });
  const out = [];
  for (const [text, cls] of segs) {
    for (const { segment } of seg.segment(text)) {
      const sp = h('span', 'ch' + (cls ? ' ' + cls : ''), parent);
      sp.textContent = segment === ' ' ? ' ' : segment;
      sp.style.display = 'inline-block';
      out.push(sp);
    }
  }
  return out;
}
const segsOf = x => (typeof x === 'string' ? [[x, null]] : x);

/* ---------- 고리와 정거장 ---------- */
const RX = 3000, RY = 1700;
const ell = d => [RX * Math.cos(rad(d)), RY * Math.sin(rad(d))];
const normal = d => {
  const a = rad(d), nx = Math.cos(a) / RX, ny = Math.sin(a) / RY, l = Math.hypot(nx, ny);
  return [nx / l, ny / l];
};
const BW = 1400, BH = 760, ZH = 0.97;
const STATIONS = [
  { key: 'signal', deg: 190, bar: 3, step: '01', stage: '발굴', cap: '신호를 모으고', agents: ['ent-researcher', 'internal-data-analyst'] },
  { key: 'split', deg: 226, bar: 4, step: '02', stage: '확장 기획', cap: '세 관점으로 나눠 보고', agents: ['format-expansion-planner', 'global-fit-analyst', 'rights-revenue-analyst'] },
  { key: 'verify', deg: 262, bar: 5, step: '03', stage: '근거 검증', cap: '근거를 하나씩 깎고', agents: ['evidence-verifier'] },
  { key: 'verdict', deg: 298, bar: 6, step: '04', stage: '투자 판단', cap: [['AI는 ', null], ['초안', 'ai'], ['까지.', null]], agents: ['ip-investment-judge', 'verdict-writer', 'dossier-reviewer'] },
  { key: 'human', deg: 334, bar: 7, step: '05', stage: '판정 회의', cap: [['결정은 ', null], ['사람', 'human'], ['이.', null]], agents: [] },
  { key: 'make', deg: 370, bar: 8, step: '06', stage: '제작', cap: [['승인된', 'human'], [' 것만 만들고', null]], agents: ['story-bible-keeper', 'adaptation-designer'] },
  { key: 'canon', deg: 406, bar: 9, step: '07', stage: '검증', cap: [['원작과 ', null], ['어긋난', 'alert'], [' 곳을 잡고', null]], agents: ['canon-consistency-checker'] },
  { key: 'launch', deg: 442, bar: 10, step: '08', stage: '유통', cap: '갈 곳과 때를 정하고', agents: ['launch-planner'] },
  { key: 'perf', deg: 478, bar: 11, step: '09', stage: '성과 분석', cap: '결과를 가리고 맞춰 본다.', agents: ['backtest-curator', 'blind-panelist', 'performance-analyst'] },
];
for (const st of STATIONS) {
  st.p = ell(st.deg);
  st.n = normal(st.deg);
  st.off = (BW / 2) * Math.abs(st.n[0]) + (BH / 2) * Math.abs(st.n[1]) + 70;
  st.c = [st.p[0] + st.n[0] * st.off, st.p[1] + st.n[1] * st.off];
  // 블록이 화면 안전 영역에 들어오도록 블록 중심의 화면 오프셋 k를 정한다
  const hw = (BW * 0.985) / 2, hh = (BH * 0.985) / 2;
  const kx = (CX - 96 - hw) / Math.max(1e-3, Math.abs(st.n[0]));
  const ky = (CY - 104 - hh) / Math.max(1e-3, Math.abs(st.n[1]));
  const k = Math.min(kx, ky);
  st.focus = [st.c[0] - (st.n[0] * k) / 0.96, st.c[1] - (st.n[1] * k) / 0.96];
  st.T = at(st.bar);
}
// 전경: 고리와 블록 전체가 들어오는 카메라
const OV = (() => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const st of STATIONS) {
    x0 = Math.min(x0, st.c[0] - BW / 2); x1 = Math.max(x1, st.c[0] + BW / 2);
    y0 = Math.min(y0, st.c[1] - BH / 2); y1 = Math.max(y1, st.c[1] + BH / 2);
  }
  x0 = Math.min(x0, -RX); x1 = Math.max(x1, RX);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: Math.min(W / (x1 - x0 + 420), H / (y1 - y0 + 520)) };
})();

/* ---------- 카메라 ---------- */
const mixCam = (a, b, p) => ({
  x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p),
  z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), p)), r: lerp(a.r || 0, b.r || 0, p),
});
function holdCam(st, lt) {
  const p = clamp(lt / BAR);
  return { x: st.focus[0], y: st.focus[1], z: ZH * (1 + 0.045 * ease.inOutSine(p)), r: 0 };
}
const MOVE_A = 0.3, MOVE_B = 0.16;
function cam(t) {
  const S = STATIONS;
  if (t < S[0].T + 0.6) {
    const a = { x: S[0].p[0], y: S[0].p[1], z: 3.2, r: 0 };
    return mixCam(a, holdCam(S[0], t - S[0].T), ease.outExpo(clamp((t - 5.5) / 0.7)));
  }
  for (let i = 0; i < S.length - 1; i++) {
    const m0 = S[i + 1].T - MOVE_A, m1 = S[i + 1].T + MOVE_B;
    if (t < m0) return holdCam(S[i], t - S[i].T);
    if (t < m1) {
      const p = ease.inOutQuart(clamp((t - m0) / (m1 - m0)));
      const c = mixCam(holdCam(S[i], t - S[i].T), holdCam(S[i + 1], t - S[i + 1].T), p);
      c.z *= 1 - 0.26 * Math.sin(PI * p);
      c.r = 2.4 * Math.sin(PI * p) * (i % 2 ? -1 : 1);
      return c;
    }
  }
  const last = S[S.length - 1];
  const pre = holdCam(last, t - last.T);
  if (t < at(12)) { pre.z *= 1 + 0.07 * ease.inQuad(clamp((t - (at(12) - 0.4)) / 0.4)); return pre; }
  const a = holdCam(last, at(12) - last.T); a.z *= 1.07;
  if (t < 25.9) {
    const p = ease.outExpo(clamp((t - at(12)) / 1.15));
    const c = mixCam(a, { x: OV.x, y: OV.y, z: OV.z, r: 0 }, p);
    const d = clamp((t - 23.3) / 2.6);
    c.r = lerp(-9, 0, ease.outCubic(clamp((t - at(12)) / 1.4))) + 2.2 * d;
    c.z *= 1 + 0.03 * d;
    return c;
  }
  const p = ease.inExpo(clamp((t - 25.9) / 0.38));
  return { x: OV.x, y: OV.y, z: OV.z * 1.03 * (1 - 0.992 * p), r: 2.2 + 80 * p };
}
function project(wx, wy, c) {
  const dx = (wx - c.x) * c.z, dy = (wy - c.y) * c.z;
  const a = rad(c.r), co = Math.cos(a), si = Math.sin(a);
  return [CX + dx * co - dy * si, CY + dx * si + dy * co];
}
function tokenDeg(t) {
  const S = STATIONS;
  if (t < S[0].T) return S[0].deg;
  for (let i = 0; i < S.length - 1; i++) {
    const m0 = S[i + 1].T - MOVE_A, m1 = S[i + 1].T + MOVE_B;
    if (t < m0) return S[i].deg;
    if (t < m1) return lerp(S[i].deg, S[i + 1].deg, ease.inOutQuart(clamp((t - m0) / (m1 - m0))));
  }
  return lerp(S[8].deg, S[0].deg + 360, ease.inOutCubic(clamp((t - (at(12) + 0.1)) / 1.25)));
}
const stationAt = t => {
  let k = -1;
  STATIONS.forEach((st, i) => { if (t >= st.T - 0.15) k = i; });
  return k;
};

/* ---------- 토큰(빛 점) DOM ---------- */
function makeToken(parent) {
  const root = h('div', 'abs', parent);
  css(root, { left: '0px', top: '0px', width: '0px', height: '0px' });
  const halo = h('div', 'abs', root);
  css(halo, { left: '-60px', top: '-60px', width: '120px', height: '120px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(54,226,255,0.55) 0%, rgba(54,226,255,0.12) 38%, rgba(54,226,255,0) 70%)' });
  const ring = h('div', 'abs', root);
  css(ring, { left: '-23px', top: '-23px', width: '46px', height: '46px', borderRadius: '50%', border: '2px solid rgba(54,226,255,0.55)', boxSizing: 'border-box' });
  const hring = h('div', 'abs', root);
  css(hring, { left: '-33px', top: '-33px', width: '66px', height: '66px', borderRadius: '50%', border: '3px solid #FFC933', boxSizing: 'border-box', opacity: 0 });
  const core = h('div', 'abs', root);
  css(core, { left: '-11px', top: '-11px', width: '22px', height: '22px', borderRadius: '50%', background: '#E9FCFF',
    boxShadow: '0 0 18px 4px rgba(54,226,255,0.9), 0 0 2px 1px #fff' });
  return {
    root,
    set(x, y, t, { scale = 1, human = 0, alpha = 1, vx = 0, vy = 0 } = {}) {
      const pulse = 1 + 0.06 * Math.sin(t * PI * 2 / B);
      const v = Math.hypot(vx, vy), ang = Math.atan2(vy, vx) * 180 / PI, st = 1 + Math.min(2.6, v / 26);
      css(root, { transform: `translate(${x}px, ${y}px) rotate(${ang}deg) scale(${scale * st}, ${scale / Math.sqrt(st)})`, opacity: alpha });
      css(halo, { transform: `scale(${pulse})` });
      css(ring, { transform: `scale(${1 + 0.15 * Math.sin(t * PI * 2 / (B * 2))})` });
      css(hring, { opacity: human, transform: `scale(${0.6 + 0.4 * human})` });
    },
  };
}

/* ======================================================================
 * 1~2마디: 콜드 오픈 — 점 1만6천 개 → 하나
 * ==================================================================== */
REEL.scene({
  id: 'hook', start: 0, end: at(2) + 0.25,
  setup(el) {
    this.cv = h('canvas', 'full', el);
    this.cv.width = W; this.cv.height = H;
    this.g = this.cv.getContext('2d');
    const cols = 160, rows = 100, sx = W / cols, sy = H / rows;
    this.dots = [];
    this.chosen = 98 * rows + 44;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const i = c * rows + r;
      const x = (c + 0.5) * sx, y = (r + 0.5) * sy;
      const d = Math.hypot(x - CX, y - CY) / 1100;
      this.dots.push({ x, y, t0: 0.08 + 1.32 * Math.pow(d, 0.92) + rand(i, 3) * 0.12,
        a: 0.22 + 0.55 * rand(i, 5), cyan: rand(i, 9) < 0.05 });
    }
    const ch = this.dots[this.chosen];
    for (const d of this.dots) d.dimT = at(1) + Math.hypot(d.x - ch.x, d.y - ch.y) / 2600;
    this.sorted = this.dots.map(d => d.t0).sort((a, b) => a - b);
    // 카운터
    this.cnt = h('div', 'abs', el);
    css(this.cnt, { left: '110px', top: '812px' });
    this.cntK = h('div', 'mono', this.cnt, 'ORIGINAL STORY IP');
    css(this.cntK, { fontSize: '20px', color: COL.ai, letterSpacing: '0.14em' });
    this.cntN = h('div', 'disp', this.cnt, '0');
    css(this.cntN, { fontSize: '120px', marginTop: '6px', fontVariantNumeric: 'tabular-nums' });
    this.cntL = h('div', 'body', this.cnt, '카카오엔터 오리지널 스토리 IP 약 1만6천 개 · 2026.09 발표');
    css(this.cntL, { fontSize: '26px', color: COL.dim, marginTop: '4px' });
    // 질문
    this.q = h('div', 'abs disp', el);
    css(this.q, { left: '0px', right: '0px', top: '196px', textAlign: 'center', fontSize: '196px' });
    this.qLayers = ['ai', 'alert', null].map(cls => {
      const lay = h('div', 'abs', this.q);
      css(lay, { left: '0', right: '0', top: '0', mixBlendMode: cls ? 'screen' : 'normal' });
      const cs = chars(lay, [['무엇에 걸 것인가', cls], ['?', cls || 'human']]);
      if (cls) cs.forEach(c => (c.style.color = cls === 'ai' ? COL.ai : COL.alert));
      return { lay, cs };
    });
    this.q.style.height = '210px';
  },
  render(lt) {
    const t = lt, g = this.g;
    g.clearRect(0, 0, W, H);
    const ch = this.dots[this.chosen];
    // 카메라: 1.2초부터 고른 점으로 밀려 들어간다
    const k = t < 1.2 ? 1 : t < at(1) ? lerp(1, 1.28, ease.inQuad((t - 1.2) / (at(1) - 1.2))) : lerp(1.28, 2.7, ease.outCubic(clamp((t - at(1)) / 1.9)));
    const fp = ease.inOutCubic(clamp((t - 1.2) / 1.5));
    const fx = lerp(CX, ch.x, fp), fy = lerp(CY, ch.y, fp);
    const [shx, shy] = shake(t);
    const fadeAll = 1 - clamp((t - (at(2) - 0.12)) / 0.25);
    for (let i = 0; i < this.dots.length; i++) {
      if (i === this.chosen) continue;
      const d = this.dots[i];
      let a = d.a * clamp((t - d.t0) / 0.12);
      if (a <= 0) continue;
      if (t > d.dimT) a *= lerp(1, 0.09, clamp((t - d.dimT) / 0.18));
      a *= fadeAll;
      if (a < 0.01) continue;
      const x = CX + (d.x - fx) * k + shx, y = CY + (d.y - fy) * k + shy;
      if (x < -6 || x > W + 6 || y < -6 || y > H + 6) continue;
      const sz = 2.4 * Math.sqrt(k);
      g.fillStyle = d.cyan ? `rgba(54,226,255,${a})` : `rgba(206,208,218,${a})`;
      g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }
    // 고른 점과 충격파
    const cxp = CX + (ch.x - fx) * k + shx, cyp = CY + (ch.y - fy) * k + shy;
    const flare = t < at(1) ? clamp((t - ch.t0) / 0.12) * 0.8 : 1;
    if (flare > 0) {
      const big = t < at(1) ? 2.6 : lerp(2.6, 11, ease.outExpo(clamp((t - at(1)) / 0.35)));
      const gr = g.createRadialGradient(cxp, cyp, 0, cxp, cyp, big * 6);
      gr.addColorStop(0, `rgba(233,252,255,${flare})`);
      gr.addColorStop(0.18, `rgba(54,226,255,${0.7 * flare})`);
      gr.addColorStop(1, 'rgba(54,226,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(cxp, cyp, big * 6, 0, PI * 2); g.fill();
    }
    for (const [delay, col, w] of [[0, '243,240,232', 3], [0.07, '54,226,255', 2]]) {
      const p = clamp((t - at(1) - delay) / 0.8);
      if (p <= 0 || p >= 1) continue;
      g.strokeStyle = `rgba(${col},${0.7 * (1 - p)})`;
      g.lineWidth = w;
      g.beginPath(); g.arc(cxp, cyp, ease.outCubic(p) * 1100, 0, PI * 2); g.stroke();
    }
    // 카운터: 실제로 켜진 점의 수를 센다
    let lo = 0, hi = this.sorted.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (this.sorted[m] <= t) lo = m + 1; else hi = m; }
    const n = lo >= this.sorted.length ? 16000 : lo;
    this.cntN.textContent = n.toLocaleString('ko-KR');
    const cIn = ease.outExpo(clamp((t - 0.1) / 0.5));
    const cOut = ease.inCubic(clamp((t - at(1) - 0.25) / 0.45));
    css(this.cnt, { opacity: cIn * (1 - cOut), transform: `translate(${shx}px, ${(1 - cIn) * 40 + cOut * 60 + shy}px)` });
    // 질문: 글자마다 크게 내리꽂히고 색 분리가 빠르게 사라진다
    const q0 = at(1) + 0.12;
    this.qLayers.forEach((L, li) => {
      const off = li === 0 ? -1 : li === 1 ? 1 : 0;
      L.cs.forEach((c, i) => {
        const p = prog(t, q0 + i * 0.035, 0.42, ease.outExpo);
        const ex = prog(t, at(2) - 0.42 + i * 0.012, 0.3, ease.inCubic);
        const split = (1 - prog(t, q0 + i * 0.035, 0.5, ease.outCubic)) * 26 * off;
        const sc = lerp(2.3, 1, p);
        css(c, {
          transform: `translate(${split}px, ${(1 - p) * -50 - ex * 160}px) scale(${sc})`,
          opacity: (li === 2 ? p : p * (1 - p) * 2.2) * (1 - ex),
        });
      });
    });
    css(this.q, { transform: `translate(${shx}px, ${shy}px) scale(${1 + 0.045 * ease.inOutSine(clamp((t - 2.3) / 1.1))})` });
  },
});

/* ======================================================================
 * 3마디: 타이틀 — 점을 지나는 선, 정거장 아홉 개
 * ==================================================================== */
REEL.scene({
  id: 'title', start: at(2) - 0.16, end: 5.75,
  setup(el) {
    this.root = h('div', 'full', el);
    this.line = h('div', 'abs', this.root);
    css(this.line, { left: '110px', top: '539px', width: '1700px', height: '2px', background: 'linear-gradient(90deg, rgba(243,240,232,0), rgba(243,240,232,0.55) 18%, rgba(243,240,232,0.55) 82%, rgba(243,240,232,0))', transformOrigin: '850px 1px' });
    this.ticks = [];
    for (let i = 0; i < 9; i++) {
      const x = CX + (i - 4) * 190;
      const tk = h('div', 'abs', this.root);
      css(tk, { left: x - 6 + 'px', top: '534px', width: '12px', height: '12px', borderRadius: '50%', border: '2px solid ' + COL.ai, boxSizing: 'border-box' });
      const lb = h('div', 'abs mono', this.root, String(i + 1).padStart(2, '0'));
      css(lb, { left: x - 20 + 'px', top: '560px', width: '40px', textAlign: 'center', fontSize: '16px', color: COL.dim });
      this.ticks.push([tk, lb]);
    }
    this.title = h('div', 'abs disp', this.root);
    css(this.title, { left: '0', right: '0', top: '300px', textAlign: 'center', fontSize: '156px' });
    this.tLayers = ['ai', 'alert', null].map(cls => {
      const lay = h('div', cls ? 'abs' : '', this.title);
      if (cls) css(lay, { left: '0', right: '0', top: '0', mixBlendMode: 'screen', color: cls === 'ai' ? COL.ai : COL.alert });
      const line = h('span', '', lay);
      css(line, { display: 'inline-block', overflow: 'hidden', padding: '0 0.05em 0.06em' });
      return { lay, cs: chars(line, [['IP 사업 운영 하네스', null]]) };
    });
    this.sub = h('div', 'abs mono', this.root);
    css(this.sub, { left: '0', right: '0', top: '612px', textAlign: 'center', fontSize: '28px', letterSpacing: '0.16em', color: COL.ink });
    this.subText = '7 STAGES · 16 AGENTS · 1 LEDGER';
    this.token = makeToken(this.root);
  },
  render(lt, ctx) {
    const t = ctx.t;
    const [shx, shy] = shake(t);
    const T0 = at(2);
    const dive = ease.inQuad(clamp((t - 5.18) / 0.5));
    const sc = 1 + dive * 7;
    css(this.root, { transform: `translate(${shx}px, ${shy}px) translate(${CX}px, ${CY}px) scale(${sc}) translate(${-CX}px, ${-CY}px)`, opacity: 1 - clamp((t - 5.42) / 0.2) });
    css(this.line, { transform: `scaleX(${ease.outExpo(clamp((t - T0) / 0.55))})` });
    this.ticks.forEach(([tk, lb], i) => {
      const p = prog(t, T0 + 0.18 + i * 0.1, 0.35, ease.outBack);
      css(tk, { transform: `scale(${p})`, background: t > T0 + 0.18 + i * 0.1 + 0.15 ? 'rgba(54,226,255,0.25)' : 'transparent' });
      css(lb, { opacity: p });
    });
    this.tLayers.forEach((L, li) => {
      const off = li === 0 ? -1 : li === 1 ? 1 : 0;
      L.cs.forEach((c, i) => {
        const p = prog(t, T0 + 0.02 + i * 0.028, 0.6, ease.outExpo);
        const split = (1 - prog(t, T0 + i * 0.028, 0.45, ease.outCubic)) * 22 * off;
        css(c, { transform: `translate(${split}px, ${(1 - p) * 105}%)`, opacity: li === 2 ? 1 : (1 - p) * 0.9 });
      });
    });
    const n = Math.floor(clamp((t - (T0 + 0.3)) / 0.7) * this.subText.length);
    const cursor = t > T0 + 0.25 && Math.floor(t / (B / 2)) % 2 === 0 ? '▌' : ' ';
    this.sub.textContent = this.subText.slice(0, n) + cursor;
    this.token.set(CX, CY, t, { scale: 1 + 0.3 * prog(t, T0, 0.3, ease.outBack) * (1 - prog(t, T0 + 0.3, 0.4)) });
  },
});

/* ======================================================================
 * 4~14마디: 월드 — 카메라 한 번으로 아홉 정거장을 지나 고리를 드러낸다
 * ==================================================================== */
const builders = {};

/* 블록 공통: 키커 + 캡션 */
function blockBase(el, st) {
  const kick = h('div', 'kicker', el, `STEP ${st.step} — <b>${st.stage}</b>`);
  const cap = h('div', 'cap', el);
  const line = h('span', 'line', cap);
  const cs = chars(line, segsOf(st.cap));
  return (lt, done) => {
    const kp = prog(lt, -0.25, 0.4, ease.outCubic);
    css(kick, { opacity: 0.35 + 0.65 * kp, transform: `translateX(${(1 - kp) * -30}px)` });
    cs.forEach((c, i) => {
      const p = prog(lt, 0.0 + i * 0.024, 0.55, ease.outExpo);
      css(c, { transform: `translateY(${(1 - p) * 112}%)` });
    });
    css(cap, { opacity: done ? 0.62 : 1 });
  };
}

builders.signal = (el, st) => {
  const base = blockBase(el, st);
  const names = ['규모', '성장', '몰입', '팬덤', '캐릭터', '해외', '확장', '유사작'];
  const internal = [true, false, true, false, false, true, false, false];
  const vals = [0.95, 0.8, 0.66, 0.74, 0.57, 0.16, 0.62, 0.47];
  const cols = names.map((nm, i) => {
    const x = i * 178, top = 268, hgt = 330;
    const track = h('div', 'abs', el);
    css(track, { left: x + 'px', top: top + 'px', width: '128px', height: hgt + 'px', background: '#0E1016', borderRadius: '10px', border: '2px solid ' + COL.dim2, boxSizing: 'border-box', overflow: 'hidden' });
    const fill = h('div', 'abs', track);
    css(fill, { left: '0', right: '0', bottom: '0', height: '100%', transformOrigin: '50% 100%', background: i === 5 ? 'linear-gradient(180deg, #FF4B3A, rgba(255,75,58,0.25))' : 'linear-gradient(180deg, #36E2FF, rgba(54,226,255,0.18))' });
    const id = h('div', 'abs mono', el, 'S' + (i + 1));
    css(id, { left: x + 'px', width: '128px', textAlign: 'center', top: top - 34 + 'px', fontSize: '20px', color: COL.dim });
    const lb = h('div', 'abs body', el, nm);
    css(lb, { left: x - 20 + 'px', width: '168px', textAlign: 'center', top: top + hgt + 14 + 'px', fontSize: '30px' });
    const tg = h('div', 'abs mono', el, internal[i] ? '+ 내부 지표' : '');
    css(tg, { left: x - 20 + 'px', width: '168px', textAlign: 'center', top: top + hgt + 56 + 'px', fontSize: '17px', color: COL.ai });
    return { fill, id, lb, tg, v: vals[i] };
  });
  const sweep = h('div', 'abs', el);
  css(sweep, { left: '0', top: '262px', width: '160px', height: '342px', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.22), rgba(255,255,255,0))', mixBlendMode: 'screen' });
  return (lt, done) => {
    base(lt, done);
    cols.forEach((c, i) => {
      const p = prog(lt, 0.06 + i * 0.075, 0.7, ease.outExpo);
      css(c.fill, { transform: `scaleY(${p * c.v})` });
      const a = prog(lt, i * 0.075, 0.3);
      css(c.lb, { opacity: a, transform: `translateY(${(1 - a) * 20}px)` });
      css(c.tg, { opacity: prog(lt, 0.5 + i * 0.05, 0.3) });
      css(c.id, { opacity: a });
    });
    const sp = clamp((lt - 0.95) / 0.55);
    css(sweep, { opacity: sp > 0 && sp < 1 ? 1 : 0, transform: `translateX(${lerp(-200, 1450, ease.inOutCubic(sp))}px)` });
  };
};

builders.split = (el, st) => {
  const base = blockBase(el, st);
  const svg = s('svg', { width: 1400, height: 760, style: 'position:absolute;left:0;top:0;overflow:visible' }, el);
  const lanes = [
    { y: 300, title: '포맷', chips: ['웹툰', '드라마', '애니', '공연', 'OST', '게임', '굿즈'], mono: false, agent: 'format-expansion-planner' },
    { y: 470, title: '글로벌', chips: ['KR', 'JP', 'US', 'SEA', 'EU'], mono: true, agent: 'global-fit-analyst' },
    { y: 640, title: '권리', chips: ['영상화권', '공연권', '상품화권', '해외 출판권'], q: true, agent: 'rights-revenue-analyst' },
  ];
  const paths = lanes.map(L => {
    const p = s('path', { d: `M -40 470 C 60 470, 40 ${L.y}, 150 ${L.y}`, fill: 'none', stroke: COL.ai, 'stroke-width': 4, 'stroke-linecap': 'round' }, svg);
    const len = p.getTotalLength ? 300 : 300;
    p.setAttribute('stroke-dasharray', len); p.setAttribute('stroke-dashoffset', len);
    return { p, len };
  });
  const node = s('circle', { cx: -40, cy: 470, r: 10, fill: COL.ai }, svg);
  const rows = lanes.map(L => {
    const tt = h('div', 'abs disp', el, L.title);
    css(tt, { left: '170px', top: L.y - 34 + 'px', fontSize: '52px', fontWeight: '800' });
    const ag = h('div', 'abs mono', el, L.agent);
    css(ag, { left: '172px', top: L.y + 30 + 'px', fontSize: '17px', color: COL.dim });
    const box = h('div', 'abs', el);
    css(box, { left: '440px', top: L.y - 29 + 'px', display: 'flex', gap: '14px' });
    const cs = L.chips.map(txt => {
      const c = h('div', 'chip', box);
      css(c, { position: 'relative', fontFamily: L.mono ? 'Meslo' : 'Pretendard', fontWeight: L.mono ? '700' : '600', letterSpacing: L.mono ? '0.06em' : '-0.02em' });
      c.innerHTML = L.q ? `${txt} <span style="color:${COL.alert}">?</span>` : txt;
      return c;
    });
    return { tt, ag, cs };
  });
  return (lt, done) => {
    base(lt, done);
    node.setAttribute('r', 10 * prog(lt, -0.1, 0.25, ease.outBack));
    paths.forEach(({ p, len }, i) => p.setAttribute('stroke-dashoffset', len * (1 - prog(lt, 0.02 + i * 0.05, 0.4, ease.outCubic))));
    rows.forEach((r, li) => {
      const a = prog(lt, 0.18 + li * 0.08, 0.4, ease.outExpo);
      css(r.tt, { opacity: a, transform: `translateX(${(1 - a) * -40}px)` });
      css(r.ag, { opacity: a * 0.9 });
      r.cs.forEach((c, i) => {
        const p = prog(lt, 0.3 + li * 0.1 + i * 0.055, 0.42, ease.outBack);
        css(c, { opacity: clamp(p * 1.5), transform: `scale(${lerp(0.4, 1, p)})`, borderColor: p > 0.95 ? (li === 2 ? 'rgba(255,75,58,0.5)' : 'rgba(54,226,255,0.55)') : COL.dim2 });
      });
    });
  };
};

builders.verify = (el, st) => {
  const base = blockBase(el, st);
  // 36개 상태: 통과 14 · 조건부 18 · 기각 4(시연 판정문). 순서는 시드 고정으로 섞는다.
  const pool = [...Array(14).fill('pass'), ...Array(18).fill('cond'), ...Array(4).fill('rej')];
  const order = pool.map((v, i) => ({ v, k: rand(i, 41) })).sort((a, b) => a.k - b.k).map(o => o.v);
  const STAMP = 3 * 6 + 2;
  const swap = order.findIndex((v, i) => v === 'rej' && i !== STAMP);
  if (order[STAMP] !== 'rej') { order[swap] = order[STAMP]; order[STAMP] = 'rej'; }
  const pills = [];
  for (let c = 0; c < 6; c++) for (let r = 0; r < 6; r++) {
    const i = c * 6 + r;
    const p = h('div', 'pill', el, 'C-' + String(i + 1).padStart(2, '0'));
    css(p, { left: c * 210 + 'px', top: 252 + r * 74 + 'px' });
    pills.push({ el: p, v: order[i], t0: 0.2 + c * 0.19 + r * 0.026 });
  }
  const scan = h('div', 'abs', el);
  css(scan, { left: '0', top: '238px', width: '6px', height: '462px', background: COL.ai, boxShadow: '0 0 24px 6px rgba(54,226,255,0.6)' });
  const counters = h('div', 'abs mono', el);
  css(counters, { left: '1290px', top: '258px', fontSize: '27px', lineHeight: '50px', textAlign: 'left' });
  const cP = h('div', '', counters), cC = h('div', '', counters), cR = h('div', '', counters);
  const src = h('div', 'mono', counters, '시연 기준');
  css(src, { fontSize: '16px', color: COL.dim, marginTop: '10px' });
  const stamp = h('div', 'abs grade', el, '기각');
  const sp = pills[STAMP];
  css(stamp, { left: parseFloat(sp.el.style.left) - 30 + 'px', top: parseFloat(sp.el.style.top) - 34 + 'px', fontSize: '64px', color: COL.alert, border: '6px solid ' + COL.alert, borderRadius: '14px', padding: '0 22px', lineHeight: '104px', background: 'rgba(7,8,11,0.86)' });
  return (lt, done) => {
    base(lt, done);
    let nP = 0, nC = 0, nR = 0;
    for (const p of pills) {
      const on = lt >= p.t0;
      const a = prog(lt, p.t0, 0.16, ease.outCubic);
      if (on) { if (p.v === 'pass') nP++; else if (p.v === 'cond') nC++; else nR++; }
      const st2 = !on ? { background: 'transparent', borderColor: COL.dim2, color: COL.dim, borderStyle: 'solid' }
        : p.v === 'pass' ? { background: COL.ai, borderColor: COL.ai, color: COL.bg, borderStyle: 'solid' }
          : p.v === 'cond' ? { background: 'rgba(54,226,255,0.06)', borderColor: 'rgba(54,226,255,0.8)', color: COL.ai, borderStyle: 'dashed' }
            : { background: COL.alert, borderColor: COL.alert, color: COL.ink, borderStyle: 'solid' };
      css(p.el, { ...st2, transform: `scale(${on ? 1 + 0.12 * (1 - a) : 0.96})` });
    }
    cP.innerHTML = `<span style="color:${COL.ai}">통과</span> ${String(nP).padStart(2, ' ')}`;
    cC.innerHTML = `<span style="color:${COL.ink}">조건부</span> ${String(nC).padStart(2, ' ')}`;
    cR.innerHTML = `<span style="color:${COL.alert}">기각</span> ${String(nR).padStart(2, ' ')}`;
    css(counters, { opacity: prog(lt, 0.1, 0.3) });
    const sc = clamp((lt - 0.2) / 1.2);
    css(scan, { opacity: sc > 0 && sc < 1 ? 1 : 0, transform: `translateX(${lerp(-20, 1250, sc)}px)` });
    const s1 = prog(lt, B * 2, 0.24, ease.outExpo);
    css(stamp, { opacity: lt >= B * 2 ? 1 : 0, transform: `rotate(-9deg) scale(${lerp(2.6, 1, s1)})` });
  };
};

builders.verdict = (el, st) => {
  const base = blockBase(el, st);
  const card = h('div', 'card', el);
  css(card, { left: '0', top: '250px', width: '520px', height: '480px', background: 'linear-gradient(160deg, #11202A, #0B0E14)', borderColor: 'rgba(54,226,255,0.6)' });
  const lab = h('div', 'abs mono', card, '등급 초안 · DRAFT');
  css(lab, { left: '34px', top: '30px', fontSize: '22px', color: COL.ai, letterSpacing: '0.1em' });
  const big = h('div', 'abs grade', card, 'B');
  css(big, { left: '26px', top: '40px', fontSize: '330px', lineHeight: '1', color: COL.ink });
  const word = h('div', 'abs disp', card, '조건부');
  css(word, { left: '296px', top: '262px', fontSize: '66px', color: COL.ai });
  const foot = h('div', 'abs mono', card, '시연 판정 · ip-investment-judge');
  css(foot, { left: '34px', top: '420px', fontSize: '17px', color: COL.dim });
  const list = [['공연', 'B', '조건부'], ['일본 웹툰', 'B', '조건부'], ['영어판', 'B', '조건부'], ['애니', 'C', '관찰'], ['실사 드라마', 'C', '관찰'], ['OST', 'C', '관찰'], ['게임', 'C', '관찰'], ['뮤지컬', 'D', '보류']];
  const rows = list.map(([nm, g, w], i) => {
    const r = h('div', 'abs', el);
    css(r, { left: '600px', top: 254 + i * 59 + 'px', width: '800px', height: '58px', borderBottom: '2px solid ' + COL.dim2, boxSizing: 'border-box' });
    const n = h('div', 'abs body', r, nm);
    css(n, { left: '4px', top: '8px', fontSize: '31px' });
    const c = g === 'B' ? COL.ai : g === 'D' ? COL.alert : '#B9BBC6';
    const gg = h('div', 'abs', r, `<span class="grade" style="font-size:38px">${g}</span><span class="body" style="font-size:24px;margin-left:12px">${w}</span>`);
    css(gg, { right: '6px', top: '2px', color: c });
    return r;
  });
  return (lt, done) => {
    base(lt, done);
    const p = prog(lt, B, 0.3, ease.outExpo);
    css(card, { opacity: lt >= B ? 1 : 0, transform: `scale(${lerp(1.5, 1, p)}) rotate(${lerp(-6, 0, p)}deg)`, boxShadow: `0 0 ${80 * (1 - p)}px rgba(54,226,255,${0.6 * (1 - p)})` });
    rows.forEach((r, i) => {
      const a = prog(lt, B * 1.6 + i * 0.055, 0.4, ease.outExpo);
      css(r, { opacity: a, transform: `translateX(${(1 - a) * 60}px)` });
    });
  };
};

builders.human = (el, st) => {
  const kick = h('div', 'kicker', el, `STEP ${st.step} — <b>${st.stage}</b>`);
  kick.style.color = COL.human;
  const cap = h('div', 'cap', el);
  const layers = ['ai', 'alert', null].map(cls => {
    const lay = h('div', cls ? 'abs' : '', cap);
    if (cls) css(lay, { left: '0', top: '0', mixBlendMode: 'screen', color: cls === 'ai' ? COL.ai : COL.alert });
    const cs = chars(lay, cls ? [['결정은 사람이.', null]] : segsOf(st.cap));
    return { lay, cs };
  });
  const wait = h('div', 'abs mono', el, '● AWAITING HUMAN DECISION');
  css(wait, { left: '0', top: '96px', fontSize: '46px', color: COL.human, letterSpacing: '0.1em' });
  const tbl = h('div', 'abs', el);
  css(tbl, { left: '0', top: '262px', width: '1400px' });
  const head = h('div', 'mono', tbl, '판정 원장 · LEDGER');
  css(head, { fontSize: '22px', color: COL.ai, letterSpacing: '0.12em' });
  const ex = h('div', 'abs mono', tbl, '예시');
  css(ex, { right: '0', top: '0', fontSize: '18px', color: COL.dim });
  const grid = [['칸', 'AI 초안', '사람 결정', ''], ['전체 등급', 'B', 'B', ''], ['공연', 'B', 'A', '≠ 초안과 다름']];
  const cellEls = grid.map((row, ri) => {
    const r = h('div', 'abs', tbl);
    css(r, { left: '0', top: 48 + ri * 92 + 'px', width: '1400px', height: '92px', borderBottom: '2px solid ' + COL.dim2 });
    const xs = [0, 360, 640, 900];
    return row.map((txt, ci) => {
      const c = h('div', 'abs ' + (ri === 0 ? 'mono' : ci === 0 ? 'body' : 'grade'), r);
      const color = ri === 0 ? COL.dim : ci === 2 ? COL.human : ci === 3 ? COL.human : COL.ink;
      css(c, { left: xs[ci] + 'px', top: ri === 0 ? '34px' : '14px', fontSize: ri === 0 ? '20px' : ci === 0 ? '36px' : ci === 3 ? '28px' : '56px', color });
      if (ci === 3 && ri > 0) c.className = 'abs mono';
      c.dataset.full = txt;
      return c;
    });
  });
  const quote = h('div', 'abs body', tbl);
  css(quote, { left: '0', top: 48 + 3 * 92 + 22 + 'px', fontSize: '30px', color: '#B9BBC6' });
  const qText = '근거  “회의에서 CIPO가 공연은 A로 올리자고 했어”';
  return (lt, done) => {
    css(kick, { opacity: prog(lt, -0.25, 0.4) });
    const blink = Math.floor(lt / (B / 4)) % 2 === 0 ? 1 : 0.25;
    css(wait, { opacity: lt > -0.1 && lt < B ? blink : 0 });
    layers.forEach((L, li) => {
      const off = li === 0 ? -1 : li === 1 ? 1 : 0;
      L.cs.forEach((c, i) => {
        const p = prog(lt, B + i * 0.03, 0.4, ease.outExpo);
        const split = (1 - prog(lt, B + i * 0.03, 0.5, ease.outCubic)) * 24 * off;
        css(c, { transform: `translate(${split}px, 0) scale(${lerp(1.9, 1, p)})`, opacity: li === 2 ? clamp(p * 1.4) : p * (1 - p) * 2 });
      });
    });
    css(cap, { opacity: done ? 0.62 : 1 });
    css(tbl, { opacity: prog(lt, 0.45, 0.2) });
    cellEls.forEach((row, ri) => row.forEach((c, ci) => {
      const t0 = ri === 0 ? 0.5 : 0.5 + ri * 0.14 + ci * 0.06;
      const full = c.dataset.full;
      const n = Math.floor(clamp((lt - t0) / 0.12) * full.length);
      c.textContent = full.slice(0, n);
      if (ci === 2 && ri === 2) css(c, { transform: `scale(${1 + 0.35 * (1 - prog(lt, t0, 0.3, ease.outBack))})`, display: 'inline-block' });
    }));
    const qn = Math.floor(clamp((lt - 0.92) / 0.4) * qText.length);
    quote.textContent = qText.slice(0, qn);
  };
};

builders.make = (el, st) => {
  const base = blockBase(el, st);
  const cards = [-7, 0, 6].map((rot, i) => {
    const c = h('div', 'card', el);
    css(c, { left: 20 + i * 18 + 'px', top: 268 + i * 10 + 'px', width: '300px', height: '420px', transformOrigin: '50% 100%' });
    if (i === 2) {
      const k = h('div', 'abs mono', c, '설정집 · CHARACTER');
      css(k, { left: '24px', top: '22px', fontSize: '16px', color: COL.ai, letterSpacing: '0.1em' });
      const nm = h('div', 'abs disp', c, '주인공 갑');
      css(nm, { left: '22px', top: '58px', fontSize: '46px', fontWeight: '800' });
      [220, 180, 240, 150, 200, 120].forEach((w, j) => {
        const sk = h('div', 'skel', c);
        css(sk, { left: '24px', top: 140 + j * 34 + 'px', width: w + 'px' });
      });
      const src = h('div', 'abs mono', c, '원작 3화 · 12화');
      css(src, { left: '24px', top: '370px', fontSize: '16px', color: COL.dim });
    }
    return { c, rot };
  });
  const frames = [0, 1, 2].map(i => {
    const x = 440 + i * 330;
    const f = h('div', 'card', el);
    css(f, { left: x + 'px', top: '268px', width: '300px', height: '170px', borderRadius: '10px', background: '#0C0E13' });
    const svg = s('svg', { width: 300, height: 170, style: 'position:absolute;left:0;top:0' }, f);
    const shapes = [
      ['M 20 120 L 280 120', 'M 70 120 L 70 78', 'M 200 120 L 200 70', 'M 120 40 L 165 40 L 155 32 M 165 40 L 155 48'],
      ['M 150 85 m -45 0 a 45 45 0 1 0 90 0 a 45 45 0 1 0 -90 0', 'M 128 80 L 140 80', 'M 160 80 L 172 80', 'M 135 105 Q 150 115 165 105', 'M 230 40 L 270 40 M 230 52 L 262 52'],
      ['M 40 140 L 40 50 L 150 50 L 150 140', 'M 80 140 L 80 95 L 110 95 L 110 140', 'M 220 140 L 220 100', 'M 220 92 m -10 0 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0', 'M 20 140 L 280 140'],
    ][i].map(d => {
      const p = s('path', { d, fill: 'none', stroke: COL.ink, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': 600, 'stroke-dashoffset': 600 }, svg);
      return p;
    });
    const lb = h('div', 'abs mono', el, 'S#0' + (i + 1));
    css(lb, { left: x + 'px', top: '450px', fontSize: '18px', color: COL.dim });
    return { f, shapes, lb };
  });
  const conti = [0, 1, 2].map(i => {
    const r = h('div', 'abs', el);
    css(r, { left: '440px', top: 500 + i * 66 + 'px', width: '960px', height: '56px', borderBottom: '2px solid ' + COL.dim2 });
    const m = h('div', 'abs mono', r, ['S#01 · 사무실 · 밤', 'S#02 · 복도 · 밤', 'S#03 · 입구 · 새벽'][i]);
    css(m, { left: '0', top: '14px', fontSize: '20px', color: COL.ink });
    [260, 180, 120].forEach((w, j) => { const sk = h('div', 'skel', r); css(sk, { left: 300 + j * 290 + 'px', top: '20px', width: w + 'px' }); });
    return r;
  });
  const note = h('div', 'abs mono', el, 'TEXT CONTI · AI 이미지 생성 없음');
  css(note, { right: '0', top: '712px', fontSize: '17px', color: COL.dim });
  return (lt, done) => {
    base(lt, done);
    cards.forEach(({ c, rot }, i) => {
      const p = prog(lt, 0.05 + i * 0.08, 0.5, ease.outBack);
      css(c, { opacity: clamp(p * 2), transform: `rotate(${rot * p}deg) translateY(${(1 - p) * 60}px)` });
    });
    frames.forEach((f, i) => {
      const a = prog(lt, 0.15 + i * 0.12, 0.3, ease.outCubic);
      css(f.f, { opacity: a, transform: `translateY(${(1 - a) * 30}px)` });
      css(f.lb, { opacity: a });
      f.shapes.forEach((p, j) => p.setAttribute('stroke-dashoffset', 600 * (1 - prog(lt, 0.3 + i * 0.16 + j * 0.07, 0.5, ease.inOutCubic))));
    });
    conti.forEach((r, i) => { const a = prog(lt, 0.7 + i * 0.1, 0.35, ease.outExpo); css(r, { opacity: a, transform: `translateX(${(1 - a) * 50}px)` }); });
    css(note, { opacity: prog(lt, 1.0, 0.3) });
  };
};

builders.canon = (el, st) => {
  const base = blockBase(el, st);
  const doc = h('div', 'card', el);
  css(doc, { left: '0', top: '246px', width: '860px', height: '500px' });
  const fn = h('div', 'abs mono', doc, '51_designer_pitch_v1.md');
  css(fn, { left: '30px', top: '22px', fontSize: '18px', color: COL.dim });
  const widths = [620, 760, 540, 700, 480, 730, 610, 690, 520, 760, 580, 420];
  const lines = widths.map((w, i) => { const sk = h('div', 'skel', doc); css(sk, { left: '30px', top: 70 + i * 34 + 'px', width: w + 'px' }); return sk; });
  const marks = [[3, B, '설정 위반 · 원작 12화'], [8, B * 2, '표기 오류 · 3화']].map(([li, t0, txt]) => {
    const hl = h('div', 'abs', doc);
    css(hl, { left: '20px', top: 70 + li * 34 - 9 + 'px', width: widths[li] + 20 + 'px', height: '32px', borderRadius: '8px', border: '3px solid ' + COL.alert, background: 'rgba(255,75,58,0.18)', boxSizing: 'border-box' });
    const tg = h('div', 'abs', el);
    css(tg, { left: '900px', top: 246 + 70 + li * 34 - 18 + 'px', height: '50px', padding: '0 20px', borderRadius: '25px', border: '3px solid ' + COL.alert, font: '700 22px/44px Meslo', color: COL.alert, whiteSpace: 'nowrap', boxSizing: 'border-box' });
    tg.dataset.txt = txt;
    const ln = h('div', 'abs', el);
    css(ln, { left: 20 + widths[li] + 20 + 'px', top: 246 + 70 + li * 34 + 6 + 'px', width: 900 - (40 + widths[li]) + 'px', height: '3px', background: COL.alert, transformOrigin: '0 50%' });
    return { hl, tg, ln, t0 };
  });
  const scan = h('div', 'abs', doc);
  css(scan, { left: '0', top: '0', width: '860px', height: '4px', background: COL.ai, boxShadow: '0 0 20px 6px rgba(54,226,255,0.55)' });
  const bible = h('div', 'card', el);
  css(bible, { left: '900px', top: '640px', width: '500px', height: '110px' });
  const bk = h('div', 'abs mono', bible, '설정집 · 주인공 갑 · 하지 않는 것');
  css(bk, { left: '24px', top: '20px', fontSize: '17px', color: COL.ai });
  [380, 300].forEach((w, j) => { const sk = h('div', 'skel', bible); css(sk, { left: '24px', top: 54 + j * 26 + 'px', width: w + 'px' }); });
  return (lt, done) => {
    base(lt, done);
    css(doc, { opacity: prog(lt, -0.05, 0.3) });
    lines.forEach((l, i) => css(l, { opacity: prog(lt, i * 0.02, 0.2) }));
    const sc = clamp((lt - 0.05) / 1.25);
    css(scan, { opacity: sc > 0 && sc < 1 ? 1 : 0, transform: `translateY(${lerp(60, 480, sc)}px)` });
    const fixT = 1.3;
    marks.forEach(m => {
      const a = prog(lt, m.t0, 0.25, ease.outExpo);
      const fixed = lt >= fixT + (m.t0 - B) * 0.3;
      const c = fixed ? COL.ai : COL.alert;
      css(m.hl, { opacity: a, borderColor: c, background: fixed ? 'rgba(54,226,255,0.14)' : 'rgba(255,75,58,0.18)', transform: `scaleX(${lerp(0.6, 1, a)})`, transformOrigin: '0 50%' });
      css(m.tg, { opacity: a, borderColor: c, color: c, transform: `translateX(${(1 - a) * 40}px)` });
      m.tg.textContent = fixed ? '✓ 수정됨' : m.tg.dataset.txt;
      css(m.ln, { opacity: a, background: c, transform: `scaleX(${a})` });
    });
    css(bible, { opacity: prog(lt, 0.6, 0.35), transform: `translateY(${(1 - prog(lt, 0.6, 0.5, ease.outExpo)) * 40}px)` });
  };
};

builders.launch = (el, st) => {
  const base = blockBase(el, st);
  const svg = s('svg', { width: 1400, height: 760, style: 'position:absolute;left:0;top:0;overflow:visible' }, el);
  const N = { KR: [230, 470], JP: [720, 300], US: [1220, 380], SEA: [780, 640] };
  const arcs = [['JP', 'M 230 470 Q 430 250 720 300', '1차 · 일본 웹툰'], ['US', 'M 230 470 Q 720 120 1220 380', '1차 · 영어판'], ['SEA', 'M 230 470 Q 470 700 780 640', '2차 · 영상']].map(([k, d, lab], i) => {
    const p = s('path', { d, fill: 'none', stroke: COL.ai, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-dasharray': 1400, 'stroke-dashoffset': 1400, opacity: 0.9 }, svg);
    const dot = s('circle', { r: 9, fill: '#E9FCFF' }, svg);
    return { k, p, dot, lab, i };
  });
  const nodes = Object.entries(N).map(([k, [x, y]]) => {
    const c = s('circle', { cx: x, cy: y, r: k === 'KR' ? 20 : 16, fill: k === 'KR' ? COL.ink : COL.bg, stroke: k === 'KR' ? COL.ink : COL.ai, 'stroke-width': 4 }, svg);
    const lb = h('div', 'abs mono', el, k);
    css(lb, { left: x + 30 + 'px', top: y - 30 + 'px', fontSize: '30px', color: COL.ink, letterSpacing: '0.08em' });
    const sub = h('div', 'abs body', el, k === 'KR' ? '원작 · 국내' : arcs.find(a => a.k === k).lab);
    css(sub, { left: x + 30 + 'px', top: y + 8 + 'px', fontSize: '25px', color: k === 'KR' ? COL.dim : COL.ai });
    return { k, c, lb, sub };
  });
  const order = h('div', 'abs mono', el, '시연 판정의 확장 순서');
  css(order, { right: '0', top: '262px', fontSize: '17px', color: COL.dim });
  const checks = ['현지화 점검표', '사람 검수', '마케팅 소재 요청서'].map((txt, i) => {
    const r = h('div', 'abs body', el);
    css(r, { left: '0', top: 600 + i * 46 + 'px', fontSize: '27px', color: COL.ink });
    const box = h('span', '', r);
    css(box, { display: 'inline-block', width: '26px', height: '26px', border: '3px solid ' + (i === 1 ? COL.human : COL.ai), borderRadius: '6px', marginRight: '14px', verticalAlign: '-4px', boxSizing: 'border-box' });
    h('span', '', r, txt);
    return { r, box, i };
  });
  return (lt, done) => {
    base(lt, done);
    arcs.forEach(a => {
      const p = prog(lt, 0.08 + a.i * 0.12, 0.6, ease.inOutCubic);
      a.p.setAttribute('stroke-dashoffset', 1400 * (1 - p));
      const q = clamp((lt - (0.08 + a.i * 0.12)) / 0.6);
      const L = a.p.getTotalLength(), pt = a.p.getPointAtLength(L * ease.inOutCubic(q));
      a.dot.setAttribute('cx', pt.x); a.dot.setAttribute('cy', pt.y);
      a.dot.setAttribute('opacity', q > 0 && q < 1 ? 1 : 0);
    });
    nodes.forEach((n, i) => {
      const idx = arcs.findIndex(a => a.k === n.k);
      const t0 = n.k === 'KR' ? -0.1 : 0.08 + idx * 0.12 + 0.55;
      const p = prog(lt, t0, 0.35, ease.outBack);
      n.c.setAttribute('transform', `translate(${N[n.k][0]} ${N[n.k][1]}) scale(${p}) translate(${-N[n.k][0]} ${-N[n.k][1]})`);
      if (n.k !== 'KR') n.c.setAttribute('fill', p >= 1 ? 'rgba(54,226,255,0.3)' : COL.bg);
      css(n.lb, { opacity: clamp(p) }); css(n.sub, { opacity: clamp(p) });
    });
    css(order, { opacity: prog(lt, 0.9, 0.3) });
    checks.forEach(c => {
      const p = prog(lt, 1.0 + c.i * 0.16, 0.25, ease.outExpo);
      css(c.r, { opacity: prog(lt, 0.7 + c.i * 0.08, 0.3) });
      css(c.box, { background: p > 0.5 ? (c.i === 1 ? COL.human : COL.ai) : 'transparent', transform: `scale(${1 + 0.3 * Math.sin(PI * p)})` });
    });
  };
};

builders.perf = (el, st) => {
  const base = blockBase(el, st);
  const cards = ['A', 'B'].map((k, i) => {
    const c = h('div', 'card', el);
    css(c, { left: i * 560 + 'px', top: '248px', width: '520px', height: '330px' });
    const m = h('div', 'abs mono', c, 'CASE ' + k);
    css(m, { left: '28px', top: '24px', fontSize: '20px', color: COL.ai, letterSpacing: '0.12em' });
    const ttl = h('div', 'abs disp', c, '작품 ' + k);
    css(ttl, { left: '26px', top: '62px', fontSize: '60px', fontWeight: '800' });
    const bars = [[230, 150], [300, 110]].map(([w, x0], j) => {
      const b = h('div', 'abs', c);
      css(b, { left: '28px', top: 152 + j * 44 + 'px', width: w + 'px', height: '30px', background: COL.ink, transformOrigin: '0 50%', borderRadius: '3px' });
      return b;
    });
    const red = h('div', 'abs mono', c, '작품명 가림 · 컷오프 이전 자료만');
    css(red, { left: '28px', top: '250px', fontSize: '17px', color: COL.dim });
    return { c, bars, ttl };
  });
  const lockSvg = s('svg', { width: 240, height: 280, style: 'position:absolute;left:1150px;top:250px;overflow:visible' }, el);
  const shackle = s('path', { d: 'M 70 120 L 70 80 A 50 50 0 0 1 170 80 L 170 120', fill: 'none', stroke: COL.alert, 'stroke-width': 18, 'stroke-linecap': 'round' }, lockSvg);
  const body = s('rect', { x: 40, y: 118, width: 160, height: 130, rx: 18, fill: COL.alert }, lockSvg);
  const hole = s('circle', { cx: 120, cy: 175, r: 14, fill: COL.bg }, lockSvg);
  const hash = h('div', 'abs mono', el);
  css(hash, { left: '1130px', top: '540px', fontSize: '20px', color: COL.alert, width: '270px' });
  const hashTxt = 'lock.sha\n9f3c1e7a…';
  hash.style.whiteSpace = 'pre';
  const res = h('div', 'abs', el);
  css(res, { left: '0', top: '620px', width: '1400px', height: '120px' });
  const rk = h('div', 'abs mono', res, '적중표 · 예시');
  css(rk, { left: '0', top: '0', fontSize: '18px', color: COL.dim, letterSpacing: '0.1em' });
  const chips = [['성공 사례', 'B', COL.ai], ['부진 사례', 'C', '#B9BBC6'], ['쌍 구분', '✓', COL.ai]].map(([a, b, c], i) => {
    const e = h('div', 'abs', res, `<span class="body" style="font-size:28px;color:${COL.ink}">${a}</span><span class="grade" style="font-size:44px;margin-left:14px;color:${c}">${b}</span>`);
    css(e, { left: i * 330 + 'px', top: '36px', height: '72px', padding: '0 28px', borderRadius: '36px', border: '3px solid ' + (i === 2 ? COL.ai : COL.dim2), display: 'flex', alignItems: 'center', boxSizing: 'border-box', background: i === 2 ? 'rgba(54,226,255,0.1)' : 'transparent' });
    return e;
  });
  return (lt, done) => {
    base(lt, done);
    cards.forEach((c, i) => {
      const a = prog(lt, -0.05 + i * 0.08, 0.35, ease.outExpo);
      css(c.c, { opacity: a, transform: `translateY(${(1 - a) * 40}px)` });
      c.bars.forEach((b, j) => {
        const p = prog(lt, 0.15 + i * 0.08 + j * 0.06, 0.3, ease.outExpo);
        css(b, { transform: `scaleX(${p})` });
      });
    });
    const lp = prog(lt, B, 0.18, ease.outBack);
    shackle.setAttribute('transform', `translate(0 ${lerp(-34, 0, lp)})`);
    css(lockSvg, { opacity: prog(lt, 0.0, 0.25), transform: `scale(${1 + 0.12 * Math.sin(PI * clamp((lt - B) / 0.3))})` });
    const n = Math.floor(clamp((lt - B - 0.05) / 0.45) * hashTxt.length);
    hash.textContent = hashTxt.slice(0, n);
    css(res, { opacity: prog(lt, B * 2.2, 0.3) });
    chips.forEach((c, i) => { const p = prog(lt, B * 2.2 + i * 0.1, 0.4, ease.outBack); css(c, { opacity: clamp(p * 1.5), transform: `scale(${lerp(0.6, 1, p)})` }); });
  };
};

REEL.scene({
  id: 'worldscene', start: 5.45, end: 26.4,
  setup(el) {
    // 배경 점(패럴랙스)
    this.bg = h('canvas', 'full', el);
    this.bg.width = W; this.bg.height = H;
    this.bgc = this.bg.getContext('2d');
    this.world = h('div', '', el);
    this.world.id = 'world';
    // 고리 SVG(월드 좌표)
    this.svg = s('svg', { width: 1, height: 1, style: 'position:absolute;left:0;top:0;overflow:visible' }, this.world);
    const pts = [];
    for (let d = 190; d <= 550.001; d += 0.5) pts.push(ell(d));
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.total = this.cum[this.cum.length - 1];
    const d = 'M ' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ');
    this.ghost = s('path', { d, fill: 'none', stroke: COL.dim2, 'stroke-width': 4, 'stroke-dasharray': '3 26', 'stroke-linecap': 'round' }, this.svg);
    this.glow = s('path', { d, fill: 'none', stroke: COL.ai, 'stroke-width': 18, 'stroke-linecap': 'round', opacity: 0.16, 'stroke-dasharray': this.total, 'stroke-dashoffset': this.total }, this.svg);
    this.trail = s('path', { d, fill: 'none', stroke: COL.ai, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-dasharray': this.total, 'stroke-dashoffset': this.total }, this.svg);
    // 판정 원장으로 모이는 선
    const P = k => STATIONS.find(x => x.key === k).p;
    const spoke = (a, b, bend) => {
      const mx = (a[0] + b[0]) / 2 + bend[0], my = (a[1] + b[1]) / 2 + bend[1];
      return `M ${a[0]} ${a[1]} Q ${mx} ${my} ${b[0]} ${b[1]}`;
    };
    this.spokes = [
      [spoke(P('human'), [380, -60], [200, 380]), COL.human],
      [spoke(P('perf'), [-80, 230], [-500, -200]), COL.ai],
      [spoke([-260, -200], P('verdict'), [-260, -300]), COL.ink],
    ].map(([dd, c]) => {
      const p = s('path', { d: dd, fill: 'none', stroke: c, 'stroke-width': 10, 'stroke-dasharray': '30 22', 'stroke-linecap': 'round', opacity: 0 }, this.svg);
      return p;
    });
    // 판정 회의 관문
    const hs = STATIONS[4];
    const g0 = [hs.p[0] - hs.n[0] * 260, hs.p[1] - hs.n[1] * 260], g1 = [hs.p[0] + hs.n[0] * 40, hs.p[1] + hs.n[1] * 40];
    this.gate = s('line', { x1: g0[0], y1: g0[1], x2: g1[0], y2: g1[1], stroke: COL.human, 'stroke-width': 16, 'stroke-linecap': 'round', opacity: 0 }, this.svg);
    // 정거장 표시
    this.marks = STATIONS.map(st => ({
      st,
      c: s('circle', { cx: st.p[0], cy: st.p[1], r: 16, fill: COL.bg, stroke: COL.dim, 'stroke-width': 4 }, this.svg),
      pulse: s('circle', { cx: st.p[0], cy: st.p[1], r: 16, fill: 'none', stroke: st.key === 'human' ? COL.human : COL.ai, 'stroke-width': 4, opacity: 0 }, this.svg),
    }));
    // 블록
    this.blocks = STATIONS.map(st => {
      const num = h('div', 'abs disp', this.world, st.step);
      css(num, { left: st.c[0] + BW / 2 - 760 + 'px', top: st.c[1] - BH / 2 - 210 + 'px', fontSize: '820px', color: 'transparent',
        WebkitTextStroke: '3px rgba(93,97,114,0.32)', letterSpacing: '-0.06em', lineHeight: '1' });
      const el2 = h('div', 'block', this.world);
      css(el2, { left: st.c[0] - BW / 2 + 'px', top: st.c[1] - BH / 2 + 'px' });
      const br = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([rx, ry]) => {
        const c = h('div', 'abs', el2);
        css(c, { width: '64px', height: '64px', left: rx ? 'auto' : '-34px', right: rx ? '-34px' : 'auto', top: ry ? 'auto' : '-22px', bottom: ry ? '-30px' : 'auto',
          borderStyle: 'solid', borderColor: st.key === 'human' ? 'rgba(255,201,51,0.7)' : 'rgba(54,226,255,0.55)', borderWidth: `${ry ? 0 : 3}px ${rx ? 3 : 0}px ${ry ? 3 : 0}px ${rx ? 0 : 3}px`,
          transformOrigin: `${rx ? 100 : 0}% ${ry ? 100 : 0}%` });
        return c;
      });
      return { st, el: el2, num, br, render: builders[st.key](el2, st) };
    });
    // 속도선
    this.sp = h('canvas', 'full', el);
    this.sp.width = W; this.sp.height = H;
    this.spc = this.sp.getContext('2d');
    this.tokenLayer = h('div', 'full', el);
    this.token = makeToken(this.tokenLayer);
  },
  render(lt, ctx) {
    const t = ctx.t;
    const c = cam(t);
    const [shx, shy] = shake(t);
    css(this.world, { transform: `translate(${CX + shx}px, ${CY + shy}px) rotate(${c.r}deg) scale(${c.z}) translate(${-c.x}px, ${-c.y}px)` });
    const sw = Math.max(5, 2.8 / c.z);
    this.trail.setAttribute('stroke-width', sw);
    this.ghost.setAttribute('stroke-width', Math.max(4, 2 / c.z));
    // 지나온 길
    const deg = tokenDeg(t);
    const k = clamp((deg - 190) / 0.5, 0, this.cum.length - 1);
    const i0 = Math.floor(k), fr = k - i0;
    const L = this.cum[i0] + ((this.cum[Math.min(i0 + 1, this.cum.length - 1)] - this.cum[i0]) * fr);
    this.trail.setAttribute('stroke-dashoffset', this.total - L);
    this.glow.setAttribute('stroke-dashoffset', this.total - L);
    this.glow.setAttribute('stroke-width', sw * 4.2);
    // 정거장 표시
    for (const m of this.marks) {
      const reached = t >= m.st.T - 0.02;
      m.c.setAttribute('fill', reached ? (m.st.key === 'human' && t >= m.st.T + B ? COL.human : COL.ai) : COL.bg);
      m.c.setAttribute('stroke', reached ? (m.st.key === 'human' && t >= m.st.T + B ? COL.human : COL.ai) : COL.dim);
      m.c.setAttribute('r', Math.max(16, 9 / c.z));
      const pp = clamp((t - m.st.T) / 0.7);
      m.pulse.setAttribute('r', Math.max(16, 9 / c.z) * (1 + 5 * ease.outCubic(pp)));
      m.pulse.setAttribute('opacity', pp > 0 && pp < 1 ? (1 - pp) * 0.9 : 0);
      m.pulse.setAttribute('stroke-width', Math.max(4, 2 / c.z));
    }
    // 관문
    const hs = STATIONS[4];
    const ga = t < hs.T - 0.4 ? 0 : t < hs.T + B ? 0.35 + 0.15 * Math.sin((t - hs.T) * 40) : 1;
    this.gate.setAttribute('opacity', ga);
    this.gate.setAttribute('stroke-width', t >= hs.T + B ? 16 + 30 * Math.exp(-(t - hs.T - B) * 8) : 12);
    // 원장으로 모이는 선
    this.spokes.forEach((p, i) => {
      const a = clamp((t - (at(12) + 0.35 + i * 0.22)) / 0.5);
      p.setAttribute('opacity', a * (1 - clamp((t - 25.85) / 0.2)));
      p.setAttribute('stroke-dashoffset', -((t * 260) % 52));
      p.setAttribute('stroke-width', Math.max(8, 2.6 / c.z));
    });
    // 블록
    for (const b of this.blocks) {
      const blt = t - b.st.T;
      const next = STATIONS[STATIONS.indexOf(b.st) + 1];
      const done = next ? t > next.T + 0.1 : t > at(12) + 0.1;
      const cull = blt < -1.2 && t < at(12);
      b.el.style.visibility = cull ? 'hidden' : 'inherit';
      if (!cull) b.render(Math.max(-0.4, blt), done && t < at(12));
      css(b.el, { opacity: t > 25.8 ? 1 - clamp((t - 25.8) / 0.25) : 1 });
      const bp = prog(blt, -0.2, 0.45, ease.outExpo);
      b.br.forEach((c, i) => css(c, { opacity: bp * (t > at(12) ? 0.5 : 1), transform: `scale(${lerp(2.2, 1, bp)})` }));
      const np = prog(blt, -0.3, 0.9, ease.outCubic);
      b.num.style.visibility = cull ? 'hidden' : 'inherit';
      css(b.num, { opacity: np * (1 - prog(t, at(12) - 0.1, 0.4)), transform: `translate(${(1 - np) * 160 + blt * -40}px, 0)` });
    }
    // 배경 점
    const g = this.bgc;
    g.clearRect(0, 0, W, H);
    for (const [depth, alpha, base] of [[0.35, 0.11, 90], [0.7, 0.16, 150]]) {
      const zz = Math.pow(c.z, 0.65) * depth;
      const gap = base * zz;
      if (gap < 9) continue;
      const ox = (((-c.x * c.z * depth) % gap) + gap) % gap, oy = (((-c.y * c.z * depth) % gap) + gap) % gap;
      g.fillStyle = `rgba(160,166,190,${alpha})`;
      const sz = Math.max(1.4, 2.6 * zz);
      for (let x = ox - gap; x < W + gap; x += gap) for (let y = oy - gap; y < H + gap; y += gap) g.fillRect(x + shx * depth, y + shy * depth, sz, sz);
    }
    // 속도선: 카메라가 화면에서 움직인 양으로 그린다
    const sg = this.spc;
    sg.clearRect(0, 0, W, H);
    const cp = cam(t - 1 / 60);
    const q = project(cp.x, cp.y, c);
    const vx = q[0] - CX, vy = q[1] - CY, sp = Math.hypot(vx, vy);
    if (sp > 22 && t < at(12)) {
      const ux = vx / sp, uy = vy / sp, len = Math.min(900, sp * 9), a = clamp((sp - 22) / 60) * 0.5;
      for (let i = 0; i < 46; i++) {
        const px = rand(i, 1) * W, py = rand(i, 2) * H, ln = len * (0.3 + 0.7 * rand(i, 3));
        const gr = sg.createLinearGradient(px, py, px - ux * ln, py - uy * ln);
        gr.addColorStop(0, `rgba(230,240,255,${a})`); gr.addColorStop(1, 'rgba(230,240,255,0)');
        sg.strokeStyle = gr; sg.lineWidth = 1 + 2 * rand(i, 4);
        sg.beginPath(); sg.moveTo(px, py); sg.lineTo(px - ux * ln, py - uy * ln); sg.stroke();
      }
    }
    // 토큰
    const tp = ell(deg);
    const [x, y] = project(tp[0], tp[1], c);
    const tq = ell(tokenDeg(t - 1 / 60));
    const [x0, y0] = project(tq[0], tq[1], cam(t - 1 / 60));
    const human = clamp((t - (hs.T + B)) / 0.25);
    const col = ease.inExpo(clamp((t - 25.9) / 0.38));
    const sm = t > 5.7 && t < 25.85 ? 1 : 0;
    this.token.set(lerp(x, CX, col), lerp(y, CY, col), t, { scale: 1 + 0.5 * Math.exp(-Math.max(0, t - (hs.T + B)) * 6) * (t > hs.T + B ? 1 : 0), human, alpha: 1, vx: (x - x0) * sm, vy: (y - y0) * sm });
  },
});

/* ======================================================================
 * 13~14마디: 가운데 문장(전경 위) + 에이전트 16명
 * ==================================================================== */
REEL.scene({
  id: 'center', start: at(12), end: 26.1,
  setup(el) {
    this.scrim = h('div', 'abs', el);
    css(this.scrim, { left: CX - 520 + 'px', top: CY - 230 + 'px', width: '1040px', height: '460px', background: 'radial-gradient(ellipse at center, rgba(7,8,11,0.96) 40%, rgba(7,8,11,0) 72%)' });
    const mk = (kick, lines, accent) => {
      const g = h('div', 'abs', el);
      css(g, { left: '0', right: '0', top: CY - 150 + 'px', textAlign: 'center' });
      const k = h('div', 'mono', g, kick);
      css(k, { fontSize: '22px', color: accent, letterSpacing: '0.16em', marginBottom: '14px' });
      const ls = lines.map(segs => {
        const ln = h('div', 'disp', g);
        css(ln, { fontSize: '100px', overflow: 'hidden', padding: '0 0.05em 0.05em' });
        return chars(ln, segs);
      });
      return { g, k, ls };
    };
    this.a = mk('LOOP — 판정 원장', [[['성과가', null]], [['다음 판단', 'ai'], ['으로.', null]]], COL.ai);
    this.b = mk('16 AGENTS · 9 STEPS · 1 LEDGER', [[['16명의 AI,', null]], [['한 방향', 'ai'], ['으로.', null]]], COL.ai);
    this.pills = h('div', 'abs', el);
    css(this.pills, { left: '0', right: '0', top: CY + 128 + 'px', display: 'flex', justifyContent: 'center', gap: '16px' });
    this.pl = [['AI 초안', COL.ai], ['사람 결정', COL.human], ['실제 결과', COL.ink]].map(([txt, c]) => {
      const p = h('div', 'mono', this.pills, txt);
      css(p, { fontSize: '22px', color: c, border: `2px solid ${c}`, borderRadius: '24px', padding: '0 20px', lineHeight: '44px', letterSpacing: '0.06em' });
      return p;
    });
  },
  render(lt, ctx) {
    const t = ctx.t;
    const [shx, shy] = shake(t);
    const out = 1 - clamp((t - 25.82) / 0.2);
    css(this.scrim, { opacity: prog(t, at(12) + 0.2, 0.5) * out });
    const show = (G, t0, t1) => {
      const kp = prog(t, t0, 0.3);
      const ex = prog(t, t1, 0.25, ease.inCubic);
      css(G.k, { opacity: kp * (1 - ex) });
      G.ls.forEach((cs, li) => cs.forEach((c, i) => {
        const p = prog(t, t0 + 0.05 + li * 0.1 + i * 0.03, 0.55, ease.outExpo);
        css(c, { transform: `translateY(${(1 - p) * 110 - ex * 110}%)` });
      }));
      css(G.g, { transform: `translate(${shx}px, ${shy}px)`, visibility: t >= t0 - 0.05 && t < t1 + 0.3 ? 'inherit' : 'hidden' });
    };
    show(this.a, at(12) + 0.15, at(13) - 0.28);
    show(this.b, at(13) + 0.02, 25.72);
    const pa = prog(t, at(12) + 0.6, 0.4) * (1 - prog(t, at(13) - 0.3, 0.2));
    css(this.pills, { opacity: pa });
    this.pl.forEach((p, i) => { const q = prog(t, at(12) + 0.6 + i * 0.1, 0.4, ease.outBack); css(p, { transform: `scale(${lerp(0.5, 1, q)})` }); });
  },
});

REEL.scene({
  id: 'agents', start: at(12) + 0.3, end: 26.1,
  setup(el) {
    this.items = [];
    let n = 0;
    STATIONS.forEach((st, si) => {
      const list = st.key === 'human' ? ['사람 · 판정 회의'] : st.agents;
      list.forEach((name, j) => {
        const e = h('div', 'abs mono', el, (st.key === 'human' ? '◆ ' : '● ') + name);
        css(e, { fontSize: '19px', color: st.key === 'human' ? COL.human : COL.ink, letterSpacing: '0.03em', whiteSpace: 'nowrap' });
        this.items.push({ e, st, j, n: st.key === 'human' ? -1 : n++, cnt: list.length });
      });
    });
    this.count = h('div', 'abs mono', el);
    css(this.count, { right: '64px', top: '96px', fontSize: '20px', color: COL.ai, letterSpacing: '0.1em', textAlign: 'right' });
    this.spokeLabels = [['결정 기록', 'human', [380, -60], COL.human], ['결과 기록', 'perf', [-80, 230], COL.ai], ['다음 판단', 'verdict', [-260, -200], COL.ink]].map(([txt, k, b, c]) => {
      const e = h('div', 'abs mono', el, txt);
      css(e, { fontSize: '19px', color: c, letterSpacing: '0.08em', background: 'rgba(7,8,11,0.8)', padding: '2px 8px' });
      return { e, k, b };
    });
  },
  render(lt, ctx) {
    const t = ctx.t;
    const c = cam(t);
    const T0 = at(13);
    let shown = 0;
    const fade = 1 - clamp((t - 25.8) / 0.2);
    for (const it of this.items) {
      const [px, py] = project(it.st.p[0], it.st.p[1], c);
      // 고리 안쪽으로 밀어 넣는다
      let dx = CX - px, dy = CY - py;
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const out = it.st.key === 'verify' ? -1.0 : 1;
      const ox = px + dx * 34 * out, oy = py + dy * 34 * out + (it.j - (it.cnt - 1) / 2) * 26 + (out < 0 ? -8 : 0);
      const left = dx < -0.25, right = dx > 0.25;
      const t0 = it.n < 0 ? T0 + 0.05 : T0 + it.n * (B / 4);
      const p = prog(t, t0, 0.3, ease.outExpo);
      if (t >= t0 && it.n >= 0) shown++;
      const w = it.e.offsetWidth;
      const x = left ? ox - w : right ? ox : ox - w / 2;
      css(it.e, { left: x + 'px', top: oy - 12 + 'px', opacity: p * fade, transform: `translate(${(1 - p) * dx * 30}px, 0)` });
    }
    this.count.textContent = `AGENTS ${String(shown).padStart(2, '0')} / 16`;
    css(this.count, { opacity: prog(t, T0, 0.2) * fade });
    for (const s2 of this.spokeLabels) {
      const st = STATIONS.find(x => x.key === s2.k);
      const f = s2.k === 'verdict' ? 0.62 : 0.32;
      const mx = lerp(st.p[0], s2.b[0], f), my = lerp(st.p[1], s2.b[1], f);
      const [x, y] = project(mx, my, c);
      css(s2.e, { left: x - s2.e.offsetWidth / 2 + 'px', top: y - 14 + 'px', opacity: prog(t, at(12) + 0.9, 0.4) * (1 - prog(t, at(13) - 0.2, 0.25)) });
    }
  },
});

/* ======================================================================
 * 15~16마디: 클로징 — 점으로 접히고, 종이가 열리고, 점이 마침표가 된다
 * ==================================================================== */
REEL.scene({
  id: 'closing', start: 25.95, end: 30.01,
  setup(el) {
    this.flash = h('div', 'full', el);
    css(this.flash, { background: COL.ink });
    this.paper = h('div', 'full', el);
    css(this.paper, { background: COL.paper });
    this.group = h('div', 'full', el);
    this.l1 = h('div', 'abs disp', this.group);
    css(this.l1, { left: '200px', top: '268px', fontSize: '176px', color: COL.dark, overflow: 'hidden', padding: '0 0.04em 0.05em' });
    this.c1 = chars(this.l1, [['IP 하나를,', null]]);
    this.l2 = h('div', 'abs disp', this.group);
    css(this.l2, { left: '200px', top: '462px', fontSize: '176px', color: COL.dark, overflow: 'hidden', padding: '0 0.04em 0.05em' });
    this.c2 = chars(this.l2, [['더 오래, 더 크게', null]]);
    this.rule = h('div', 'abs', this.group);
    css(this.rule, { left: '206px', top: '720px', width: '1508px', height: '3px', background: COL.dark, transformOrigin: '0 50%' });
    this.k1 = h('div', 'abs body', this.group, '근거는 AI가 모으고, 결정은 사람이 한다.');
    css(this.k1, { left: '206px', top: '752px', fontSize: '44px', color: COL.dark, fontWeight: '700' });
    this.k2 = h('div', 'abs mono', this.group, 'IP OPS HARNESS — 7 STAGES · 16 AGENTS · 1 LEDGER');
    css(this.k2, { left: '206px', top: '830px', fontSize: '22px', color: '#6B6A66', letterSpacing: '0.14em' });
    this.mark = s('svg', { width: 520, height: 340, style: 'position:absolute;left:1290px;top:300px;overflow:visible' }, this.group);
    this.markRing = s('ellipse', { cx: 260, cy: 170, rx: 230, ry: 130, fill: 'none', stroke: COL.dark, 'stroke-width': 5, 'stroke-dasharray': 1200, 'stroke-dashoffset': 1200 }, this.mark);
    this.markDots = STATIONS.map((st, i) => s('circle', { cx: 260 + 230 * Math.cos(rad(st.deg)), cy: 170 + 130 * Math.sin(rad(st.deg)), r: st.key === 'human' ? 12 : 9, fill: st.key === 'human' ? COL.human : COL.dark, opacity: 0 }, this.mark));
    this.markCore = s('circle', { cx: 260, cy: 170, r: 0, fill: 'none', stroke: COL.dark, 'stroke-width': 3, 'stroke-dasharray': '4 8' }, this.mark);
    this.dot = h('div', 'abs', el);
    css(this.dot, { left: '0', top: '0', width: '0', height: '0' });
    this.dotCore = h('div', 'abs', this.dot);
    this.dotRing = h('div', 'abs', this.dot);
    css(this.dotRing, { borderRadius: '50%', border: '4px solid ' + COL.human, boxSizing: 'border-box' });
    this.dotCore.style.borderRadius = '50%';
  },
  render(lt, ctx) {
    const t = ctx.t;
    const T = at(14);
    const [shx, shy] = shake(t);
    css(this.flash, { opacity: t < T ? 0 : Math.exp(-(t - T) * 9) * 0.0 });
    const ir = ease.outExpo(clamp((t - T) / 0.6)) * 1250;
    css(this.paper, { clipPath: `circle(${ir}px at ${CX}px ${CY}px)`, visibility: t >= T ? 'inherit' : 'hidden' });
    const T1 = at(14, 1), T2 = at(14, 2);
    this.c1.forEach((c, i) => { const p = prog(t, T1 - 0.05 + i * 0.03, 0.5, ease.outExpo); css(c, { transform: `translateY(${(1 - p) * 110}%)` }); });
    this.c2.forEach((c, i) => { const p = prog(t, T2 - 0.05 + i * 0.03, 0.5, ease.outExpo); css(c, { transform: `translateY(${(1 - p) * 110}%)` }); });
    const drift = 1 + 0.025 * clamp((t - T1) / (30 - T1));
    css(this.group, { transform: `translate(${shx}px, ${shy}px) translate(${CX}px, ${CY}px) scale(${drift}) translate(${-CX}px, ${-CY}px)`, visibility: t >= T ? 'inherit' : 'hidden' });
    const rp = prog(t, at(15) - 0.1, 0.6, ease.outExpo);
    css(this.rule, { transform: `scaleX(${rp})` });
    const k1 = prog(t, at(15), 0.5, ease.outExpo), k2 = prog(t, at(15) + 0.25, 0.5, ease.outExpo);
    css(this.k1, { opacity: k1, transform: `translateY(${(1 - k1) * 30}px)` });
    css(this.k2, { opacity: k2, transform: `translateY(${(1 - k2) * 20}px)` });
    const mk = prog(t, at(15) - 0.2, 1.0, ease.inOutCubic);
    this.markRing.setAttribute('stroke-dashoffset', 1200 * (1 - mk));
    this.markRing.setAttribute('transform', `rotate(${-8 + 8 * mk} 260 170)`);
    this.markDots.forEach((d, i) => d.setAttribute('opacity', prog(t, at(15) - 0.1 + i * 0.07, 0.2)));
    this.markCore.setAttribute('r', 46 * prog(t, at(15) + 0.5, 0.5, ease.outBack));
    // 점: 화면 가운데(고리가 접힌 자리) → 둘째 줄 마침표 자리
    const lw = this.l2.offsetWidth;
    const ex = 200 + lw - 8, ey = 462 + 176 * 0.84;
    const tx = CX + (ex - CX) * drift + shx, ty = CY + (ey - CY) * drift + shy;
    const fp = ease.inOutCubic(clamp((t - (T2 + 0.32)) / 0.42));
    const arc = Math.sin(PI * fp) * -160;
    const x = lerp(CX, tx, fp), y = lerp(CY, ty, fp) + arc;
    const size = lerp(22, 36, fp);
    const onPaper = t >= T + 0.05;
    css(this.dot, { transform: `translate(${x}px, ${y}px)`, visibility: t >= T - 0.05 ? 'inherit' : 'hidden' });
    css(this.dotCore, { left: -size / 2 + 'px', top: -size / 2 + 'px', width: size + 'px', height: size + 'px', background: onPaper ? COL.dark : '#E9FCFF', boxShadow: onPaper ? 'none' : '0 0 18px 4px rgba(54,226,255,0.9)' });
    const rs = size * 2.1 * (1 - 0.35 * fp);
    const land = clamp((t - (T2 + 0.74)) / 0.5);
    css(this.dotRing, { left: -rs / 2 + 'px', top: -rs / 2 + 'px', width: rs + 'px', height: rs + 'px', opacity: (1 - fp * 0.6) * (1 - land), transform: `scale(${1 + land * 1.5})` });
  },
});

/* ======================================================================
 * HUD · 플래시 · 그레인 · 비네트(맨 위)
 * ==================================================================== */
REEL.scene({
  id: 'hud', start: 0, end: 30.01,
  setup(el) {
    this.flash = h('div', 'full', el);
    this.vig = h('div', 'full', el);
    css(this.vig, { background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)' });
    // 그레인: 시드 고정 노이즈 타일 4장
    this.grain = h('div', 'full', el);
    this.tiles = [0, 1, 2, 3].map(k => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 256;
      const g = cv.getContext('2d'), img = g.createImageData(256, 256);
      for (let i = 0; i < 256 * 256; i++) {
        const v = Math.floor(rand(i, 17 + k) * 255);
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      return cv.toDataURL();
    });
    css(this.grain, { mixBlendMode: 'overlay', opacity: 0.07 });
    this.hud = h('div', 'full', el);
    this.tl = h('div', 'abs hud', this.hud, 'IP OPS HARNESS <span style="opacity:.5">/ REEL · 30s</span>');
    css(this.tl, { left: '64px', top: '44px' });
    this.tc = h('div', 'abs hud', this.hud);
    css(this.tc, { right: '64px', top: '44px', textAlign: 'right' });
    this.step = h('div', 'abs hud', this.hud);
    css(this.step, { right: '64px', bottom: '40px', textAlign: 'right' });
    this.act = h('div', 'abs hud', this.hud);
    css(this.act, { left: '64px', bottom: '40px' });
    this.crops = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([rx, ry]) => {
      const c = h('div', 'crop', this.hud);
      css(c, { left: rx ? 'auto' : '36px', right: rx ? '36px' : 'auto', top: ry ? 'auto' : '30px', bottom: ry ? '26px' : 'auto',
        borderLeftWidth: rx ? '0' : '2px', borderRightWidth: rx ? '2px' : '0', borderTopWidth: ry ? '0' : '2px', borderBottomWidth: ry ? '2px' : '0' });
      return c;
    });
  },
  render(lt, ctx) {
    const t = ctx.t;
    // 플래시
    const FL = [[at(1), 0.55, '#FFFFFF'], [at(2), 0.28, '#FFFFFF'], [at(3), 0.22, '#36E2FF'], [at(7, 1), 0.3, '#FFC933'], [at(12), 0.3, '#FFFFFF'], [at(14), 0.5, '#FFFFFF']];
    let fa = 0, fc = '#FFFFFF';
    for (const [ti, a, c] of FL) { const d = t - ti; if (d >= 0 && d < 0.4) { const v = a * Math.exp(-d * 14); if (v > fa) { fa = v; fc = c; } } }
    css(this.flash, { background: fc, opacity: fa });
    const paper = t >= at(14) + 0.12;
    css(this.vig, { opacity: paper ? 0.25 : 1 });
    const f = Math.floor(t * 60);
    css(this.grain, { backgroundImage: `url(${this.tiles[f % 4]})`, backgroundPosition: `${Math.floor(rand(f, 1) * 256)}px ${Math.floor(rand(f, 2) * 256)}px`, opacity: paper ? 0.05 : 0.075 });
    // HUD
    const hudOn = prog(t, at(2), 0.4) ;
    const color = paper ? '#8C8A84' : COL.dim;
    css(this.hud, { opacity: t < at(2) ? 0.0 : hudOn });
    [this.tl, this.tc, this.step, this.act].forEach(e => (e.style.color = color));
    this.crops.forEach(c => (c.style.borderColor = paper ? '#C9C6BE' : COL.dim2));
    const sec = Math.floor(t), fr = f % 60;
    this.tc.textContent = `TC 00:00:${String(sec).padStart(2, '0')}:${String(fr).padStart(2, '0')}  ·  128 BPM`;
    const k = stationAt(t);
    const inRun = t >= STATIONS[0].T - 0.15 && t < at(12);
    if (inRun && k >= 0) {
      const ticks = STATIONS.map((_, i) => (i <= k ? '■' : '□')).join('');
      this.step.innerHTML = `STEP ${STATIONS[k].step} / 09&nbsp;&nbsp;<span style="color:${COL.ai}">${ticks}</span>`;
      const st = STATIONS[k];
      const names = st.key === 'human' ? '사람 · 판정 회의' : st.agents.join(' · ');
      const full = (st.key === 'human' ? 'HUMAN  ' : 'ACTIVE  ') + names;
      const n = Math.floor(clamp((t - st.T + 0.1) / 0.35) * full.length);
      this.act.innerHTML = `<span style="color:${st.key === 'human' ? COL.human : COL.ai}">${full.slice(0, Math.min(n, 8))}</span>${full.slice(8, Math.max(8, n))}`;
    } else if (t >= at(12) && t < at(14)) {
      this.step.innerHTML = `LOOP&nbsp;&nbsp;<span style="color:${COL.ai}">■■■■■■■■■</span>`;
      this.act.textContent = '';
    } else {
      this.step.textContent = '';
      this.act.textContent = t >= at(14) ? 'HUMAN IN THE LOOP' : '';
    }
  },
});
