/* motion-reel 엔진 — 모든 화면은 시간 t(초)의 순수 함수다.
 * 렌더러는 임의의 프레임으로 바로 이동(seek)하고 여러 워커가 구간을 나눠 그리므로,
 * 이전 프레임의 상태·실시간 타이머·Math.random()에 의존하면 프레임마다 결과가 달라진다.
 *
 * 규약
 *   REEL.config({ duration, fps })            영상 길이와 프레임률
 *   REEL.scene({ id, start, end, setup, render })
 *       setup(el)            한 번 호출. el은 1920×1080 <section>. DOM·SVG·canvas를 만든다.
 *       render(lt, ctx)      매 프레임 호출. lt = 장면 안 시간, ctx = { t, dur, p }.
 *       장면 구간은 겹쳐도 된다(전환). 나중에 등록한 장면이 위에 그려진다.
 *   REEL.overlay(fn)         모든 프레임에 호출되는 전역 레이어(fn(t)). 필름 그레인, 진행 바 등.
 *   REEL.preload(promise)    이미지 디코드 등 준비 작업. 모두 끝나야 __ready가 true가 된다.
 *   window.__seek(t), window.__ready  렌더러가 쓰는 진입점(직접 바꾸지 않는다)
 */
(function () {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = {
    linear: p => p,
    inQuad: p => p * p,
    outQuad: p => 1 - (1 - p) * (1 - p),
    inOutQuad: p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
    inCubic: p => p * p * p,
    outCubic: p => 1 - Math.pow(1 - p, 3),
    inOutCubic: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    inQuart: p => p * p * p * p,
    outQuart: p => 1 - Math.pow(1 - p, 4),
    inOutQuart: p => (p < 0.5 ? 8 * p ** 4 : 1 - Math.pow(-2 * p + 2, 4) / 2),
    inExpo: p => (p === 0 ? 0 : Math.pow(2, 10 * p - 10)),
    outExpo: p => (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    inOutExpo: p => (p === 0 ? 0 : p === 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2),
    outBack: (p, s = 1.70158) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2),
    inBack: (p, s = 1.70158) => (s + 1) * p * p * p - s * p * p,
    outElastic: p => (p === 0 || p === 1 ? p : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
    inOutSine: p => -(Math.cos(Math.PI * p) - 1) / 2,
  };
  // start부터 dur 동안 0→1로 가는 진행률(이징 적용)
  const prog = (t, start, dur, e = ease.outCubic) => e(clamp((t - start) / dur));
  // 키프레임 보간: kf(t, [[0, 0], [0.5, 1, ease.outExpo], [2, 0]]) — 각 구간의 이징은 도착 키프레임에 적는다
  function kf(t, frames) {
    if (t <= frames[0][0]) return frames[0][1];
    for (let i = 1; i < frames.length; i++) {
      const [t1, v1, e] = frames[i];
      const [t0, v0] = frames[i - 1];
      if (t <= t1) return lerp(v0, v1, (e || ease.inOutCubic)(clamp((t - t0) / (t1 - t0))));
    }
    return frames[frames.length - 1][1];
  }
  // 시드 고정 의사 난수 [0, 1)
  const rand = (i, salt = 0) => {
    const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  // 글자 단위로 나눠 span 배열을 돌려준다(한글 음절·이모지도 한 글자로). 공백은 폭을 유지한다.
  function split(el) {
    const text = el.textContent;
    el.textContent = '';
    const seg = new Intl.Segmenter('ko', { granularity: 'grapheme' });
    const spans = [];
    for (const { segment } of seg.segment(text)) {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = segment === ' ' ? ' ' : segment;
      s.style.display = 'inline-block';
      el.appendChild(s);
      spans.push(s);
    }
    return spans;
  }
  // i번째 요소의 지연 진행률
  const stagger = (t, start, each, dur, i, e = ease.outCubic) => prog(t, start + i * each, dur, e);
  // 숫자 카운터 문자열
  const count = (p, to, { decimals = 0, comma = true, from = 0 } = {}) => {
    const v = lerp(from, to, p);
    const s = v.toFixed(decimals);
    return comma ? Number(s).toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : s;
  };
  // 스타일 일괄 지정 헬퍼
  const css = (el, o) => { for (const k in o) el.style[k] = o[k]; return el; };
  const h = (tag, cls, parent, html) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html != null) el.innerHTML = html;
    if (parent) parent.appendChild(el);
    return el;
  };
  const svgNS = 'http://www.w3.org/2000/svg';
  const s = (tag, attrs, parent) => {
    const el = document.createElementNS(svgNS, tag);
    for (const k in attrs || {}) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  };

  const scenes = [];
  const overlays = [];
  const waits = [];
  const cfg = { duration: 60, fps: 30, W: 1920, H: 1080 };

  function seek(t) {
    for (const sc of scenes) {
      const on = t >= sc.start && t < sc.end;
      if (on !== sc._on) {
        sc.el.style.visibility = on ? 'visible' : 'hidden';
        sc._on = on;
      }
      if (on && sc.render) sc.render(t - sc.start, { t, dur: sc.end - sc.start, p: (t - sc.start) / (sc.end - sc.start) });
    }
    for (const fn of overlays) fn(t);
    window.__t = t;
  }

  async function init() {
    const stage = document.getElementById('stage');
    for (const sc of scenes) {
      sc.el = h('section', 'scene', stage);
      sc.el.id = sc.id;
      sc.el.style.visibility = 'hidden';
      sc._on = false;
      if (sc.setup) sc.setup(sc.el);
    }
    await document.fonts.ready;
    const families = (document.documentElement.dataset.fonts || '').split(',').map(x => x.trim()).filter(Boolean);
    await Promise.all(families.map(f => document.fonts.load(`900 64px "${f}"`, '가나다ABC123').catch(() => null)));
    await Promise.all(waits);
    const imgs = [...document.images].map(img => (img.complete ? img.decode().catch(() => null) : new Promise(r => { img.onload = img.onerror = r; })));
    await Promise.all(imgs);
    const params = new URLSearchParams(location.search);
    seek(Number(params.get('t') || 0));
    window.__ready = true;
    if (!params.has('render')) preview();
  }

  // 미리보기 플레이어(렌더 모드가 아닐 때만). 스페이스 재생/정지, ←→ 1초 이동, 숫자키 n×10%.
  function preview() {
    const wrap = document.getElementById('wrap');
    const fit = () => {
      const k = Math.min(innerWidth / cfg.W, (innerHeight - 40) / cfg.H);
      wrap.style.transform = `scale(${k})`;
    };
    fit();
    addEventListener('resize', fit);
    const bar = h('input', 'scrub', document.body);
    Object.assign(bar, { type: 'range', min: 0, max: cfg.duration, step: 1 / cfg.fps, value: window.__t || 0 });
    let playing = false, t0 = 0, base = 0;
    const loop = now => {
      if (!playing) return;
      const t = (base + (now - t0) / 1000) % cfg.duration;
      seek(t);
      bar.value = t;
      requestAnimationFrame(loop);
    };
    bar.oninput = () => { playing = false; seek(Number(bar.value)); };
    addEventListener('keydown', e => {
      if (e.code === 'Space') { playing = !playing; base = window.__t; t0 = performance.now(); requestAnimationFrame(loop); }
      if (e.code === 'ArrowRight') seek(Math.min(cfg.duration, window.__t + 1));
      if (e.code === 'ArrowLeft') seek(Math.max(0, window.__t - 1));
      if (/^Digit\d$/.test(e.code)) seek((Number(e.code.slice(5)) / 10) * cfg.duration);
      bar.value = window.__t;
    });
  }

  window.__ready = false;
  window.__seek = seek;
  window.REEL = {
    get duration() { return cfg.duration; },
    get fps() { return cfg.fps; },
    W: cfg.W, H: cfg.H,
    config(o) { Object.assign(cfg, o); },
    scene(def) { scenes.push(def); },
    overlay(fn) { overlays.push(fn); },
    preload(p) { waits.push(p); },
    ease, prog, kf, clamp, lerp, rand, split, stagger, count, css, h, s,
  };
  addEventListener('load', init);
})();
