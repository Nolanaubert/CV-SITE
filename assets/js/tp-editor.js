/* ============================================================
   tp-editor.js — Éditeur de TP sans coder
   Stockage : tp-data.json (partagé) + localStorage (cache local)
   ============================================================ */

(function () {
  "use strict";

  /* ════════════════ ÉTAT ════════════════ */
  const STORAGE_KEY  = "nolan_tp_data";
  const JSON_PATH    = "../tp-data.json";

  const DEFAULT_DATA = {
    subjects: [
      {
        id: "reseau", label: "Réseau", color: "var(--accent)",
        tps: [
          {
            id: "reseau-vlan", title: "TP 1 — Configuration VLANs Cisco",
            badge: "Réseau", duration: "2h", level: "Débutant", tool: "Cisco Packet Tracer",
            blocks: [
              { type: "text", content: "Un VLAN (Virtual Local Area Network) permet de segmenter logiquement un réseau physique en plusieurs réseaux distincts au niveau de la couche 2 du modèle OSI." },
              { type: "code", lang: "IOS — Cisco", content: "Switch> enable\nSwitch# configure terminal\n\nSwitch(config)# vlan 10\nSwitch(config-vlan)# name VLAN_ADMIN\nSwitch(config-vlan)# exit" },
              { type: "note", noteType: "info", content: "Prérequis : avoir Cisco Packet Tracer 8+ installé." }
            ]
          }
        ]
      },
      {
        id: "linux", label: "Linux", color: "#f59e0b",
        tps: [
          {
            id: "linux-base", title: "TP 1 — Commandes de base",
            badge: "Linux", duration: "1h30", level: "Débutant", tool: "Ubuntu 22.04",
            blocks: [
              { type: "text", content: "Dans ce TP, nous allons découvrir les commandes fondamentales de Linux." }
            ]
          }
        ]
      },
      {
        id: "windows", label: "Windows Server", color: "var(--accent-2)",
        tps: []
      }
    ]
  };

  /* ════════════════ DONNÉES ════════════════ */
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_DATA));
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
  }

  function saveData(d) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    } catch (e) { console.error("Save error", e); }
  }

  /* ════════════════ CHARGEMENT DEPUIS JSON ════════════════ */
  function loadFromJson(callback) {
    fetch(JSON_PATH + "?t=" + Date.now())
      .then(r => {
        if (!r.ok) throw new Error("Fichier introuvable");
        return r.json();
      })
      .then(json => {
        saveData(json);  // met à jour le cache local
        callback(json);
        showToast("✓ Données chargées depuis tp-data.json");
      })
      .catch(() => {
        // Pas de fichier JSON → on reste sur le cache localStorage
        callback(null);
      });
  }

  /* ════════════════ EXPORT JSON ════════════════ */
  function exportJson(d) {
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "tp-data.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("📥 tp-data.json téléchargé — uploadez-le à la racine du site !");
  }

  /* ════════════════ IDs ════════════════ */
  function uid() {
    return Math.random().toString(36).slice(2, 9);
  }

  /* ════════════════ ÉTAT COURANT ════════════════ */
  let data = loadData();
  let currentSubjectId = data.subjects[0]?.id || null;
  let currentTpId = data.subjects[0]?.tps[0]?.id || null;

  /* ════════════════ ÉLÉMENTS DOM ════════════════ */
  const panelBody    = document.getElementById("editor-panel-body");
  const editorMain   = document.getElementById("editor-main");
  const toast        = document.getElementById("editor-toast");

  /* ════════════════ TOAST ════════════════ */
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2200);
  }

  /* ════════════════ RENDU PANNEAU GAUCHE ════════════════ */
  function renderPanel() {
    if (!panelBody) return;
    let html = "";

    data.subjects.forEach(subject => {
      html += `
        <div class="editor-group">
          <div class="editor-group__label">
            <span class="editor-group__dot" style="background:${subject.color}"></span>
            ${subject.label}
          </div>
          <ul class="editor-tp-list">`;

      subject.tps.forEach((tp, i) => {
        const isActive = tp.id === currentTpId ? "active" : "";
        html += `
            <li class="editor-tp-item ${isActive}" data-tp-id="${tp.id}" data-subject-id="${subject.id}">
              <span class="editor-tp-item__num">TP${String(i + 1).padStart(2, "0")}</span>
              ${tp.title}
            </li>`;
      });

      html += `
          </ul>
          <button class="editor-new-tp" data-subject="${subject.id}">+ Ajouter un TP</button>
        </div>`;
    });

    panelBody.innerHTML = html;

    // Événements
    panelBody.querySelectorAll(".editor-tp-item").forEach(el => {
      el.addEventListener("click", () => {
        currentSubjectId = el.dataset.subjectId;
        currentTpId = el.dataset.tpId;
        renderPanel();
        renderEditor();
      });
    });

    panelBody.querySelectorAll(".editor-new-tp").forEach(btn => {
      btn.addEventListener("click", () => addNewTp(btn.dataset.subject));
    });
  }

  /* ════════════════ TROUVER UN TP ════════════════ */
  function findTp(tpId) {
    for (const subj of data.subjects) {
      const tp = subj.tps.find(t => t.id === tpId);
      if (tp) return { subject: subj, tp };
    }
    return null;
  }

  /* ════════════════ RENDU ÉDITEUR ════════════════ */
  function renderEditor() {
    if (!editorMain) return;
    const found = currentTpId ? findTp(currentTpId) : null;

    if (!found) {
      editorMain.innerHTML = `
        <div class="editor-empty">
          <div class="editor-empty__icon">◈</div>
          <div>Sélectionne un TP dans le panneau gauche<br>ou crée-en un nouveau</div>
        </div>`;
      return;
    }

    const { tp } = found;

    editorMain.innerHTML = `
      <!-- TOOLBAR -->
      <div class="editor-toolbar">
        <div class="editor-toolbar__left">
          <button class="editor-btn editor-btn--primary" id="btn-save">✓ Sauvegarder</button>
          <button class="editor-btn editor-btn--export" id="btn-export-json">📥 Exporter tp-data.json</button>
          <button class="editor-btn" id="btn-preview">◉ Prévisualiser sur tp.html</button>
        </div>
        <div class="editor-toolbar__right">
          <button class="editor-btn editor-btn--danger" id="btn-delete">✕ Supprimer ce TP</button>
        </div>
      </div>

      <!-- INFOS GÉNÉRALES -->
      <div class="editor-card">
        <div class="editor-card__title">Informations générales</div>

        <div class="editor-field">
          <label class="editor-label">Titre du TP</label>
          <input class="editor-input" id="tp-title" type="text" value="${escHtml(tp.title)}" placeholder="Ex: TP 2 — Routage OSPF" />
        </div>

        <div class="editor-field-row">
          <div class="editor-field">
            <label class="editor-label">Badge / Matière</label>
            <select class="editor-select" id="tp-badge">
              ${data.subjects.map(s => `<option value="${s.label}" ${tp.badge === s.label ? "selected" : ""}>${s.label}</option>`).join("")}
            </select>
          </div>
          <div class="editor-field">
            <label class="editor-label">Niveau</label>
            <select class="editor-select" id="tp-level">
              ${["Débutant","Intermédiaire","Avancé"].map(l => `<option ${tp.level === l ? "selected" : ""}>${l}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="editor-field-row">
          <div class="editor-field">
            <label class="editor-label">Durée estimée</label>
            <input class="editor-input" id="tp-duration" type="text" value="${escHtml(tp.duration)}" placeholder="Ex: 2h30" />
          </div>
          <div class="editor-field">
            <label class="editor-label">Outil / Logiciel</label>
            <input class="editor-input" id="tp-tool" type="text" value="${escHtml(tp.tool)}" placeholder="Ex: Cisco Packet Tracer" />
          </div>
        </div>
      </div>

      <!-- SECTIONS / BLOCS -->
      <div class="editor-card">
        <div class="editor-card__title">Contenu du TP</div>
        <div class="editor-blocks" id="editor-blocks">
          ${tp.blocks.map((block, i) => renderBlock(block, i)).join("")}
        </div>
      </div>

      <!-- AJOUTER UN BLOC -->
      <div class="editor-add-block">
        <span class="editor-add-label">+ Ajouter :</span>
        <button class="editor-add-btn" data-block-type="text">📝 Texte</button>
        <button class="editor-add-btn" data-block-type="code">💻 Code</button>
        <button class="editor-add-btn" data-block-type="note">💡 Note</button>
        <button class="editor-add-btn" data-block-type="screenshot">🖼 Screenshot</button>
        <button class="editor-add-btn" data-block-type="table">📊 Tableau</button>
        <button class="editor-add-btn" data-block-type="step">🔢 Étape numérotée</button>
      </div>
    `;

    bindEditorEvents(tp, found.subject);
  }

  /* ════════════════ RENDU D'UN BLOC ════════════════ */
  function renderBlock(block, idx) {
    const typeLabel = { text: "📝 Texte", code: "💻 Code", note: "💡 Note", screenshot: "🖼 Screenshot", table: "📊 Tableau", step: "🔢 Étape" }[block.type] || block.type;

    let inner = "";

    if (block.type === "text") {
      inner = `<textarea class="editor-textarea block-content" placeholder="Saisis ton texte explicatif...">${escHtml(block.content || "")}</textarea>`;

    } else if (block.type === "code") {
      inner = `
        <div class="editor-field">
          <label class="editor-label">Langage / Label</label>
          <input class="editor-input block-lang" type="text" value="${escHtml(block.lang || "")}" placeholder="Ex: Cisco IOS, Bash, Python..." />
        </div>
        <div class="editor-field">
          <label class="editor-label">Code</label>
          <textarea class="editor-textarea editor-textarea--code block-content" placeholder="Colle ton code ici...">${escHtml(block.content || "")}</textarea>
        </div>`;

    } else if (block.type === "note") {
      inner = `
        <div class="editor-field">
          <label class="editor-label">Type de note</label>
          <select class="editor-select block-note-type">
            ${["info","warn","success"].map(t => `<option value="${t}" ${block.noteType === t ? "selected" : ""}>${{info:"ℹ Info",warn:"⚠ Avertissement",success:"✓ Succès"}[t]}</option>`).join("")}
          </select>
        </div>
        <div class="editor-field">
          <label class="editor-label">Contenu de la note</label>
          <textarea class="editor-textarea block-content" placeholder="Message de la note...">${escHtml(block.content || "")}</textarea>
        </div>`;

    } else if (block.type === "screenshot") {
      inner = `
        <div class="editor-field">
          <label class="editor-label">Légende / Description</label>
          <input class="editor-input block-caption" type="text" value="${escHtml(block.caption || "")}" placeholder="Ex: Capture — Topologie dans Packet Tracer" />
        </div>
        <div class="editor-field">
          <label class="editor-label">Chemin de l'image (relatif)</label>
          <input class="editor-input block-content" type="text" value="${escHtml(block.content || "")}" placeholder="Ex: screenshots/tp1-topologie.png" />
        </div>`;

    } else if (block.type === "table") {
      inner = `
        <div class="editor-field">
          <label class="editor-label">Tableau (format CSV — séparateur |)</label>
          <textarea class="editor-textarea block-content" placeholder="En-tête 1|En-tête 2|En-tête 3\nValeur A|Valeur B|Valeur C\nValeur D|Valeur E|Valeur F">${escHtml(block.content || "")}</textarea>
        </div>`;

    } else if (block.type === "step") {
      inner = `
        <div class="editor-field">
          <label class="editor-label">Titre de l'étape</label>
          <input class="editor-input block-step-title" type="text" value="${escHtml(block.stepTitle || "")}" placeholder="Ex: Passer en mode privilégié" />
        </div>
        <div class="editor-field">
          <label class="editor-label">Description</label>
          <textarea class="editor-textarea block-content" placeholder="Explication de l'étape...">${escHtml(block.content || "")}</textarea>
        </div>`;
    }

    return `
      <div class="editor-block editor-block--${block.type}" data-block-idx="${idx}">
        <div class="editor-block__head">
          <div class="editor-block__type">${typeLabel}</div>
          <div class="editor-block__actions">
            <button class="editor-block__btn btn-move-up" title="Monter">↑</button>
            <button class="editor-block__btn btn-move-down" title="Descendre">↓</button>
            <button class="editor-block__btn editor-block__btn--del btn-delete-block" title="Supprimer">✕</button>
          </div>
        </div>
        <div class="editor-block__body">${inner}</div>
      </div>`;
  }

  /* ════════════════ EVENTS ÉDITEUR ════════════════ */
  function bindEditorEvents(tp, subject) {

    // Sauvegarder
    document.getElementById("btn-save")?.addEventListener("click", () => {
      collectAndSave(tp);
      showToast("✓ TP sauvegardé !");
    });

    // Exporter JSON
    document.getElementById("btn-export-json")?.addEventListener("click", () => {
      collectAndSave(tp);
      exportJson(data);
    });

    // Supprimer le TP
    document.getElementById("btn-delete")?.addEventListener("click", () => {
      if (!confirm(`Supprimer "${tp.title}" ?`)) return;
      subject.tps = subject.tps.filter(t => t.id !== tp.id);
      currentTpId = subject.tps[0]?.id || null;
      saveData(data);
      renderPanel();
      renderEditor();
      showToast("TP supprimé");
    });

    // Prévisualiser
    document.getElementById("btn-preview")?.addEventListener("click", () => {
      collectAndSave(tp);
      window.open("tp.html", "_blank");
    });

    // Ajouter un bloc
    document.querySelectorAll(".editor-add-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        collectAndSave(tp);
        const type = btn.dataset.blockType;
        tp.blocks.push({ type });
        saveData(data);
        renderEditor();
        // Scroller vers le bas
        setTimeout(() => { editorMain.scrollTop = editorMain.scrollHeight; }, 50);
      });
    });

    // Actions sur les blocs (monter, descendre, supprimer)
    document.querySelectorAll(".editor-block").forEach(blockEl => {
      const idx = parseInt(blockEl.dataset.blockIdx);

      blockEl.querySelector(".btn-move-up")?.addEventListener("click", () => {
        collectAndSave(tp);
        if (idx === 0) return;
        [tp.blocks[idx - 1], tp.blocks[idx]] = [tp.blocks[idx], tp.blocks[idx - 1]];
        saveData(data); renderEditor();
      });

      blockEl.querySelector(".btn-move-down")?.addEventListener("click", () => {
        collectAndSave(tp);
        if (idx === tp.blocks.length - 1) return;
        [tp.blocks[idx], tp.blocks[idx + 1]] = [tp.blocks[idx + 1], tp.blocks[idx]];
        saveData(data); renderEditor();
      });

      blockEl.querySelector(".btn-delete-block")?.addEventListener("click", () => {
        collectAndSave(tp);
        tp.blocks.splice(idx, 1);
        saveData(data); renderEditor();
      });
    });
  }

  /* ════════════════ COLLECTE DES DONNÉES DU FORMULAIRE ════════════════ */
  function collectAndSave(tp) {
    tp.title    = document.getElementById("tp-title")?.value || tp.title;
    tp.badge    = document.getElementById("tp-badge")?.value || tp.badge;
    tp.level    = document.getElementById("tp-level")?.value || tp.level;
    tp.duration = document.getElementById("tp-duration")?.value || tp.duration;
    tp.tool     = document.getElementById("tp-tool")?.value || tp.tool;

    document.querySelectorAll(".editor-block").forEach((blockEl, i) => {
      const block = tp.blocks[i];
      if (!block) return;
      block.content = blockEl.querySelector(".block-content")?.value ?? block.content;
      if (block.type === "code") block.lang = blockEl.querySelector(".block-lang")?.value ?? block.lang;
      if (block.type === "note") block.noteType = blockEl.querySelector(".block-note-type")?.value ?? block.noteType;
      if (block.type === "screenshot") block.caption = blockEl.querySelector(".block-caption")?.value ?? block.caption;
      if (block.type === "step") block.stepTitle = blockEl.querySelector(".block-step-title")?.value ?? block.stepTitle;
    });

    saveData(data);
    renderPanel(); // refresh titre dans le panneau
  }

  /* ════════════════ NOUVEAU TP ════════════════ */
  function addNewTp(subjectId) {
    const subject = data.subjects.find(s => s.id === subjectId);
    if (!subject) return;
    const num = subject.tps.length + 1;
    const newTp = {
      id: uid(),
      title: `TP ${num} — Nouveau TP`,
      badge: subject.label,
      duration: "1h",
      level: "Débutant",
      tool: "",
      blocks: [
        { type: "text", content: "Décris ici l'introduction de ton TP..." }
      ]
    };
    subject.tps.push(newTp);
    currentSubjectId = subjectId;
    currentTpId = newTp.id;
    saveData(data);
    renderPanel();
    renderEditor();
  }

  /* ════════════════ EXPORT POUR TP.HTML ════════════════ */
  window.getEditorData = () => loadData();

  /* ════════════════ ESCAPE HTML ════════════════ */
  function escHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ════════════════ INIT ════════════════ */
  function init() {
    // Essaie d'abord de charger depuis le JSON distant
    loadFromJson(jsonData => {
      if (jsonData) {
        data = jsonData;
        currentSubjectId = data.subjects[0]?.id || null;
        currentTpId = data.subjects[0]?.tps[0]?.id || null;
      }
      renderPanel();
      renderEditor();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
