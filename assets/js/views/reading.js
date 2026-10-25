// 文献速录：DOI 快速建档、待读管理（数据存本地 IndexedDB）
// 元数据来自 Crossref 公共 API（无需密钥）；笔记内容仅保存在本地，不进公开仓库。

import { all, put, del } from "../store.js";
import { S, nav } from "../state.js";
import { esc, icon, uuid, toast, confirmDialog, fmtDate } from "../util.js";

const STATUSES = [
  { key: "to-read", label: "待读" },
  { key: "reading", label: "在读" },
  { key: "done", label: "已读" },
];
const statusLabel = (k) => (STATUSES.find((s) => s.key === k) || STATUSES[0]).label;
const statusChip = (k) => ({ "to-read": "chip-gray", reading: "chip-blue", done: "chip-green" }[k] || "chip-gray");
const PRI = { 1: "高", 2: "中", 3: "低" };

/** 从任意输入中提取 DOI */
function parseDoi(input) {
  const m = String(input || "").match(/10\.\d{4,9}\/[^\s"'<>,；;）)]+/i);
  return m ? m[0].replace(/[.,]$/, "") : "";
}

/** Crossref 公共 API 抓取题录（支持 CORS，无需密钥） */
async function fetchCrossref(doi) {
  const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  if (!r.ok) throw new Error("HTTP " + r.status);
  const m = (await r.json()).message;
  return {
    doi: m.DOI || doi,
    title: (m.title || [])[0] || "",
    journal: (m["container-title"] || [])[0] || "",
    year: String((((m.issued || {})["date-parts"] || [])[0] || [])[0] || ""),
    authors: (m.author || []).map((a) => `${a.given || ""} ${a.family || ""}`.trim()).filter(Boolean).join(", "),
  };
}

export async function render(el, ctx) {
  const items = await all("papers_list");
  if (ctx.seq !== nav.seq) return;
  let tab = ctx.params.get("tab") || "to-read";
  let editingId = null;
  let adding = false;

  el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <h1>文献速录</h1>
        <p class="muted">粘贴 DOI 自动抓取题录，管理待读队列。数据仅保存在本地浏览器。</p>
      </div>

      <div class="card">
        <div class="toolbar" style="margin-bottom:0">
          <input id="doiInput" class="input" placeholder="粘贴 DOI 或文章链接，如 10.1021/jacs.6c03810 或 https://doi.org/…" style="flex:2">
          <button id="fetchAdd" class="btn btn-primary">${icon("download")}获取题录并添加</button>
          <button id="manualAdd" class="btn">${icon("pen")}手动添加</button>
        </div>
        <p class="muted small" style="margin:8px 0 0">题录信息来自 Crossref 公共数据库；添加后可在条目上补笔记、优先级与标签。</p>
      </div>

      <div id="addFormWrap"></div>
      <div class="tabs" id="readTabs" style="margin-bottom:14px"></div>
      <div id="readList"></div>
    </div>`;

  const doiInput = el.querySelector("#doiInput");
  const tabsEl = el.querySelector("#readTabs");
  const listEl = el.querySelector("#readList");
  const formWrap = el.querySelector("#addFormWrap");

  const cardFor = (item) =>
    item.doi && S.index
      ? S.index.papers.find((p) => p.doi && p.doi.toLowerCase() === item.doi.toLowerCase())
      : null;

  function itemHTML(it) {
    const card = cardFor(it);
    if (editingId === it.id) {
      return `
      <div class="read-item" data-id="${esc(it.id)}" style="border-color:var(--primary)">
        <div class="read-body">
          <div class="form">
            <label>标题 *</label><input class="input" data-f="title" value="${esc(it.title)}">
            <div class="form-row">
              <div><label>DOI</label><input class="input" data-f="doi" value="${esc(it.doi || "")}"></div>
              <div><label>期刊 · 年份</label>
                <div class="form-row">
                  <input class="input" data-f="journal" value="${esc(it.journal || "")}">
                  <input class="input" data-f="year" value="${esc(it.year || "")}">
                </div>
              </div>
            </div>
            <label>笔记（为什么读 / 关键结论）</label><textarea class="input" data-f="note" rows="2">${esc(it.note || "")}</textarea>
            <div class="form-row">
              <div><label>优先级</label>
                <select class="input" data-f="priority">${[1, 2, 3].map((p) => `<option value="${p}" ${Number(it.priority) === p ? "selected" : ""}>${PRI[p]}</option>`).join("")}</select>
              </div>
              <div><label>标签（逗号分隔）</label><input class="input" data-f="tags" value="${esc((it.tags || []).join(", "))}"></div>
            </div>
            <div class="form-actions" style="margin-top:12px">
              <button class="btn btn-primary btn-small" data-act="save-edit">${icon("check")}保存</button>
              <button class="btn btn-small" data-act="cancel-edit">取消</button>
            </div>
          </div>
        </div>
      </div>`;
    }
    return `
      <div class="read-item" data-id="${esc(it.id)}">
        <span class="read-pri p${Number(it.priority) || 2}" title="优先级：${PRI[Number(it.priority) || 2]}">${icon("star")}</span>
        <div class="read-body">
          <div class="read-title">${esc(it.title || "（未命名）")}</div>
          <div class="read-meta">
            <span class="chip ${statusChip(it.status)}">${statusLabel(it.status)}</span>
            ${it.journal ? `<span class="chip">${esc(it.journal)}${it.year ? " · " + esc(it.year) : ""}</span>` : ""}
            ${it.doi ? `<a class="chip chip-link" href="https://doi.org/${esc(it.doi)}" target="_blank" rel="noopener noreferrer">DOI ${esc(it.doi)}</a>` : ""}
            ${card ? `<a class="chip chip-link" href="#/paper/${esc(card.slug)}">${icon("book")}精读卡</a>` : ""}
            ${(it.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}
            <span class="muted small">添加于 ${fmtDate(it.addedAt)}</span>
          </div>
          ${it.note ? `<div class="read-note">${esc(it.note)}</div>` : ""}
        </div>
        <div class="read-actions">
          ${it.status !== "done"
            ? `<button class="btn btn-small btn-primary" data-act="advance">${icon("arrow")}${it.status === "to-read" ? "开始读" : "读完"}</button>`
            : `<button class="btn btn-small" data-act="reopen">${icon("clock")}再读</button>`}
          <button class="btn btn-small" data-act="edit">${icon("pen")}编辑</button>
          <button class="btn btn-small btn-danger" data-act="del">${icon("trash")}删除</button>
        </div>
      </div>`;
  }

  function paint() {
    const counts = {};
    for (const s of STATUSES) counts[s.key] = items.filter((i) => i.status === s.key).length;
    counts.all = items.length;
    tabsEl.innerHTML = `
      <a class="tab ${tab === "to-read" ? "active" : ""}" href="#/reading?tab=to-read">待读 <span class="tab-count">${counts["to-read"]}</span></a>
      <a class="tab ${tab === "reading" ? "active" : ""}" href="#/reading?tab=reading">在读 <span class="tab-count">${counts["reading"]}</span></a>
      <a class="tab ${tab === "done" ? "active" : ""}" href="#/reading?tab=done">已读 <span class="tab-count">${counts["done"]}</span></a>
      <a class="tab ${tab === "all" ? "active" : ""}" href="#/reading?tab=all">全部 <span class="tab-count">${counts.all}</span></a>`;

    const PRI_RANK = { 1: 0, 2: 1, 3: 2 };
    const list = items
      .filter((i) => tab === "all" || i.status === tab)
      .sort((a, b) =>
        (PRI_RANK[a.priority] ?? 1) - (PRI_RANK[b.priority] ?? 1) ||
        (b.addedAt || "").localeCompare(a.addedAt || ""));

    listEl.innerHTML = list.length ? list.map(itemHTML).join("")
      : `<div class="empty">${icon("bookmark")}这里还没有文献。<br>把想读的论文 DOI 粘贴到上方，自动建档进待读队列。</div>`;
  }

  async function reload() {
    const fresh = await all("papers_list");
    items.splice(0, items.length, ...fresh);
    paint();
  }

  async function addFromFetch() {
    const doi = parseDoi(doiInput.value);
    if (!doi) { toast("没有识别到 DOI，请检查粘贴内容", "warn"); return; }
    if (items.some((i) => (i.doi || "").toLowerCase() === doi.toLowerCase())) {
      toast("这条 DOI 已经在列表里了", "warn");
      return;
    }
    const btn = el.querySelector("#fetchAdd");
    btn.disabled = true;
    btn.textContent = "获取中…";
    try {
      const meta = await fetchCrossref(doi);
      await put("papers_list", {
        id: uuid(), doi: meta.doi, title: meta.title, journal: meta.journal,
        year: meta.year, authors: meta.authors, status: "to-read",
        priority: 2, tags: [], note: "", addedAt: new Date().toISOString(), doneAt: null,
      });
      doiInput.value = "";
      await reload();
      toast("已添加：" + (meta.title || doi).slice(0, 40));
    } catch (e) {
      toast("获取题录失败（" + e.message + "），可点「手动添加」", "warn");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon("download")}获取题录并添加`;
    }
  }

  function renderAddForm() {
    if (!adding) { formWrap.innerHTML = ""; return; }
    formWrap.innerHTML = `
      <div class="card">
        <h2>手动添加文献</h2>
        <div class="form">
          <label>标题 *</label><input class="input" id="mTitle">
          <div class="form-row form-row-3">
            <div><label>DOI</label><input class="input" id="mDoi"></div>
            <div><label>期刊</label><input class="input" id="mJournal"></div>
            <div><label>年份</label><input class="input" id="mYear"></div>
          </div>
          <div class="form-row">
            <div><label>优先级</label>
              <select class="input" id="mPri">${[1, 2, 3].map((p) => `<option value="${p}" ${p === 2 ? "selected" : ""}>${PRI[p]}</option>`).join("")}</select>
            </div>
            <div><label>标签（逗号分隔）</label><input class="input" id="mTags"></div>
          </div>
          <div class="form-actions" style="margin-top:14px">
            <button class="btn btn-primary" id="mSave">${icon("check")}添加到待读</button>
            <button class="btn" id="mCancel">取消</button>
          </div>
        </div>
      </div>`;
    formWrap.querySelector("#mCancel").addEventListener("click", () => { adding = false; renderAddForm(); });
    formWrap.querySelector("#mSave").addEventListener("click", async () => {
      const title = formWrap.querySelector("#mTitle").value.trim();
      if (!title) { toast("请填写标题", "warn"); return; }
      await put("papers_list", {
        id: uuid(), title,
        doi: parseDoi(formWrap.querySelector("#mDoi").value),
        journal: formWrap.querySelector("#mJournal").value.trim(),
        year: formWrap.querySelector("#mYear").value.trim(),
        status: "to-read", priority: Number(formWrap.querySelector("#mPri").value),
        tags: formWrap.querySelector("#mTags").value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        note: "", addedAt: new Date().toISOString(), doneAt: null,
      });
      adding = false;
      renderAddForm();
      await reload();
      toast("已添加到待读");
    });
  }

  // 事件
  el.querySelector("#fetchAdd").addEventListener("click", addFromFetch);
  doiInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addFromFetch(); });
  el.querySelector("#manualAdd").addEventListener("click", () => { adding = !adding; renderAddForm(); });

  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const itemEl = e.target.closest(".read-item");
    const it = items.find((x) => x.id === itemEl.dataset.id);
    if (!it) return;
    const act = btn.dataset.act;

    if (act === "advance") {
      it.status = it.status === "to-read" ? "reading" : "done";
      it.doneAt = it.status === "done" ? new Date().toISOString() : null;
      await put("papers_list", it);
      await reload();
    } else if (act === "reopen") {
      it.status = "reading";
      it.doneAt = null;
      await put("papers_list", it);
      await reload();
    } else if (act === "edit") {
      editingId = it.id;
      paint();
    } else if (act === "cancel-edit") {
      editingId = null;
      paint();
    } else if (act === "save-edit") {
      const get = (f) => itemEl.querySelector(`[data-f="${f}"]`);
      it.title = get("title").value.trim() || it.title;
      it.doi = parseDoi(get("doi").value);
      it.journal = get("journal").value.trim();
      it.year = get("year").value.trim();
      it.note = get("note").value;
      it.priority = Number(get("priority").value);
      it.tags = get("tags").value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      await put("papers_list", it);
      editingId = null;
      await reload();
      toast("已保存");
    } else if (act === "del") {
      if (!confirmDialog("删除这条文献记录？")) return;
      await del("papers_list", it.id);
      await reload();
    }
  });

  paint();
}
