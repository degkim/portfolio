(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const page = document.body.dataset.page;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, lx: null, ly: null, dirty: false };
  const fg = () => getComputedStyle(root).getPropertyValue('--fg').trim();
  const pad2 = n => String(n).padStart(2, '0');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  /* ------------------------------------------------------------
     Data — project/data.js (포트폴리오 빌더가 project/ 폴더에서 만드는 파일)
     ------------------------------------------------------------ */
  const SITE = window.SITE || { name: 'Dongeun Kim', email: '' };
  const IMG_BASE = 'project/';
  const isVid = f => /\.(mov|mp4|m4v)$/i.test(f || '');
  const params = new URLSearchParams(location.search);
  const PREVIEW = params.has('preview'); // 빌더 오른쪽 미리보기(iframe) 안
  const ratioNum = r => { const [a, b] = r.split('/').map(Number); return a / b; };
  const media = (s, ratio, alt = '', cls = '') =>
    `<div class="media ${cls}" style="aspect-ratio:${ratio}"><img src="${s}" alt="${esc(alt)}" loading="lazy" decoding="async" draggable="false"><canvas></canvas></div>`;
  const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const split = s => (s || '').split(',').map(t => t.trim()).filter(Boolean);
  const person = c => c.split('—').pop().trim();
  const people = p => p.credits.filter(c => c.includes('—') && !/^Type/.test(c)).map(person);
  const tagsOf = p => [p.client, p.year, ...split(p.type), ...split(p.role), ...people(p)].filter(Boolean);
  const slug = s => s.toLowerCase();

  // 숨긴 사진·없는 파일 정리, 대표 이미지와 아카이브에 쓸 사진 고르기
  function prep(p, i) {
    const sizes = p.sizes || {};
    const blocks = (p.blocks || []).filter(b => b.t === 'sec' || (b.t === 'img' && sizes[b.file]));
    const imgs = blocks.filter(b => b.t === 'img' && !b.hide);
    const photo = b => b.t === 'img' && !isVid(b.file);
    const hero = sizes[p.hero] && !isVid(p.hero) ? p.hero : (imgs.find(photo) || blocks.find(photo) || {}).file || '';
    const picks = blocks.filter(b => photo(b) && b.archive).map(b => b.file);
    return { ...p, no: pad2(i + 1), sizes, blocks, imgs, hero, picks: picks.length ? picks : hero ? [hero] : [], body: p.body || [], credits: p.credits || [] };
  }
  let P = (window.PROJECTS || []).map(prep);
  // 웹 최적화본(.optimized/)이 있으면 그것을, 없으면 원본을
  const srcOf = (p, file) => (p.opt && p.opt[file]
    ? `${IMG_BASE}${encodeURIComponent(p.id)}/${encodeURIComponent(p.opt[file])}`
    : `${IMG_BASE}${encodeURIComponent(p.id)}/${encodeURIComponent(file)}`);
  const ratioOf = (p, file) => { const z = p.sizes[file] || [4, 3]; return `${z[0]}/${z[1]}`; };
  const previewSrc = p => (p.hero ? srcOf(p, p.hero) : '');

  // 아카이브 = 빌더에서 Archive 로 고른 사진, Explore = 대표 이미지 + 갤러리 전체. 해시 순서로 섞는다
  const toItems = pairs => pairs.map(([p, file]) => ({ p, file, key: `${p.id}/${file}`, ratio: ratioOf(p, file) }))
    .sort((a, b) => hash(a.key) - hash(b.key));
  const ITEMS = toItems(P.flatMap(p => p.picks.map(f => [p, f])));
  const EX_ITEMS = toItems(P.flatMap(p => [...new Set([p.hero, ...p.imgs.map(b => b.file)].filter(f => f && !isVid(f)))].map(f => [p, f])));
  const caption = p => [p.title, p.client, ...split(p.type), p.year].filter(Boolean).join(' / ');

  /* ------------------------------------------------------------
     Header & footer (모든 페이지 공통)
     ------------------------------------------------------------ */
  const NAV = [['archive', 'Archive', 'index.html'], ['index', 'Index', 'list.html'], ['info', 'Info', 'info.html']];
  $('.site-head').innerHTML = `
    <a class="logo" href="index.html" data-wipe>${esc(SITE.name.split(' ')[0])}<span class="mute">${esc(SITE.name.split(' ').slice(1).join(' '))}</span></a>
    <nav class="nav">${NAV.map(([k, label, href]) =>
      `<a href="${href}" data-wipe data-decode class="${k === page ? 'on' : ''}">${label}</a>`).join('')}
      <a href="info.html" data-contact>Contact</a></nav>
    <div class="tools">
      <button type="button" data-act="plus" aria-label="크게 보기"><svg viewBox="0 0 9 9"><path d="M4.5 0v9M0 4.5h9"/></svg></button>
      <button type="button" data-act="minus" aria-label="작게 보기"><svg viewBox="0 0 9 9"><path d="M0 4.5h9"/></svg></button>
      <button type="button" data-act="theme" aria-label="배경색 바꾸기"><svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4.35"/></svg></button>
    </div>`;
  $('.site-foot').innerHTML = `
    <span>© 2026 ${esc(SITE.name)} — Seoul</span>
    <span id="coords">X 0000 Y 0000</span>
    <span>KST <span id="clock">00:00:00</span></span>
    <a class="u" href="#" data-top>Top ↑</a>`;

  /* ------------------------------------------------------------
     Site text — 이름·이메일·인트로·Info 문구 (빌더 Site 편집 → Publish)
     값이 없으면 HTML 에 적힌 기본 문구를 그대로 둔다
     ------------------------------------------------------------ */
  const lines = s => (s || '').split('\n').map(t => t.trim()).filter(Boolean);
  function renderSiteText() {
    const [first, ...rest] = SITE.name.split(' ');
    $('.logo').innerHTML = `${esc(first)}<span class="mute">${esc(rest.join(' '))}</span>`;
    $('.site-foot span').textContent = `© 2026 ${SITE.name} — Seoul`;
    $('[data-contact]').href = SITE.email ? `mailto:${SITE.email}` : 'info.html';
    if (!document.body.dataset.page.startsWith('project')) document.title = document.title.replace(/^.*? — /, `${SITE.name} — `);
    const put = (sel, html) => { const el = $(sel); if (el) el.innerHTML = html; };
    const I = SITE.intro, N = SITE.info;
    if (I) {
      put('.i-bio', esc(I.bio));
      const [lab, ...side] = lines(I.side);
      put('.i-status', lab ? `<span class="mute">${esc(lab)}</span>${side.map(t => `<br>${esc(t)}`).join('')}` : '');
      put('.intro-foot .r', esc(I.place));
    }
    const big = $('.intro-name');
    if (big && big.textContent !== SITE.name) { big.textContent = SITE.name; delete big.dataset.split; }
    if (N) {
      put('.info-lead', esc(N.lead));
      // "제목 — 연도" 한 줄 = 한 항목. 제목이 프로젝트와 같으면 상세로 링크
      const byTitle = new Map(P.map(p => [p.title.toLowerCase(), p.id]));
      const item = t => {
        const [title, ...tail] = t.split(' — ');
        const id = byTitle.get(title.trim().toLowerCase());
        const label = id ? `<a href="project.html?p=${encodeURIComponent(id)}" data-wipe>${esc(title)}</a>` : esc(title);
        return `<li>${label}${tail.length ? ` <span class="mute">— ${esc(tail.join(' — '))}</span>` : ''}</li>`;
      };
      const cols = N.cols.filter(c => c.title || c.text);
      put('.info-cols', cols.map((c, k) => `<div class="${cols.length === 3 && k === 2 ? 'info-wide' : ''}">
        <h2 class="mute">${esc(c.title)}</h2><ul>${lines(c.text).map(item).join('')}</ul></div>`).join(''));
    }
    const contact = $('.contact');
    if (contact) {
      contact.style.display = SITE.email ? '' : 'none';
      if (SITE.email && contact.textContent !== SITE.email) { contact.href = `mailto:${SITE.email}`; contact.textContent = SITE.email; delete contact.dataset.split; }
    }
  }
  renderSiteText();

  /* ------------------------------------------------------------
     Archive (searchsystem archive 형식)
     ------------------------------------------------------------ */
  const archiveEl = $('#archive');
  const tag = params.get('tag');
  const archiveItems = tag ? ITEMS.filter(it => tagsOf(it.p).some(t => slug(t) === slug(tag))) : ITEMS;
  const COLS = { wide: [10, 8, 6, 4, 3], mid: [6, 5, 4, 3, 2], narrow: [4, 3, 2, 2, 1] };
  const colCount = () => (innerWidth < 760 ? COLS.narrow : innerWidth < 1100 ? COLS.mid : COLS.wide)[zoom - 1];
  let renderedCols = 0;

  function renderArchive(force) {
    if (!archiveEl) return;
    const n = colCount();
    if (n === renderedCols && !force) return;
    renderedCols = n;
    const cols = Array.from({ length: n }, () => ({ h: 0, html: '' }));
    if (tag) {
      $('#arc-title').textContent = `Filter — ${tag}`;
      $('#arc-count').innerHTML = `${archiveItems.length} Images — <a class="u" href="index.html" data-wipe>Clear ×</a>`;
    } else {
      $('#arc-count').textContent = `${pad2(P.length)} Projects / ${ITEMS.length} Images`;
    }
    archiveItems.forEach(it => {
      const c = cols.reduce((a, b) => (b.h < a.h ? b : a));
      c.html += `<a class="item" href="project.html?p=${it.p.id}" data-wipe data-cursor="View">
        ${media(srcOf(it.p, it.file), it.ratio, it.p.title, 'hoverable')}
        <p class="cap" data-decode>${esc(caption(it.p))}</p></a>`;
      c.h += 1 / ratioNum(it.ratio) + 0.25;
    });
    archiveEl.innerHTML = cols.map(c => `<div class="archive-col">${c.html}</div>`).join('');
    archiveEl.classList.toggle('no-cap', zoom <= 2);
    hydrate(archiveEl);
  }

  /* ------------------------------------------------------------
     Explore (yanniceberthault explore 느낌: 드래그하는 무한 썸네일 필드)
     ------------------------------------------------------------ */
  const exploreEl = $('#explore');
  const field = exploreEl && $('.ex-field', exploreEl);
  const EX_SIZE = [80, 110, 150, 210, 290];
  const ex = { tiles: [], W: 0, H: 0, ox: 0, oy: 0, vx: 0, vy: 0, drag: null, moved: 0, built: false };

  function buildExplore() {
    if (!exploreEl || !EX_ITEMS.length) return;
    const size = EX_SIZE[zoom - 1] * (innerWidth < 760 ? 0.7 : 1);
    const cw = size * 1.75, ch = size * 1.95;
    const C = Math.ceil((innerWidth + cw * 2) / cw);
    const R = Math.ceil((innerHeight + ch * 2) / ch);
    ex.W = C * cw; ex.H = R * ch; ex.cw = cw; ex.ch = ch;
    let html = '';
    ex.tiles = [];
    for (let i = 0; i < C * R; i++) {
      const it = EX_ITEMS[i % EX_ITEMS.length];
      const col = i % C, row = Math.floor(i / C);
      const h = hash(it.key + i);
      const x = col * cw + (h % 1000) / 1000 * (cw - size) * 0.9;
      const y = row * ch + ((h >> 10) % 1000) / 1000 * (ch - size / ratioNum(it.ratio) - 24) * 0.9 + (col % 2 ? ch * 0.35 : 0);
      ex.tiles.push({ x, y });
      html += `<a class="tile" href="project.html?p=${it.p.id}" data-wipe draggable="false" style="width:${size}px">
        ${media(srcOf(it.p, it.file), it.ratio, it.p.title, 'hoverable')}
        <p class="cap" data-decode>${esc([it.p.title, it.p.year].filter(Boolean).join(' / '))}</p></a>`;
    }
    field.innerHTML = html;
    ex.nodes = $$('.tile', field);
    ex.built = true;
    placeTiles();
    hydrate(field);
  }
  const mod = (a, n) => ((a % n) + n) % n;
  function placeTiles() {
    ex.nodes.forEach((n, i) => {
      const t = ex.tiles[i];
      const x = mod(t.x + ex.ox, ex.W) - ex.cw;
      const y = mod(t.y + ex.oy, ex.H) - ex.ch;
      n.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    });
  }
  function stepExplore() {
    if (!ex.built || root.dataset.view !== 'explore') return;
    if (!ex.drag) {
      ex.vx *= 0.93; ex.vy *= 0.93;
      if (Math.abs(ex.vx) < 0.02 && Math.abs(ex.vy) < 0.02) { ex.vx = 0; ex.vy = 0; }
      ex.ox += ex.vx - 0.15; // 아주 느린 자동 흐름
      ex.oy += ex.vy;
    }
    placeTiles();
  }
  if (exploreEl) {
    exploreEl.addEventListener('pointerdown', e => {
      e.preventDefault();
      ex.drag = { x: e.clientX, y: e.clientY };
      ex.moved = 0;
      ex.vx = ex.vy = 0;
    });
    addEventListener('pointermove', e => {
      if (!ex.drag) return;
      const dx = e.clientX - ex.drag.x, dy = e.clientY - ex.drag.y;
      ex.drag = { x: e.clientX, y: e.clientY };
      ex.ox += dx; ex.oy += dy;
      ex.vx = dx; ex.vy = dy;
      ex.moved += Math.abs(dx) + Math.abs(dy);
    });
    addEventListener('pointerup', () => { ex.drag = null; });
    exploreEl.addEventListener('wheel', e => {
      e.preventDefault();
      ex.vx -= e.deltaX * 0.08;
      ex.vy -= e.deltaY * 0.08;
    }, { passive: false });
    // 드래그 후 놓을 때는 링크 이동 막기
    document.addEventListener('click', e => {
      if (ex.moved > 6 && e.target.closest('.tile')) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }

  function setView(v) {
    root.dataset.view = v;
    if (v === 'explore' && !ex.built) buildExplore();
    if (v === 'archive') requestAnimationFrame(measureChars);
  }
  $$('button[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  addEventListener('keydown', e => { if (e.key === 'Escape' && root.dataset.view === 'explore') setView('archive'); });

  /* ------------------------------------------------------------
     Intro lens: 거친 흑백 픽셀 이미지 위로, 커서가 닿는 칸만
     촘촘한 컬러 픽셀로 해상된다 (지나간 자리는 천천히 되돌아감)
     ------------------------------------------------------------ */
  const lens = $('#lens');
  const L = { cells: new Map(), coarse: null, mid: null, fine: null, img: null, block: 22, from: 0, t0: 0, idx: 0, pinned: false, visible: true, W: 0, H: 0, hover: false, mx: 0, my: 0 };
  let LENS_P = [];
  const LC = 22, LM = 9, LF = 4; // coarse / mid / fine 블록 크기(px)

  function lensLayer(size, gray) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(L.W / size));
    c.height = Math.max(1, Math.ceil(L.H / size));
    const x = c.getContext('2d');
    if (gray) x.filter = 'grayscale(1) contrast(1.15)';
    drawCover(x, L.img, c.width, c.height);
    return c;
  }
  function lensBuild() {
    if (!L.img || !L.img.naturalWidth) return;
    const r = lens.parentElement.getBoundingClientRect();
    L.W = r.width; L.H = r.height;
    if (!L.W || !L.H) return;
    lens.width = L.W * dpr; lens.height = L.H * dpr;
    L.mid = lensLayer(LM, false);
    L.fine = lensLayer(LF, false);
    L.coarse = lensLayer(LC, true);
  }
  function lensShow(i) {
    L.idx = i;
    const p = LENS_P[i];
    $$('#intro-list li').forEach((li, k) => li.classList.toggle('on', k === i));
    $('#lens-cap').innerHTML = `${p.no} / ${esc(p.title)}<br><span class="mute">${esc([p.client, p.year].filter(Boolean).join(' — '))}</span>`;
    $('#lens-link').href = `project.html?p=${p.id}`;
    const img = new Image();
    img.onload = () => { L.img = img; lensBuild(); L.t0 = performance.now(); };
    img.src = previewSrc(p);
  }
  function lensDraw(now) {
    if (!L.coarse || !L.visible) return;
    const ctx = lens.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    // 이미지 전환: 큰 블록에서 기본 블록으로 내려옴
    const k = Math.min(1, (now - L.t0) / 600);
    const block = Math.round(LC + (1 - k * k * (3 - 2 * k)) * 70);
    const base = block === LC ? L.coarse : lensLayer(block, true);
    ctx.clearRect(0, 0, L.W, L.H);
    ctx.drawImage(base, 0, 0, base.width * block, base.height * block);

    // 커서(또는 자동으로 떠도는 점) 주변 칸을 활성화
    let px = L.mx, py = L.my, rad = 3.2;
    if (!L.hover) {
      const t = now / 1000;
      px = L.W * (0.5 + 0.36 * Math.sin(t * 0.43)); py = L.H * (0.5 + 0.34 * Math.sin(t * 0.71 + 1)); rad = 2.2;
    }
    const cx = Math.floor(px / LC), cy = Math.floor(py / LC), R = Math.ceil(rad);
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
      const d = Math.hypot(x, y) / rad;
      if (d > 1) continue;
      const key = `${cx + x},${cy + y}`;
      L.cells.set(key, Math.max(L.cells.get(key) || 0, 1 - d * 0.55));
    }
    const pathFine = new Path2D(), pathMid = new Path2D();
    for (const [key, life] of L.cells) {
      const [x, y] = key.split(',').map(Number);
      (life > 0.55 ? pathFine : pathMid).rect(x * LC, y * LC, LC, LC);
      const nl = life - 0.012;
      nl <= 0 ? L.cells.delete(key) : L.cells.set(key, nl);
    }
    if (block === LC) {
      ctx.save(); ctx.clip(pathMid);
      ctx.drawImage(L.mid, 0, 0, L.mid.width * LM, L.mid.height * LM);
      ctx.restore();
      ctx.save(); ctx.clip(pathFine);
      ctx.drawImage(L.fine, 0, 0, L.fine.width * LF, L.fine.height * LF);
      ctx.restore();
    }
  }
  function renderIntroList() {
    const chosen = P.filter(p => (SITE.featured || []).includes(p.id));
    LENS_P = (chosen.length ? chosen : P).slice(0, 6);
    $('#intro-count').textContent = `${pad2(P.length)} Projects`;
    const years = P.map(p => parseInt(p.year, 10)).filter(Boolean);
    if (years.length) $('#intro-years').textContent = `${Math.min(...years)} — ${Math.max(...years)}`;
    $('#intro-list').innerHTML = LENS_P.map((p, i) =>
      `<li><a href="project.html?p=${p.id}" data-wipe data-i="${i}"><span>${p.no}</span><span data-decode>${esc(p.title)}</span><span class="y">${p.year}</span></a></li>`).join('');
  }
  if (lens && P.length) {
    renderIntroList();
    $('#intro-list').addEventListener('mouseover', e => {
      const a = e.target.closest('[data-i]');
      if (a && +a.dataset.i !== L.idx) { L.pinned = true; lensShow(+a.dataset.i); }
    });
    $('#intro-list').addEventListener('mouseleave', () => { L.pinned = false; });
    lens.parentElement.addEventListener('mousemove', e => {
      const r = lens.getBoundingClientRect();
      L.mx = e.clientX - r.left; L.my = e.clientY - r.top; L.hover = true;
    });
    lens.parentElement.addEventListener('mouseleave', () => { L.hover = false; });
    new IntersectionObserver(([en]) => { L.visible = en.isIntersecting; }).observe(lens);
    addEventListener('resize', lensBuild);
    // 5초마다 다음 프로젝트로 (리스트에 올려둔 동안은 멈춤)
    setInterval(() => { if (!L.pinned && !L.hover && L.visible) lensShow((L.idx + 1) % LENS_P.length); }, 5000);
    if (tag) document.body.classList.add('is-filtered');
    lensShow(0);
  }

  /* ------------------------------------------------------------
     Index (searchsystem index 형식)
     ------------------------------------------------------------ */
  function renderIndex() {
    const el = $('#idx');
    if (!el) return;
    const uniq = arr => [...new Set(arr)];
    const matches = t => P.filter(p => tagsOf(p).some(x => slug(x) === slug(t)));
    // 작은 썸네일 줄: 무엇에 관한 항목인지 바로 알아볼 수 있게
    // 썸네일마다 자기 이미지로 미리보기 (줄 전체의 대표 이미지가 아니라)
    const thumbs = srcs => `<div class="thumbs">${srcs.slice(0, 5).map(s =>
      media(s, '4/3', '', 'hoverable')
        .replace('<div class="media', `<div data-preview="${s}" class="media`)).join('')}${srcs.length > 5 ? `<span class="more">+${srcs.length - 5}</span>` : ''}</div>`;
    const row = (href, label, n, srcs, extra = '') =>
      `<li><a class="ir" href="${href}" data-wipe ${extra}><span class="lbl"><span data-decode>${esc(label)}</span>${n ? ` <span class="n">${n}</span>` : ''}</span>${thumbs(srcs)}</a></li>`;
    const tagList = list => list.filter(Boolean).map(t => { // 클라이언트·연도가 빈 프로젝트는 빈 줄을 만들지 않게
      const ps = matches(t);
      return row(`index.html?tag=${encodeURIComponent(t)}`, t, ps.length, ps.map(previewSrc).filter(Boolean));
    }).join('');
    const groups = [
      ['Projects', P.map(p => row(`project.html?p=${p.id}`, p.title, '', p.picks.map(f => srcOf(p, f)),
        `data-preview="${previewSrc(p)}"`)).join('')],
      ['Clients', tagList(uniq(P.map(p => p.client)).sort())],
      ['Disciplines', tagList(uniq(P.flatMap(p => split(p.type))).sort())],
      ['Roles', tagList(uniq(P.flatMap(p => split(p.role))).sort())],
      ['Collaborators', tagList(uniq(P.flatMap(people)).sort())],
      ['Years', tagList(uniq(P.map(p => p.year)).sort().reverse())]
    ];
    el.innerHTML = groups.filter(([, list]) => list).map(([h, list]) =>
      `<section class="idx-group"><h2>${h}</h2><ul>${list}</ul></section>`).join('');
  }

  /* ------------------------------------------------------------
     Project detail
     ------------------------------------------------------------ */
  const COL = { l: () => 1, c: n => Math.floor((12 - n) / 2) + 1, r: n => 13 - n }; // 왼쪽·가운데·오른쪽 → 시작 컬럼

  function renderProject(id) {
    const el = $('#project');
    if (!el) return;
    if (!P.length) { el.innerHTML = '<p class="p-empty grid"><span>No projects yet</span></p>'; return; }
    id = id || params.get('p');
    const i = Math.max(0, P.findIndex(p => p.id === id));
    const p = P[i];
    const next = P[(i + 1) % P.length];
    document.title = `${p.title} — ${SITE.name}`;
    const tagLink = t => `<a class="u" href="index.html?tag=${encodeURIComponent(t)}" data-wipe>${esc(t)}</a>`;
    const meta = [
      ['Client', p.client ? tagLink(p.client) : ''],
      ['Year', p.year ? tagLink(p.year) : ''],
      ['Discipline', split(p.type).map(tagLink).join(', ')],
      ['Role', esc(p.role)]
    ];

    // 갤러리: 섹션을 만날 때마다 새 묶음 (섹션 제목·글 → 그 아래 사진들)
    const groups = [{ sec: null, imgs: [] }];
    p.blocks.forEach((b, k) => {
      if (b.t === 'sec') groups.push({ sec: b, k, imgs: [] });
      else if (!b.hide) groups[groups.length - 1].imgs.push(b);
    });
    let fig = 0;
    const video = b => `<div class="media is-video" style="aspect-ratio:${ratioOf(p, b.file)}"><video src="${srcOf(p, b.file)}" muted loop playsinline autoplay preload="metadata" aria-label="${esc([p.title, b.cap].filter(Boolean).join(' — '))}"></video></div>`;
    const figure = b => `<figure style="grid-column:${(COL[b.pos] || COL.l)(b.span)} / span ${b.span}" data-key="f:${esc(b.file)}">
          ${isVid(b.file) ? video(b) : media(srcOf(p, b.file), ratioOf(p, b.file), [p.title, b.cap].filter(Boolean).join(' — '), 'hoverable')}
          <figcaption><span>Fig. ${pad2(++fig)}</span><span class="mute">${esc(b.cap)}</span></figcaption>
        </figure>`;
    const section = g => {
      if (!g.sec) return '';
      const lab = [g.sec.title && `(${esc(g.sec.title)})`, g.sec.sub && `<span class="mute">${esc(g.sec.sub)}</span>`].filter(Boolean).join('<br>');
      return `<section class="p-sec grid" data-key="s:${g.k}">
        ${lab ? `<p class="lab">${lab}</p>` : ''}
        ${g.sec.text ? `<p class="txt sans">${esc(g.sec.text)}</p>` : ''}
      </section>`;
    };
    const gallery = groups.map(g => section(g) +
      (g.imgs.length ? `<section class="p-gallery grid">${g.imgs.map(figure).join('')}</section>` : '')).join('');
    const info = [['Period', p.date], ['Location', p.location]].filter(([, v]) => v)
      .map(([k, v]) => `<li class="k"><span class="mute">${k}</span><br>${esc(v)}</li>`).join('');

    el.innerHTML = `
      <section class="p-head grid">
        <a class="p-back u" href="index.html" data-wipe>← Archive</a>
        <span class="p-count">Project ${p.no} / ${pad2(P.length)}</span>
        <h1 class="p-title sans" data-texture>${esc(p.title)}</h1>
      </section>
      <dl class="p-meta grid">${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${v || '—'}</dd></div>`).join('')}</dl>
      ${p.hero ? media(previewSrc(p), '16/9', p.title, 'p-hero hoverable').replace('<div class="media', `<div data-key="f:${esc(p.hero)}" class="media`) : ''}
      ${p.lead ? `<section class="p-intro grid" data-key="lead">
        <p class="lab">(Overview)</p>
        <p class="lead sans">${esc(p.lead)}</p>
      </section>` : ''}
      ${gallery}
      ${p.body.length || info || p.credits.length ? `<section class="p-body grid" data-key="body">
        <p class="lab">${p.body.length ? '(Process)' : '(Info)'}</p>
        <div class="txt sans">${p.body.map(t => `<p>${esc(t)}</p>`).join('')}</div>
        <ul class="credits">${info}${p.credits.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
      </section>` : ''}
      <a class="p-next" href="project.html?p=${next.id}" data-wipe data-cursor="Next" data-preview="${previewSrc(next)}">
        <span class="row"><span>Next project</span><span>${next.no} / ${pad2(P.length)}</span></span>
        <span class="nt sans" data-texture>${esc(next.title)} →</span>
      </a>`;
  }

  /* ------------------------------------------------------------
     Controls: + / − 확대·축소, ● 배경색
     - Archive: 한 줄 썸네일 개수 / Explore: 썸네일 크기 / 그 외: 글자 크기
     ------------------------------------------------------------ */
  const THEMES = ['Paper', 'Ink', 'Concrete', 'Bone'];
  const TEXT_SCALE = [0.85, 0.92, 1, 1.12, 1.25];
  let theme = (parseInt(root.dataset.t, 10) || 0) % THEMES.length;
  let zoom = Math.min(5, Math.max(1, parseInt(store.get('pf-zoom'), 10) || 3));
  const themeBtn = $('[data-act="theme"]');

  function applyTheme() {
    root.dataset.t = theme;
    store.set('pf-theme', theme);
    themeBtn.title = `Background: ${THEMES[theme]} → ${THEMES[(theme + 1) % THEMES.length]}`;
  }
  function applyZoom() {
    store.set('pf-zoom', zoom);
    $('[data-act="plus"]').disabled = zoom === 5;
    $('[data-act="minus"]').disabled = zoom === 1;
    if (page === 'archive') {
      renderArchive(true);
      if (ex.built) buildExplore();
    } else {
      root.style.setProperty('--scale', TEXT_SCALE[zoom - 1]);
    }
    requestAnimationFrame(measureChars);
  }
  $('.tools').addEventListener('click', e => {
    const act = e.target.closest('button')?.dataset.act;
    if (act === 'theme') { theme = (theme + 1) % THEMES.length; applyTheme(); }
    if (act === 'plus' && zoom < 5) { zoom++; applyZoom(); }
    if (act === 'minus' && zoom > 1) { zoom--; applyZoom(); }
  });

  /* ------------------------------------------------------------
     Pixelate: 이미지를 큰 블록 → 작은 블록으로 해상
     ------------------------------------------------------------ */
  const STEPS = [48, 32, 22, 14, 9, 5, 3];
  function drawCover(ctx, img, w, h) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const r = w / h;
    let sw = iw, sh = ih, sx = 0, sy = 0;
    if (iw / ih > r) { sw = ih * r; sx = (iw - sw) / 2; } else { sh = iw / r; sy = (ih - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  }
  function pixelate(m, gray, done) {
    const img = $('img', m), cv = $('canvas', m);
    const id = (m._pid = (m._pid || 0) + 1);
    const { width: W, height: H } = m.getBoundingClientRect();
    if (reduced || !img.naturalWidth || !W || !H) { done && done(); return; }
    const ctx = cv.getContext('2d');
    const steps = STEPS.filter(s => s < Math.max(W, H) / 3);
    let i = 0;
    const step = () => {
      if (m._pid !== id) return;
      if (i >= steps.length) { cv.classList.remove('on'); done && done(); return; }
      const s = steps[i++];
      cv.width = Math.max(1, Math.ceil(W / s));
      cv.height = Math.max(1, Math.ceil(H / s));
      if (gray) ctx.filter = 'grayscale(1) contrast(1.06)';
      drawCover(ctx, img, cv.width, cv.height);
      cv.classList.add('on');
      setTimeout(step, 50);
    };
    step();
  }
  const whenLoaded = (img, fn) => (img.complete && img.naturalWidth) ? fn() : img.addEventListener('load', fn, { once: true });

  // 화면에 들어오면 픽셀 해상: 기본은 모노톤, 상세 페이지(#project)는 최종 결과물이라 처음부터 컬러
  const revealed = new Set();
  const inColor = m => !!m.closest('#project');
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const m = en.target;
      io.unobserve(m);
      whenLoaded($('img', m), () => {
        m.classList.add('is-in');
        const color = inColor(m);
        if (color) m.classList.add('is-color');
        const key = $('img', m).getAttribute('src');
        if (PREVIEW && revealed.has(key)) return; // 미리보기에서 다시 그릴 때마다 해상이 반복되지 않게
        revealed.add(key);
        pixelate(m, !color);
      });
    });
  }, { rootMargin: '0px 0px -5% 0px' });

  // hover 시 컬러 (이벤트 위임 — 다시 그려진 요소에도 동작)
  if (canHover) {
    document.addEventListener('mouseover', e => {
      const m = e.target.closest('.media.hoverable');
      if (!m || m.contains(e.relatedTarget) || !m.classList.contains('is-in') || inColor(m)) return;
      m.classList.add('is-color');
      pixelate(m, false);
    });
    document.addEventListener('mouseout', e => {
      const m = e.target.closest('.media.hoverable');
      if (!m || m.contains(e.relatedTarget) || inColor(m)) return;
      m._pid = (m._pid || 0) + 1;
      $('canvas', m).classList.remove('on');
      m.classList.remove('is-color');
    });
  }

  /* ------------------------------------------------------------
     Floating preview (index 목록, 다음 프로젝트)
     ------------------------------------------------------------ */
  const pv = $('.preview');
  const pvMedia = pv && $('.media', pv);
  const pvImg = pv && $('img', pv);
  const pvPos = { x: mouse.x, y: mouse.y };
  if (pv && canHover) {
    // 가장 안쪽의 [data-preview] 기준: 줄 → 썸네일 → 다시 줄로 옮겨도 그때그때 바뀜
    let pvCur = null;
    document.addEventListener('mouseover', e => {
      const el = e.target.closest('[data-preview]');
      if (!el || el === pvCur) return;
      pvCur = el;
      pv.classList.add('on');
      if (pvImg.getAttribute('src') !== el.dataset.preview) pvImg.src = el.dataset.preview;
      whenLoaded(pvImg, () => { if (pvCur === el) pixelate(pvMedia, false); });
    });
    document.addEventListener('mouseout', e => {
      if (e.target.closest('[data-preview]') && !e.relatedTarget?.closest?.('[data-preview]')) {
        pvCur = null;
        pv.classList.remove('on');
      }
    });
  }

  /* ------------------------------------------------------------
     Text texture: 커서 근처 글자를 픽셀 글리프로 치환
     ------------------------------------------------------------ */
  const RAMP = '█▓▒░#%+=:·';
  let chars = [];
  const active = new Set();
  const textureOn = canHover && !reduced;
  function splitText(el) {
    if (el.dataset.split) return;
    el.dataset.split = '1';
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      const frag = document.createDocumentFragment();
      for (const ch of n.textContent) {
        if (/\s/.test(ch)) { frag.appendChild(document.createTextNode(ch)); continue; }
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = ch;
        frag.appendChild(s);
        chars.push({ el: s, x: 0, y: 0, until: 0 });
      }
      n.replaceWith(frag);
    });
  }
  function measureChars() {
    chars = chars.filter(c => c.el.isConnected);
    const sx = scrollX, sy = scrollY;
    chars.forEach(c => {
      const r = c.el.getBoundingClientRect();
      c.x = r.left + r.width / 2 + sx;
      c.y = r.top + r.height / 2 + sy;
      c.w = r.width;
    });
  }
  function scanTexture(now) {
    const R = 90;
    const mx = mouse.x + scrollX, my = mouse.y + scrollY;
    for (const c of chars) {
      const dx = c.x - mx, dy = c.y - my;
      if (Math.abs(dx) > R || Math.abs(dy) > R || !c.w) continue;
      const d = Math.hypot(dx, dy) / R;
      if (d > 1 || Math.random() > 1.1 - d) continue;
      setGlyph(c, d);
      c.until = now + 150 + Math.random() * 450;
      active.add(c);
    }
  }
  function setGlyph(c, d) {
    const k = Math.min(RAMP.length - 1, Math.floor((d * 0.8 + Math.random() * 0.4) * RAMP.length));
    c.el.dataset.g = RAMP[k];
    c.el.classList.add('tx');
    c.el.classList.toggle('inv', d < 0.35 && Math.random() < 0.35);
  }
  function tickTexture(now) {
    for (const c of active) {
      if (now > c.until || !c.el.isConnected) { c.el.classList.remove('tx', 'inv'); active.delete(c); }
      else if (Math.random() < 0.15) setGlyph(c, Math.random());
    }
  }

  // 새로 그려진 영역: 이미지 관찰 + 텍스트 분해
  /* ------------------------------------------------------------
     Decode: 작은 글씨는 hover 순간에만 잠깐 흐트러졌다가
     왼쪽부터 원래 글자로 복원 (평소엔 항상 읽을 수 있음)
     ------------------------------------------------------------ */
  const NOISE = '#%+=:*/<>_';
  function decode(el) {
    const text = el.dataset.text ?? (el.dataset.text = el.textContent);
    const id = (el._did = (el._did || 0) + 1);
    const t0 = performance.now(), dur = 160 + text.length * 9;
    const step = now => {
      if (el._did !== id) return;
      const k = Math.min(1, (now - t0) / dur);
      const done = Math.floor(k * text.length);
      el.textContent = [...text].map((c, i) =>
        i < done || c === ' ' ? c : NOISE[(Math.random() * NOISE.length) | 0]).join('');
      if (k < 1) requestAnimationFrame(step); else el.textContent = text;
    };
    requestAnimationFrame(step);
  }
  if (canHover && !reduced) {
    document.addEventListener('mouseover', e => {
      const host = e.target.closest('a, .item');
      if (!host || host.contains(e.relatedTarget)) return;
      (host.matches('[data-decode]') ? [host] : $$('[data-decode]', host)).forEach(decode);
    });
  }

  function hydrate(scope) {
    $$('.media.hoverable', scope).forEach(m => io.observe(m));
    if (textureOn) {
      $$('[data-texture]', scope).forEach(splitText);
      requestAnimationFrame(measureChars);
    }
  }

  /* ------------------------------------------------------------
     Pixel trail: 커서가 지나간 자리에 픽셀 블록이 남았다 사라짐
     ------------------------------------------------------------ */
  const trail = $('#trail');
  const tctx = trail.getContext('2d');
  const CELL = 14;
  const cells = new Map();
  function sizeCanvas(c) {
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function addTrail(x, y) {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    cells.set(`${cx},${cy}`, 1);
    for (let i = 0; i < 3; i++) {
      if (Math.random() < 0.2) {
        const k = `${cx + Math.round(Math.random() * 4 - 2)},${cy + Math.round(Math.random() * 4 - 2)}`;
        cells.set(k, Math.max(cells.get(k) || 0, 0.4));
      }
    }
  }
  function drawTrail() {
    tctx.clearRect(0, 0, innerWidth, innerHeight);
    tctx.fillStyle = '#fff';
    for (const [k, life] of cells) {
      const [cx, cy] = k.split(',').map(Number);
      tctx.globalAlpha = Math.ceil(life * 4) / 4; // 계단식 알파 = 픽셀 느낌
      tctx.fillRect(cx * CELL, cy * CELL, CELL, CELL);
      const nl = life - 0.055; // 짧게 남았다 사라짐 → 작은 글씨를 오래 가리지 않음
      nl <= 0 ? cells.delete(k) : cells.set(k, nl);
    }
    tctx.globalAlpha = 1;
  }
  if (textureOn) sizeCanvas(trail);

  /* ------------------------------------------------------------
     Cursor + main loop
     ------------------------------------------------------------ */
  const cur = $('.cursor');
  const curLabel = $('.cursor-label');
  const curPos = { x: mouse.x, y: mouse.y };
  const coords = $('#coords');
  const pad4 = n => String(Math.max(0, Math.round(n))).padStart(4, '0');

  if (canHover) {
    addEventListener('mousemove', e => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.dirty = true;
    }, { passive: true });
    addEventListener('scroll', () => { mouse.dirty = true; }, { passive: true });
    document.addEventListener('mouseover', e => {
      const t = e.target.closest('a, button, [data-cursor]');
      cur.classList.toggle('big', !!t);
      curLabel.textContent = t?.dataset.cursor || (t?.closest('[data-cursor]')?.dataset.cursor) || '';
    });
    document.addEventListener('mouseleave', () => { cur.style.opacity = 0; });
    document.addEventListener('mouseenter', () => { cur.style.opacity = 1; });
  }

  function loop(now) {
    stepExplore();
    lensDraw(now);
    if (canHover) {
      curPos.x += (mouse.x - curPos.x) * 0.4;
      curPos.y += (mouse.y - curPos.y) * 0.4;
      cur.style.transform = `translate3d(${curPos.x}px, ${curPos.y}px, 0)`;

      if (pv) {
        pvPos.x += (mouse.x - pvPos.x) * 0.16;
        pvPos.y += (mouse.y - pvPos.y) * 0.16;
        const w = pv.offsetWidth, h = pv.offsetHeight;
        const x = pvPos.x + 28 + w > innerWidth ? pvPos.x - w - 28 : pvPos.x + 28;
        const y = Math.min(Math.max(pvPos.y - h / 2, 48), innerHeight - h - 16);
        pv.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }

      if (mouse.dirty && !reduced) {
        if (mouse.lx !== null) {
          const dist = Math.hypot(mouse.x - mouse.lx, mouse.y - mouse.ly);
          const n = Math.max(1, Math.ceil(dist / (CELL * 0.7)));
          for (let i = 1; i <= n; i++) {
            addTrail(mouse.lx + (mouse.x - mouse.lx) * i / n, mouse.ly + (mouse.y - mouse.ly) * i / n);
          }
        }
        mouse.lx = mouse.x;
        mouse.ly = mouse.y;
        scanTexture(now);
        if (coords) coords.textContent = `X ${pad4(mouse.x)} Y ${pad4(mouse.y + scrollY)}`;
        mouse.dirty = false;
      }
      if (!reduced) { drawTrail(); tickTexture(now); }
    }
    requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------
     Page wipe: 랜덤 픽셀 디졸브로 페이지 전환
     ------------------------------------------------------------ */
  const wipe = $('#wipe');
  const wctx = wipe.getContext('2d');
  const WC = 44;
  function runWipe(fill, done) {
    sizeCanvas(wipe);
    const cols = Math.ceil(innerWidth / WC), rows = Math.ceil(innerHeight / WC);
    const list = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) list.push([x, y]);
    for (let i = list.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [list[i], list[j]] = [list[j], list[i]]; }
    wctx.fillStyle = fg();
    if (!fill) wctx.fillRect(0, 0, innerWidth, innerHeight);
    wipe.classList.add('ready');
    const dur = 480, t0 = performance.now();
    let n = 0;
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur);
      const target = Math.floor(k * k * (3 - 2 * k) * list.length);
      for (; n < target; n++) {
        const [x, y] = list[n];
        fill ? wctx.fillRect(x * WC, y * WC, WC + 1, WC + 1) : wctx.clearRect(x * WC, y * WC, WC, WC);
      }
      k < 1 ? requestAnimationFrame(tick) : done && done();
    };
    requestAnimationFrame(tick);
  }
  function clearWipe() {
    wipe.classList.add('ready');
    wctx.clearRect(0, 0, wipe.width, wipe.height);
    wipe.style.pointerEvents = 'none';
  }
  addEventListener('pageshow', e => { if (e.persisted) clearWipe(); });
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-wipe]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (reduced) { location.href = a.href; return; }
    wipe.style.pointerEvents = 'auto';
    runWipe(true, () => { location.href = a.href; });
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-top]')) { e.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }); }
  });

  /* ------------------------------------------------------------
     Clock (Seoul)
     ------------------------------------------------------------ */
  const clock = $('#clock');
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const tickClock = () => { if (clock) clock.textContent = fmt.format(new Date()); };
  tickClock();
  setInterval(tickClock, 1000);

  /* ------------------------------------------------------------
     Boot
     ------------------------------------------------------------ */
  renderIndex();
  renderProject();
  applyTheme();
  applyZoom(); // archive 페이지는 여기서 처음 그려짐
  if (page === 'archive') setView('archive');
  hydrate(document);
  if (textureOn) {
    document.fonts && document.fonts.ready.then(measureChars);
    addEventListener('load', measureChars);
  }
  addEventListener('resize', () => {
    if (textureOn) sizeCanvas(trail);
    renderArchive();
    if (ex.built) buildExplore();
    measureChars();
  });
  if (reduced || PREVIEW) clearWipe(); else runWipe(false, clearWipe);

  /* ------------------------------------------------------------
     Builder preview (builder/ 의 iframe): 편집 중인 데이터를 받아 바로 다시 그림
     ------------------------------------------------------------ */
  if (PREVIEW) {
    document.addEventListener('click', e => {
      if (e.target.closest('a')) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    addEventListener('message', e => {
      if (e.origin !== location.origin || !e.data) return;
      const d = e.data;
      if (d.type === 'pf-data') {
        if (d.site) Object.assign(SITE, d.site);
        P = d.projects.map(prep);
        renderSiteText();
        if (lens && P.length) { renderIntroList(); lensShow(Math.min(L.idx, LENS_P.length - 1)); }
        renderProject(d.id);
        hydrate(document);
        if (d.top) scrollTo(0, 0);
      }
      if (d.type === 'pf-scroll') {
        const t = $$('[data-key]').find(n => n.dataset.key === d.key);
        if (t) t.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
    parent.postMessage({ type: 'pf-ready' }, location.origin);
  }
  requestAnimationFrame(loop);
})();
