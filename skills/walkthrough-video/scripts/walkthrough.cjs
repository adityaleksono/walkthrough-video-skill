// Recording helper for narrated walkthrough videos.
//
// Drives a web app with Playwright and records it. A cursor, a highlight ring, a step label,
// subtitles and optional cards are drawn inside the page, so they land in the recording.
// Each scene is held for at least as long as its voice clip, and the scene start times are
// written to timeline.json so mux.py can lay the clips over the video.
//
// Use it from a short recording script of your own (see record.example.cjs):
//
//   const wt = require('./walkthrough.cjs');
//   wt.record({ playwrightFrom, out, scenes, baseURL, login }, async ({ page, scene, ring, clickAt }) => {
//     await scene('01', async () => { ... });
//   });

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

// Find Playwright in the project being recorded, so the skill needs no install of its own.
function loadPlaywright(fromDir) {
  const dirs = [fromDir, process.cwd(), __dirname].filter(Boolean);
  for (const dir of dirs) {
    const req = createRequire(path.join(path.resolve(dir), 'package.json'));
    for (const name of ['playwright', '@playwright/test', 'playwright-core']) {
      try {
        const mod = req(name);
        if (mod && mod.chromium) return mod;
      } catch (_) {
        /* try the next one */
      }
    }
  }
  throw new Error(
    'Playwright not found. Pass playwrightFrom: <a folder whose node_modules has playwright>, or run `npm i -D playwright && npx playwright install chromium`.',
  );
}

// Runs in the page. Kept as a string so it can be an init script (it must survive navigation).
const overlaySource = (opts) => `
(() => {
  const O = ${JSON.stringify(opts)};
  const boot = () => {
    if (window.__wt || !document.body) return;
    const css = document.createElement('style');
    css.textContent = \`
      \${O.hide ? O.hide + '{display:none!important}' : ''}
      #wt-cursor{position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;transition:transform .7s cubic-bezier(.4,0,.2,1);transform:translate(\${O.cx}px,\${O.cy}px)}
      #wt-cursor svg{transition:transform .12s}
      #wt-cursor.click svg{transform:scale(.82)}
      #wt-ring{position:fixed;z-index:2147483646;pointer-events:none;border:3px solid \${O.accent};border-radius:12px;box-shadow:0 0 0 4px \${O.accent}40,0 0 18px \${O.accent}73;opacity:0;transition:opacity .25s ease}
      #wt-sub{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:2147483646;pointer-events:none;background:rgba(24,26,32,.93);color:#fff;font:600 19px/1.35 \${O.font};padding:11px 22px;border-radius:10px;max-width:70vw;text-align:center;opacity:0;transition:opacity .2s ease}
      #wt-step{position:fixed;left:20px;bottom:34px;z-index:2147483646;pointer-events:none;background:\${O.brand};color:#fff;font:600 14px/1 \${O.font};padding:11px 16px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.18);opacity:0;transition:opacity .2s ease}
      #wt-card{position:fixed;inset:0;z-index:2147483645;pointer-events:none;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.88);opacity:0;transition:opacity .45s ease;font-family:\${O.font};color:#1a1b1e}
      #wt-card .t{font-size:40px;font-weight:700;text-align:center}
      #wt-card .s{margin-top:10px;font-size:20px;color:#495057;text-align:center}
      #wt-card .cmp{display:flex;gap:36px;align-items:stretch}
      #wt-card .col{min-width:400px;max-width:520px;background:#fff;border:1px solid #dee2e6;border-radius:18px;padding:28px 34px;box-shadow:0 12px 32px -14px rgba(0,0,0,.3)}
      #wt-card .col h3{margin:0 0 16px;font-size:17px;letter-spacing:.6px;text-transform:uppercase;color:#868e96}
      #wt-card .col.after h3{color:\${O.brand}}
      #wt-card .col li{font-size:24px;line-height:1.55;list-style:none;margin:0;padding:0}
      #wt-card .col ul{margin:0;padding:0}
      #wt-card .col li.gone{text-decoration:line-through;color:#adb5bd}
      #wt-card .col li.new{font-weight:700;color:\${O.brand}}
    \`;
    document.head.appendChild(css);
    const mk = (id, html) => { const d = document.createElement('div'); d.id = id; d.innerHTML = html || ''; document.body.appendChild(d); return d; };
    mk('wt-cursor', '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.5 14.8 L11.6 21.5 L14.4 20.3 L11.3 13.7 L17.5 13.7 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>');
    mk('wt-ring'); mk('wt-sub'); mk('wt-step'); mk('wt-card');
    let target = null;
    const loop = () => {
      const ring = document.getElementById('wt-ring');
      if (ring) {
        if (target && target.isConnected) {
          const r = target.getBoundingClientRect(), p = 6;
          Object.assign(ring.style, { left: r.left - p + 'px', top: r.top - p + 'px', width: r.width + 2 * p + 'px', height: r.height + 2 * p + 'px', opacity: 1 });
        } else ring.style.opacity = 0;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const text = (id, t) => { const s = document.getElementById(id); if (t) { s.textContent = t; s.style.opacity = 1; } else s.style.opacity = 0; };
    const list = (cls, title, items) => '<div class="col ' + cls + '"><h3>' + esc(title) + '</h3><ul>' +
      items.map((i) => typeof i === 'string' ? '<li>' + esc(i) + '</li>' : '<li class="' + esc(i.mark || '') + '">' + esc(i.text) + '</li>').join('') + '</ul></div>';
    window.__wt = {
      ring(el) { target = el || null; },
      sub(t) { text('wt-sub', t); },
      step(t) { text('wt-step', t); },
      move(x, y) { document.getElementById('wt-cursor').style.transform = 'translate(' + x + 'px,' + y + 'px)'; },
      press() { const c = document.getElementById('wt-cursor'); c.classList.add('click'); setTimeout(() => c.classList.remove('click'), 160); },
      card(c) {
        const el = document.getElementById('wt-card');
        if (!c) { el.style.opacity = 0; return; }
        el.innerHTML = c.before
          ? '<div class="cmp">' + list('before', c.before.title || 'Before', c.before.items || []) + list('after', c.after.title || 'After', c.after.items || []) + '</div>'
          : '<div><div class="t">' + esc(c.title || '') + '</div>' + (c.subtitle ? '<div class="s">' + esc(c.subtitle) + '</div>' : '') + '</div>';
        el.style.opacity = 1;
      },
    };
  };
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
`;

/**
 * Record a walkthrough.
 *
 * opts:
 *   out            folder for raw.webm and timeline.json (required)
 *   scenes         path to durations.json from tts.py, or the array itself (required)
 *   playwrightFrom folder whose node_modules has Playwright (usually the app's repository)
 *   baseURL        e.g. http://localhost:3000
 *   viewport       default { width: 1440, height: 900 }
 *   login          async (page) => {}  runs off camera first; the session is reused for the take
 *   storageState   path to an existing Playwright storage state, instead of login
 *   dry            true = no recording and no waiting for clip lengths; use it to prove the selectors
 *   gap            seconds of silence after each clip (default 0.6)
 *   hide           CSS selector for things that should not be in the video (default: the Next.js dev badge)
 *   accent, brand  colours of the highlight ring and the step label
 *   headless       default true
 *
 * run({ page, scene, ring, moveTo, clickAt, typeInto, step, card, wait, dry })
 */
async function record(opts, run) {
  const { chromium } = loadPlaywright(opts.playwrightFrom);
  const out = path.resolve(opts.out);
  const dry = !!opts.dry;
  const viewport = opts.viewport || { width: 1440, height: 900 };
  const gap = opts.gap == null ? 0.6 : opts.gap;
  const scenes = typeof opts.scenes === 'string' ? JSON.parse(fs.readFileSync(opts.scenes, 'utf8')) : opts.scenes;
  fs.mkdirSync(out, { recursive: true });

  const browser = await chromium.launch({ headless: opts.headless !== false });
  let storageState = opts.storageState;
  try {
    if (opts.login) {
      // Sign in off camera, so the video starts where the story starts.
      const auth = await browser.newContext({ viewport, baseURL: opts.baseURL });
      const p = await auth.newPage();
      await opts.login(p);
      storageState = path.join(out, 'state.json');
      await auth.storageState({ path: storageState });
      await auth.close();
    }

    const ctx = await browser.newContext({
      viewport,
      baseURL: opts.baseURL,
      deviceScaleFactor: 1,
      storageState,
      recordVideo: dry ? undefined : { dir: out, size: viewport },
    });
    await ctx.addInitScript({
      content: overlaySource({
        hide: opts.hide === undefined ? 'nextjs-portal' : opts.hide,
        accent: opts.accent || '#f59f00',
        brand: opts.brand || '#228be6',
        font: opts.font || "Inter,system-ui,-apple-system,'Segoe UI',sans-serif",
        cx: Math.round(viewport.width / 2),
        cy: Math.round(viewport.height / 2),
      }),
    });
    const page = await ctx.newPage();
    const t0 = Date.now();
    const now = () => (Date.now() - t0) / 1000;
    const wait = (ms) => page.waitForTimeout(ms);
    const inPage = (fn, arg) => page.evaluate(fn, arg).catch(() => {});

    // What the overlay shows, kept here too so it can be put back after a navigation.
    const state = { sub: null, step: null, cursor: null };
    page.on('load', () => {
      inPage((s) => {
        if (!window.__wt) return;
        window.__wt.step(s.step);
        window.__wt.sub(s.sub);
        if (s.cursor) window.__wt.move(s.cursor.x, s.cursor.y);
      }, state);
    });
    const setSub = (t) => { state.sub = t || null; return inPage((x) => window.__wt && window.__wt.sub(x), state.sub); };
    const step = (t) => { state.step = t || null; return inPage((x) => window.__wt && window.__wt.step(x), state.step); };
    const card = (c) => inPage((x) => window.__wt && window.__wt.card(x), c || null);

    const centre = async (loc) => {
      loc = loc.first();
      await loc.scrollIntoViewIfNeeded();
      const b = await loc.boundingBox();
      if (!b) throw new Error('element has no box (hidden?)');
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    /** Glide the cursor to an element. */
    const moveTo = async (loc, ms = 800) => {
      const c = await centre(loc);
      state.cursor = { x: c.x - 4, y: c.y - 3 };
      await inPage((p) => window.__wt && window.__wt.move(p.x, p.y), state.cursor);
      await wait(dry ? 50 : ms);
      return c;
    };
    /** Glide to an element, show the click, then really click it. */
    const clickAt = async (loc, after = 500) => {
      await moveTo(loc);
      await inPage(() => window.__wt && window.__wt.press());
      await loc.first().click();
      await wait(dry ? 50 : after);
    };
    /** Glide to a field, click it and type at a readable speed. */
    const typeInto = async (loc, text, after = 400) => {
      await clickAt(loc, 200);
      await loc.first().pressSequentially(text, { delay: dry ? 0 : 55 });
      await wait(dry ? 50 : after);
    };
    /** Put the highlight ring around an element; ring(null) removes it. */
    const ring = (loc) =>
      loc
        ? loc.first().evaluate((el) => window.__wt && window.__wt.ring(el), null, { timeout: 4000 }).catch(() => console.log('  ! no ring target'))
        : inPage(() => window.__wt && window.__wt.ring(null));

    const timeline = [];
    const problems = [];
    /** One narrated scene. Runs the actions, then holds until its voice clip has finished. */
    const scene = async (id, actions) => {
      const s = scenes.find((x) => String(x.id) === String(id));
      if (!s) throw new Error(`scene ${id} is not in the scenes file`);
      const start = now();
      const lines = s.lines && s.lines.length ? s.lines : [s.text];
      const entry = { id: String(s.id), start, duration: s.duration, lines, file: s.file };
      timeline.push(entry);
      // Subtitle lines share the clip by length, so each one is up while it is spoken.
      const total = lines.reduce((a, l) => a + l.length, 0) || 1;
      let acc = 0;
      const timers = dry
        ? []
        : lines.map((l) => {
            const at = (acc / total) * s.duration;
            acc += l.length;
            return setTimeout(() => setSub(l), at * 1000);
          });
      if (dry) await setSub(lines[0]);
      try {
        if (actions) await actions();
      } catch (e) {
        problems.push(`scene ${id}: ${e.message.split('\n')[0]}`);
        if (!dry) throw e;
      }
      const used = now() - start;
      if (!dry) {
        const left = s.duration + gap - used;
        if (left > 0) await wait(left * 1000);
      }
      timers.forEach(clearTimeout);
      entry.end = now();
      entry.actions = Number(used.toFixed(2));
      const over = used - s.duration;
      console.log(`scene ${id}  clip ${s.duration.toFixed(1)}s  actions ${used.toFixed(1)}s${!dry && over > 1.5 ? `  <- ${over.toFixed(1)}s of silence after the voice; shorten the actions or say more` : ''}`);
    };

    await run({ page, scene, ring, moveTo, clickAt, typeInto, step, card, wait, dry, now });

    await setSub(null);
    await wait(dry ? 0 : 800);
    const videoEnd = now();
    fs.writeFileSync(path.join(out, 'timeline.json'), JSON.stringify({ viewport, videoEnd, timeline }, null, 1));
    const video = page.video();
    await ctx.close();
    if (video) {
      const raw = path.join(out, 'raw.webm');
      fs.rmSync(raw, { force: true });
      fs.renameSync(await video.path(), raw);
      console.log('recorded', raw, `${videoEnd.toFixed(1)}s`);
    }
    if (dry) console.log(problems.length ? `dry run: ${problems.length} problem(s)\n  ` + problems.join('\n  ') : 'dry run: every scene ran');
    if (problems.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

module.exports = { record, loadPlaywright };
