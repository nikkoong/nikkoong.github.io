(() => {
"use strict";

/* ── helpers ── */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const clamp = (v,a,b) => Math.min(b, Math.max(a, v));
const esc = s => String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;")
  .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
/* *metric* → <b> after escaping */
const rich = s => esc(s).replace(/\*(.+?)\*/g, "<b>$1</b>");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const MOTION_EXIT_MS = 280;
let zTop = 25;
let cascade = 0;

function hideElement(el, done){
  if (reduce){ el.hidden = true; el.classList.remove("closing"); done?.(); return; }
  el.classList.add("closing");
  let fin = false;
  const finish = () => { if (fin) return; fin = true;
    el.hidden = true; el.classList.remove("closing"); done?.(); };
  el.addEventListener("animationend", finish, { once:true });
  setTimeout(finish, MOTION_EXIT_MS);
}
function flashBusy(btn){  btn.classList.remove("is-running"); void btn.offsetWidth;
  btn.classList.add("is-running");
  btn.addEventListener("animationend", () => btn.classList.remove("is-running"), { once:true });
}

/* ── appearance (light/dark) — initial value applied pre-paint in <head> ── */
const apRoot = document.documentElement;
const apBtn = $("#appearanceToggle");
const AP_META = document.querySelector('meta[name="theme-color"]');
function paintAppearance(){
  const light = apRoot.dataset.appearance === "light";
  apBtn?.setAttribute("aria-pressed", String(light));
  $(".ap-sun", apBtn)?.toggleAttribute("hidden", !light);
  $(".ap-moon", apBtn)?.toggleAttribute("hidden", light);
}
function applyAppearance(mode, persist){
  apRoot.dataset.appearance = mode;
  if (persist){ try { localStorage.setItem("no-appearance", mode); } catch {} }
  if (AP_META) AP_META.content = mode === "light" ? "#eef0f6" : "#0b0a18";
  paintAppearance();
}
apBtn?.addEventListener("click", () =>
  applyAppearance(apRoot.dataset.appearance === "light" ? "dark" : "light", true));
paintAppearance();

/* ── clock ── */
const clockEl = $("#clock");
function tickClock(){
  const d = new Date();
  const wd = d.toLocaleDateString("en-US",{weekday:"short"});
  const mo = d.toLocaleDateString("en-US",{month:"short"});
  clockEl.textContent =
    `${wd} ${d.getDate()} ${mo}  ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
tickClock(); setInterval(tickClock, 15000);

/* ── menu bar dropdowns ── */
const menuWraps = $$(".menu-wrap");
let openMenu = null;

function showMenu(wrap){
  if (openMenu === wrap) return hideMenu();
  if (openMenu) hideMenu(true);
  const dd = $(".dropdown", wrap), btn = $("button", wrap);
  dd.hidden = false;
  /* CSS anchors the menu to its trigger (.dropdown{left:0} inside .menu-wrap).
     Never write viewport coordinates here — it would shift the panel. */
  dd.style.left = "";
  btn.setAttribute("aria-expanded","true");
  openMenu = wrap;
}
function hideMenu(keepFocus){
  if (!openMenu) return;
  const wrap = openMenu; openMenu = null;
  const dd = $(".dropdown", wrap), btn = $("button", wrap);
  btn.setAttribute("aria-expanded","false");
  if (!keepFocus) btn.focus();
  hideElement(dd);
}
menuWraps.forEach(wrap => {
  const btn = $("button", wrap);
  btn.addEventListener("click", e => {
    e.stopPropagation();
    if (openMenu === wrap){ hideMenu(); btn.focus(); }
    else showMenu(wrap);
  });
  btn.addEventListener("pointerenter", () => { if (openMenu && openMenu !== wrap) showMenu(wrap); });
});
$$(".menu-wrap [data-win]").forEach(it =>
  it.addEventListener("click", () => {
    openWin(it.dataset.win, $("button", it.closest(".menu-wrap")));
    hideMenu(true);
  }));
$$(".menu-wrap a.menu-item").forEach(a =>
  a.addEventListener("click", () => hideMenu(true)));
document.addEventListener("click", e => {
  if (openMenu && !e.target.closest(".menu-wrap")) hideMenu(true);
});

/* ── popover panel (activity menu extra) ── */
const popTrigger = $("#popTrigger"), popPanel = $("#popPanel");
let popOpen = false;
function positionPopover(){
  const r = popTrigger.getBoundingClientRect(), w = popPanel.offsetWidth || 340;
  const center = r.left + r.width / 2;
  const left = clamp(center - w * 0.82, 8, innerWidth - w - 8);
  popPanel.style.setProperty("--pop-left", left + "px");
  popPanel.style.setProperty("--notch-x", clamp(center - left, 16, w - 16) + "px");
}
function openPop(){
  popOpen = true; popPanel.hidden = false;
  positionPopover();
  popTrigger.setAttribute("aria-expanded","true");
  $("#tabFeed").focus();
}
function closePop(){
  if (!popOpen) return;
  popOpen = false;
  popTrigger.setAttribute("aria-expanded","false");
  hideElement(popPanel);
}
popTrigger.addEventListener("click", e => {
  e.stopPropagation(); popOpen ? closePop() : openPop();
});
document.addEventListener("click", e => {
  if (popOpen && !popPanel.contains(e.target) && !popTrigger.contains(e.target)) closePop();
});
addEventListener("resize", () => { if (popOpen) positionPopover(); });

/* popover tabs with roving tabindex */
const ptabBtns = [$("#tabFeed"), $("#tabStats")];
function selectTab(i, focus){
  ptabBtns.forEach((b,j) => {
    b.setAttribute("aria-selected", String(i===j));
    b.tabIndex = i===j ? 0 : -1;
    $("#" + b.getAttribute("aria-controls")).hidden = i!==j;
  });
  if (focus) ptabBtns[i].focus();
}
ptabBtns.forEach((b,i) => {
  b.addEventListener("click", () => selectTab(i,false));
  b.addEventListener("keydown", e => {
    const k = e.key; let n = null;
    if (k==="ArrowRight"||k==="ArrowDown") n=(i+1)%2;
    else if (k==="ArrowLeft"||k==="ArrowUp") n=(i+1)%2;
    else if (k==="Home") n=0; else if (k==="End") n=ptabBtns.length-1;
    if (n!==null){ e.preventDefault(); selectTab(n,true); }
  });
});

/* ── window manager ── */
const REG = {};
$$(".window").forEach(el => {
  REG[el.id.replace("win-","")] = { el, open:false, min:false, trigger:null };
});
function raiseWin(el){ el.style.zIndex = ++zTop; }
function focusWin(st){ st.el.focus({ preventScroll:true }); }

function placeWindow(id){
  const st = REG[id], el = st.el;
  const vw = innerWidth, vh = innerHeight;
  if (vw < 740){
    el.style.setProperty("--fw", "calc(100vw - 16px)");
    if (el.style.getPropertyValue("--fh") !== "auto")
      el.style.setProperty("--fh", "calc(100vh - 170px)");
    el.style.left = "8px";
    el.style.top  = clamp(50 + cascade * 22, 46, Math.max(46, vh - 120)) + "px";
    cascade = (cascade + 1) % 4;
    return;
  }
  if ((el.style.getPropertyValue("--fw")||"").includes("100vw"))
    el.style.removeProperty("--fw");
  const w = el.offsetWidth, h = el.offsetHeight || 480;
  const anchors = {
    about:      [(vw-w)/2 - vw*0.16, 116],
    experience: [Math.min(vw-w-14, vw*0.42), 74],
    projects:   [vw*0.30 - w*0.20, 134],
    skills:     [vw*0.58, 152],
    writing:    [vw-w-40, 122],
    activity:   [Math.max(14, vw*0.06), 168]
  };
  const [ax, ay] = anchors[id] || [(vw-w)/2, 100];
  el.style.left = clamp(ax + cascade*18, 8, vw-w-8) + "px";
  el.style.top  = clamp(ay, 40, Math.max(40, vh-h-84)) + "px";
  cascade = (cascade + 1) % 4;
}
function syncDock(){
  $$(".dock-item[data-win]").forEach(it =>
    it.classList.toggle("is-running", REG[it.dataset.win]?.open === true));
}
function openWin(id, trigger){
  const st = REG[id]; if (!st) return;
  if (trigger) st.trigger = trigger;
  if (st.open && !st.min){ raiseWin(st.el); focusWin(st); return; }
  st.el.hidden = false;
  if (!st.min) placeWindow(id);
  st.open = true; st.min = false;
  raiseWin(st.el);
  syncDock();
  focusWin(st);
  if (id === "activity") renderFeed();   /* re-stream the essay cascade on each open */
}
function minimizeWin(id){
  const st = REG[id]; if (!st || !st.open || st.min) return;
  st.min = true;
  hideElement(st.el, () => syncDock());
  st.trigger?.focus?.();
}
function closeWin(id){
  const st = REG[id]; if (!st) return;
  st.open = false; st.min = false;
  hideElement(st.el, () => syncDock());
  st.trigger?.focus?.();
}
function toggleWin(id, trigger){
  const st = REG[id]; if (!st) return;
  (!st.open || st.min) ? openWin(id, trigger) : minimizeWin(id);
}
Object.values(REG).forEach(st => {
  const el = st.el;
  el.addEventListener("pointerdown", () => raiseWin(el), true);

  $("[data-drag]", el).addEventListener("pointerdown", e => {
    if (e.button !== 0 || e.target.closest("button,a,input")) return;
    raiseWin(el);
    el.style.animation = "none";
    el.classList.remove("maximized");
    const rect = el.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const startL = rect.left, startT = rect.top;
    let dx = 0, dy = 0;
    const move = ev => {
      dx = ev.clientX - sx; dy = ev.clientY - sy;
      el.style.transform = `translate(${dx}px,${dy}px)`;
    };
    const up = () => {
      removeEventListener("pointermove", move); removeEventListener("pointerup", up);
      el.style.transform = "";
      const vw = innerWidth, vh = innerHeight, w = el.offsetWidth;
      el.style.left = clamp(startL+dx, 4, vw-w-4) + "px";
      el.style.top  = clamp(startT+dy, 38, vh-80) + "px";
    };
    addEventListener("pointermove", move); addEventListener("pointerup", up);
  });

  $("[data-drag]", el).addEventListener("dblclick", e => {
    if (e.target.closest("button,a,input")) return;
    zoomWin(el);
  });
  $("[data-close]", el).addEventListener("click", () => closeWin(Object.keys(REG).find(k => REG[k].el===el)));
  $("[data-min]", el).addEventListener("click", () => minimizeWin(Object.keys(REG).find(k => REG[k].el===el)));
  $("[data-zoom]", el).addEventListener("click", ev => { flashBusy(ev.currentTarget); zoomWin(el); });

  const rz = $(".resizer", el);
  rz.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    el.classList.remove("maximized");
    raiseWin(el);
    rz.setPointerCapture(e.pointerId);
    const sx=e.clientX, sy=e.clientY;
    const sw=el.offsetWidth;
    const sh=$(".win-body", el).offsetHeight;
    const minW = Math.min(420, sw), minH = Math.min(300, sh);
    const move = ev => {
      el.style.setProperty("--fw", clamp(sw+ev.clientX-sx, minW, innerWidth-20) + "px");
      el.style.setProperty("--fh", clamp(sh+ev.clientY-sy, minH, innerHeight-110) + "px");
    };
    const up = () => {
      rz.removeEventListener("pointermove", move); rz.removeEventListener("pointerup", up);
    };
    rz.addEventListener("pointermove", move); rz.addEventListener("pointerup", up);
  });
});
function zoomWin(el){
  el.classList.toggle("maximized");
  raiseWin(el);
}

/* escape closes the topmost surface */
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (/^(input|textarea)$/i.test(e.target.tagName)){ e.target.blur(); }
  if (openMenu) return hideMenu();
  if (popOpen)  return closePop();
  const vis = Object.values(REG).filter(s => s.open && !s.min && !s.el.hidden)
    .sort((a,b) => (+b.el.style.zIndex||20) - (+a.el.style.zIndex||20));
  if (vis[0]){
    minimizeWin(vis[0].el.id.replace("win-",""));
    $(`.dock-item[data-win="${vis[0].el.id.replace("win-","")}"]`)?.focus();
  }
});

/* ⌘1…⌘6 open windows directly */
const CMD_IDS = ["about","experience","projects","skills","writing","activity"];
document.addEventListener("keydown", e => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
  const idx = "123456".indexOf(e.key);
  if (idx === -1) return;
  if (/^(input|textarea)$/i.test(document.activeElement?.tagName || "")) return;
  e.preventDefault();
  openWin(CMD_IDS[idx], $(`.dock-item[data-win="${CMD_IDS[idx]}"]`));
});

/* dock + desktop icon triggers */
$$("[data-open]").forEach(b =>
  b.addEventListener("click", () => openWin(b.dataset.open, b)));
$$(".dock-item[data-win], .popover [data-win]").forEach(b => {
  if (b.closest(".dock")){
    b.addEventListener("click", () => {
      toggleWin(b.dataset.win, b);
      if (!reduce){
        b.classList.add("bounce");
        b.addEventListener("animationend", () => b.classList.remove("bounce"), { once:true });
        setTimeout(() => b.classList.remove("bounce"), 1400);
      }
    });
  } else {
    b.addEventListener("click", () => openWin(b.dataset.win, b));
  }
});

/* gaussian dock magnification — grows width so flexbox separates neighbors */
if (!reduce){
  const dock = $("#dock");
  const items = $$(".dock-item", dock);
  let centers = [];
  const capture = () => { centers = items.map(it => {
    const r = it.getBoundingClientRect(); return r.left + r.width/2; }); };
  dock.addEventListener("pointerenter", capture);
  dock.addEventListener("pointermove", e => {
    if (!centers.length) capture();
    items.forEach((it,i) => {
      const d = e.clientX - (centers[i] ?? e.clientX);
      const s = 1 + .5 * Math.exp(-(d*d)/(2*80*80));
      it.style.setProperty("--m", s.toFixed(3));               // drives tooltip offset
      $(".di-app", it)?.style.setProperty("--m", s.toFixed(3)); // the icon itself
    });
  });
  dock.addEventListener("pointerleave", () => {
    items.forEach(it => {
      it.style.setProperty("--m", 1);
      $(".di-app", it)?.style.setProperty("--m", 1);
    });
    centers = [];
  });
}

/* ── catalog-driven experience explorer ── */
const CATALOG = window.NIKKO_PORTFOLIO_CATALOG.locales["en-US"];
const ROLES = new Map();
CATALOG.groups.forEach(g => g.features.forEach(f => ROLES.set(f.id, { f, g })));

const roleNav=$("#roleNav"), roleSearch=$("#roleSearch"), roleCount=$("#roleCount");
const roleEyebrow=$("#roleEyebrow"), roleTitle=$("#roleTitle"), roleDesc=$("#roleDesc");
const roleChips=$("#roleChips"), roleBlocks=$("#roleBlocks");
const roleArt=$("#roleArt"), roleEmoji=$("#roleEmoji"), roleCap=$("#roleCap");

function buildRoles(){
  roleNav.innerHTML = CATALOG.groups.map(g => `
    <div class="feat-group" data-group="${esc(g.id)}">
      <div class="feat-group-label">${esc(g.title)}</div>
      ${g.features.map(f => `
        <button class="feat-item" data-feat="${esc(f.id)}"
          data-search="${esc((f.title+" "+f.company+" "+f.period+" "+f.summary+" "+f.notes.join(" ")+" "+g.title).toLowerCase())}">${esc(f.title)}</button>`).join("")}
    </div>`).join("") + `<div class="feat-empty" hidden>No roles match.</div>`;
  $$(".feat-item", roleNav).forEach(b =>
    b.addEventListener("click", () => selectRole(b.dataset.feat)));
  roleCount.textContent = `${ROLES.size}/${ROLES.size}`;
}
function selectRole(id){
  const hit = ROLES.get(id); if (!hit) return;
  const { f, g } = hit;
  roleEyebrow.textContent = g.title;
  roleTitle.textContent = f.title;
  roleDesc.textContent = f.summary;
  roleChips.innerHTML =
    `<span class="chip hot">${esc(f.energy)}</span>` +
    `<span class="chip">${esc(f.company)}</span>` +
    `<span class="chip tnum">${esc(f.period)}</span>` +
    (f.badge ? `<span class="chip live">${esc(f.badge)}</span>` : "");
  roleBlocks.innerHTML =
    `<ul class="checklist">${f.notes.map(n =>
      `<li><svg class="gi"><use href="#i-check"/></svg><span>${rich(n)}</span></li>`).join("")}</ul>`;
  roleArt.className = `feat-art grad-${f.tint}`;
  if (f.logo) roleEmoji.innerHTML = `<img src="${esc(f.logo)}" alt="${esc(f.company)} logo">`;
  else roleEmoji.textContent = f.symbol;
  roleCap.textContent = `${f.company} · ${f.period}`;
  $$(".feat-item", roleNav).forEach(b => {
    const on = b.dataset.feat === id;
    b.classList.toggle("active", on);
    if (on) b.setAttribute("aria-current","true"); else b.removeAttribute("aria-current");
  });
}
const normalizeSearch = v => String(v||"").normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"").toLowerCase();
roleSearch.addEventListener("input", () => {
  const q = normalizeSearch(roleSearch.value.trim());
  let visible = 0;
  $$(".feat-group", roleNav).forEach(grp => {
    let gv = 0;
    $$(".feat-item", grp).forEach(it => {
      const show = !q || normalizeSearch(it.dataset.search).includes(q);
      it.hidden = !show; if (show) gv++;
    });
    grp.hidden = gv === 0; visible += gv;
  });
  $(".feat-empty", roleNav).hidden = visible !== 0;
  roleCount.textContent = `${visible}/${ROLES.size}`;
});

/* ── substack essay feed ── */
const FEED = (window.NIKKO_SUBSTACK_FEED || []);
let streamOn = true;
let feedIdx = 0;          // rotating index for the mini feed + featured card

/* 5s total for all 20 essays = 250ms stagger per row */
const FEED_STAGGER_MS = 240;
const msList=$("#msList"), popMs=$("#popMs"), popFeatured=$("#popFeatured");
function feedRowHTML(s, i){
  return `
    <li class="feed-row row-new" style="animation-delay:${i*FEED_STAGGER_MS}ms">
      <span class="ms-ico" aria-hidden="true">${s.ico}</span>
      <div class="ms-main">
        <div class="ms-head">${esc(s.h)}</div>
        <div class="ms-text">${esc(s.t)}</div>
        <div class="ms-meta">${esc(s.c)} · ${esc(s.d)}</div>
      </div>
      <a class="ms-go" href="${esc(s.u)}" target="_blank" rel="noopener" aria-label="Read: ${esc(s.h)}">
        <svg class="gi"><use href="#i-ext"/></svg></a>
    </li>`;
}
function renderFeed(){
  msList.innerHTML = FEED.map(feedRowHTML).join("");
  if (!streamOn) $$(".feed-row", msList).forEach(r => r.style.animation = "none");
}
function renderMini(){
  popMs.innerHTML = Array.from({length:4},(_,k)=>{
    const s = FEED[(feedIdx + k) % FEED.length];
    return `<li><a href="${esc(s.u)}" target="_blank" rel="noopener" title="${esc(s.h)}">
      <span class="mc-i">${s.ico}</span>
      <span class="mc-t"><b>${esc(s.h)}</b></span></a></li>`;
  }).join("");
}
function renderFeatured(){
  const s = FEED[feedIdx % FEED.length];
  popFeatured.innerHTML =
    `<span class="eyebrow">Featured</span>
     <div class="feat-h">${esc(s.h)}</div>
     <div class="feat-t">${esc(s.t)}</div>
     <a class="link feat-link" href="${esc(s.u)}" target="_blank" rel="noopener">Read the essay <svg class="gi"><use href="#i-ext"/></svg></a>`;
}
renderFeed();
renderMini();
renderFeatured();

/* streaming switch ⇄ live pill ⇄ rotation */
const streamSw=$("#streamSw"), streamLbl=$("#streamLbl"), livePill=$("#livePill");
streamSw.addEventListener("change", () => {
  streamOn = streamSw.checked;
  streamLbl.textContent = streamOn ? "Streaming" : "Paused";
  livePill.textContent = streamOn ? "● Live" : "◌ Paused";
  livePill.classList.toggle("warn", !streamOn);
  livePill.classList.toggle("on", streamOn);
  renderFeed();
});
if (!reduce){
  setInterval(() => {
    if (!streamOn) return;
    feedIdx = (feedIdx + 1) % FEED.length;
    renderMini();
    renderFeatured();
  }, 2600);
}

/* shuffle reorders the feed and replays the cascade */
$("#resetFeed").addEventListener("click", e => {
  flashBusy(e.currentTarget);
  setTimeout(() => {
    for (let i = FEED.length - 1; i > 0; i--){
      const j = (Math.random() * (i + 1)) | 0;
      [FEED[i], FEED[j]] = [FEED[j], FEED[i]];
    }
    renderFeed();
  }, reduce ? 30 : 300);
});

/* ── boot reveal ── */
buildRoles();
selectRole(CATALOG.groups[0].features[0].id);

function boot(){
  let done = false;
  const go = () => {
    if (done) return; done = true;
    document.body.classList.remove("booting");
    openWin("about", $("#brandBtn"));
    if (reduce) openWin("experience", $('[data-tip="Experience"]'));
    else setTimeout(() => openWin("experience", $('[data-tip="Experience"]')), 260);
  };
  requestAnimationFrame(() => requestAnimationFrame(go));
  setTimeout(go, 300); /* fallback: never leave windows at opacity:0 if rAF is throttled */
}
document.readyState === "loading"
  ? addEventListener("DOMContentLoaded", boot, { once:true })
  : boot();
})();
