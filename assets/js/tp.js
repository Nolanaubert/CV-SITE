/* ============================================================
   tp.js — Page TP publique
   Lit tp-data.json (partagé) ou le cache localStorage en fallback.
   ============================================================ */

(function () {
  "use strict";

  const STORAGE_KEY = "nolan_tp_data";
  const JSON_PATH   = "../tp-data.json";

  /* ════════════ LOAD DATA ════════════ */
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /* ════════════ RENDER SIDEBAR ════════════ */
  function renderSidebar(data, activeTpId) {
    const sidebar = document.querySelector(".tp-sidebar-inner");
    if (!sidebar || !data) return;
    let html = "";
    data.subjects.forEach(subject => {
      if (!subject.tps.length) return;
      html += `
        <div class="tp-sidebar-group">
          <div class="tp-sidebar-heading">
            <span class="dot" style="background:${subject.color}"></span> ${subject.label}
          </div>
          <ul class="tp-sidebar-list">`;
      subject.tps.forEach((tp, i) => {
        const active = tp.id === activeTpId ? "active" : "";
        html += `<li><a href="#" class="tp-sidebar-link ${active}" data-tp-id="${tp.id}">TP ${i + 1} — ${tp.title.replace(/^TP\s*\d+\s*[—-]\s*/i, "")}</a></li>`;
      });
      html += `</ul></div>`;
    });
    sidebar.innerHTML = html;

    // Clics
    sidebar.querySelectorAll(".tp-sidebar-link").forEach(link => {
      link.addEventListener("click", e => {
        e.preventDefault();
        const tpId = link.dataset.tpId;
        renderMainContent(data, tpId);
        // Active
        sidebar.querySelectorAll(".tp-sidebar-link").forEach(l => l.classList.remove("active"));
        link.classList.add("active");
        // Breadcrumb
        updateBreadcrumb(data, tpId);
      });
    });
  }

  /* ════════════ RENDER MAIN ════════════ */
  function renderMainContent(data, tpId) {
    const main = document.getElementById("tp-main");
    if (!main) return;

    // Trouver le TP
    let tp = null, subjectLabel = "";
    for (const subj of data.subjects) {
      const found = subj.tps.find(t => t.id === tpId);
      if (found) { tp = found; subjectLabel = subj.label; break; }
    }

    if (!tp) {
      main.innerHTML = `<div style="padding:2rem;color:var(--muted);font-family:var(--font-mono);">Sélectionne un TP dans la barre de gauche.</div>`;
      return;
    }

    // Générer les sections à partir des blocs
    const sections = groupBlocksIntoSections(tp.blocks);

    // TOC
    const tocItems = sections.map((s, i) =>
      `<li><a href="#tp-sec-${i}"><span class="toc-num">${String(i + 1).padStart(2, "0")}</span>${s.title}</a></li>`
    ).join("");

    // Sections HTML
    const sectionsHtml = sections.map((s, i) => `
      <section class="tp-section" id="tp-sec-${i}" data-title="${escHtml(s.title)}">
        <h2 class="tp-section-title">
          <span class="tp-section-num">${String(i + 1).padStart(2, "0")}</span>
          ${escHtml(s.title)}
        </h2>
        ${s.blocksHtml}
      </section>`).join("");

    main.innerHTML = `
      <div class="tp-breadcrumb">
        <span>Travaux Pratiques</span>
        <span class="tp-bc-sep">›</span>
        <span id="bc-subject">${escHtml(subjectLabel)}</span>
        <span class="tp-bc-sep">›</span>
        <span id="bc-title">${escHtml(tp.title)}</span>
      </div>

      <div class="tp-header">
        <span class="badge badge--green tp-subject-badge">${escHtml(tp.badge || subjectLabel)}</span>
        <h1 class="tp-title">${escHtml(tp.title)}</h1>
        <div class="tp-meta">
          <span>⏱ ${escHtml(tp.duration || "—")}</span>
          <span class="tp-meta-sep">·</span>
          <span>Niveau : ${escHtml(tp.level || "—")}</span>
          ${tp.tool ? `<span class="tp-meta-sep">·</span><span>Outil : ${escHtml(tp.tool)}</span>` : ""}
        </div>
      </div>

      ${tocItems ? `
      <nav class="tp-toc">
        <div class="tp-toc-title"><span class="section-title" style="margin-bottom:0">Sommaire</span></div>
        <ol class="tp-toc-list">${tocItems}</ol>
      </nav>` : ""}

      ${sectionsHtml}

      <div class="tp-footer">
        <span><span class="status-dot"></span>${escHtml(tp.title)} · BTS SIO</span>
        <span><a href="tp-editor.html" style="color:var(--accent);font-family:var(--font-mono);font-size:11px;text-decoration:none;">✎ Modifier ce TP</a></span>
      </div>`;

    // TOC droite
    renderTocRight(sections);

    // Scroll spy
    initScrollSpy();

    // Boutons copier
    initCopyButtons();

    // Smooth scroll
    initSmoothScroll();
  }

  /* ════════════ GROUPER LES BLOCS EN SECTIONS ════════════ */
  function groupBlocksIntoSections(blocks) {
    if (!blocks || !blocks.length) return [{ title: "Contenu", blocksHtml: "<p class='tp-text' style='color:var(--muted)'>Ce TP est vide. <a href='tp-editor.html' style='color:var(--accent)'>Ouvre l'éditeur</a> pour ajouter du contenu.</p>" }];

    // On regroupe tous les blocs dans une seule "section" par défaut,
    // en détectant les blocs "step" comme titres de section potentiels
    const sections = [];
    let currentSection = null;

    blocks.forEach(block => {
      if (!currentSection) {
        currentSection = { title: "Introduction", blocksHtml: "" };
        sections.push(currentSection);
      }
      currentSection.blocksHtml += renderBlockHtml(block);
    });

    // Si plus de 5 blocs, tenter de créer des sections via les step
    if (blocks.length > 4) {
      const rebuilt = [];
      let sec = null;
      let stepCount = 0;
      blocks.forEach(block => {
        if (block.type === "step") {
          stepCount++;
          if (sec) rebuilt.push(sec);
          sec = { title: block.stepTitle || `Étape ${stepCount}`, blocksHtml: renderBlockHtml(block) };
        } else {
          if (!sec) { sec = { title: "Introduction", blocksHtml: "" }; }
          sec.blocksHtml += renderBlockHtml(block);
        }
      });
      if (sec) rebuilt.push(sec);
      if (rebuilt.length > 1) return rebuilt;
    }

    return sections;
  }

  /* ════════════ HTML D'UN BLOC ════════════ */
  function renderBlockHtml(block) {
    if (block.type === "text") {
      return `<p class="tp-text">${nl2br(escHtml(block.content || ""))}</p>`;

    } else if (block.type === "code") {
      const codeId = "code-" + Math.random().toString(36).slice(2);
      return `
        <div class="tp-code-wrap">
          <div class="tp-code-header">
            <span class="tp-code-lang">${escHtml(block.lang || "code")}</span>
            <button class="tp-copy-btn" data-target="${codeId}">Copier</button>
          </div>
          <pre class="tp-code" id="${codeId}"><code>${escHtml(block.content || "")}</code></pre>
        </div>`;

    } else if (block.type === "note") {
      const icons = { info: "ℹ", warn: "⚠", success: "✓" };
      const icon = icons[block.noteType] || "ℹ";
      return `
        <div class="tp-note tp-note--${block.noteType || "info"}">
          <span class="tp-note-icon">${icon}</span>
          <div>${nl2br(escHtml(block.content || ""))}</div>
        </div>`;

    } else if (block.type === "screenshot") {
      return `
        <div class="tp-screenshot">
          <div class="tp-screenshot-label">${escHtml(block.caption || "Capture d'écran")}</div>
          <img src="${escHtml(block.content || "")}" alt="${escHtml(block.caption || "")}" class="tp-img" onerror="this.parentElement.classList.add('tp-screenshot--placeholder')" />
          <div class="tp-screenshot-placeholder-text">${escHtml(block.content || "Chemin non défini")}</div>
        </div>`;

    } else if (block.type === "table") {
      const rows = (block.content || "").trim().split("\n").filter(Boolean);
      if (!rows.length) return "";
      const [header, ...body] = rows;
      const ths = header.split("|").map(c => `<th>${escHtml(c.trim())}</th>`).join("");
      const trs = body.map(row => {
        const tds = row.split("|").map(c => `<td>${escHtml(c.trim())}</td>`).join("");
        return `<tr>${tds}</tr>`;
      }).join("");
      return `
        <div class="tp-table-wrap">
          <table class="tp-table">
            <thead><tr>${ths}</tr></thead>
            <tbody>${trs}</tbody>
          </table>
        </div>`;

    } else if (block.type === "step") {
      return `
        <div class="tp-note tp-note--success">
          <span class="tp-note-icon">→</span>
          <div><strong>${escHtml(block.stepTitle || "")}</strong><br>${nl2br(escHtml(block.content || ""))}</div>
        </div>`;
    }
    return "";
  }

  /* ════════════ TOC DROITE ════════════ */
  function renderTocRight(sections) {
    const list = document.getElementById("toc-right-list");
    if (!list) return;
    list.innerHTML = sections.map((s, i) =>
      `<li><a href="#tp-sec-${i}" data-section="tp-sec-${i}">${escHtml(s.title)}</a></li>`
    ).join("");
  }

  /* ════════════ SCROLL SPY ════════════ */
  function initScrollSpy() {
    const links = document.querySelectorAll("#toc-right-list a");
    const sections = document.querySelectorAll(".tp-section");
    if (!links.length || !sections.length) return;

    function update() {
      let cur = sections[0]?.id;
      sections.forEach(s => { if (window.scrollY + 100 >= s.offsetTop) cur = s.id; });
      links.forEach(l => l.classList.toggle("active", l.dataset.section === cur));
    }
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  /* ════════════ COPIER ════════════ */
  function initCopyButtons() {
    document.querySelectorAll(".tp-copy-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const el = document.getElementById(btn.dataset.target);
        if (!el) return;
        navigator.clipboard.writeText(el.textContent).then(() => {
          btn.textContent = "Copié !";
          btn.classList.add("copied");
          setTimeout(() => { btn.textContent = "Copier"; btn.classList.remove("copied"); }, 1800);
        });
      });
    });
  }

  /* ════════════ SMOOTH SCROLL ════════════ */
  function initSmoothScroll() {
    document.querySelectorAll(".tp-toc-list a, #toc-right-list a").forEach(a => {
      a.addEventListener("click", e => {
        const href = a.getAttribute("href");
        if (!href?.startsWith("#")) return;
        e.preventDefault();
        const target = document.querySelector(href);
        if (!target) return;
        window.scrollTo({ top: target.offsetTop - 72, behavior: "smooth" });
      });
    });
  }

  /* ════════════ BREADCRUMB ════════════ */
  function updateBreadcrumb(data, tpId) {
    for (const subj of data.subjects) {
      const tp = subj.tps.find(t => t.id === tpId);
      if (tp) {
        const bcSub = document.getElementById("bc-subject");
        const bcTitle = document.getElementById("bc-title");
        if (bcSub) bcSub.textContent = subj.label;
        if (bcTitle) bcTitle.textContent = tp.title;
      }
    }
  }

  /* ════════════ HELPERS ════════════ */
  function escHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function nl2br(str) { return str.replace(/\n/g, "<br>"); }

  /* ════════════ INIT ════════════ */
  function init() {
    // Priorité : tp-data.json (données partagées) → fallback localStorage
    fetch(JSON_PATH + "?t=" + Date.now())
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(json => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(json)); } catch(e){}
        boot(json);
      })
      .catch(() => {
        boot(loadData());
      });
  }

  function boot(data) {
    if (!data) return; // Pas de données → la page statique s'affiche

    // Trouver le premier TP
    let firstTpId = null;
    for (const subj of data.subjects) {
      if (subj.tps.length) { firstTpId = subj.tps[0].id; break; }
    }

    renderSidebar(data, firstTpId);
    if (firstTpId) renderMainContent(data, firstTpId);
  }

  // Boutons copier (page statique, sans éditeur)
  document.querySelectorAll(".tp-copy-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const el = document.getElementById(btn.dataset.target);
      if (!el) return;
      navigator.clipboard.writeText(el.textContent).then(() => {
        btn.textContent = "Copié !";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "Copier"; btn.classList.remove("copied"); }, 1800);
      });
    });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
