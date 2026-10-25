// 文献库：索引浏览、搜索、标签筛选

import { S } from "../state.js";
import { esc, fmtDate } from "../util.js";

export async function render(el) {
  const papers = S.index ? S.index.papers : [];
  const tags = [...new Set(papers.flatMap((p) => p.tags || []))].sort();

  el.innerHTML = `
    <div class="page">
      <div class="page-head"><h1>文献库</h1>
        <p class="muted">共 ${papers.length} 篇精读卡 · 点击卡片查看完整内容</p></div>
      <div class="toolbar">
        <input id="paperSearch" class="input" type="search" placeholder="搜索标题 / DOI / 期刊 / 关键词…">
      </div>
      <div id="tagBar" class="tagbar">
        <button class="chip chip-btn active" data-tag="">全部</button>
        ${tags.map((t) => `<button class="chip chip-btn" data-tag="${esc(t)}">${esc(t)}</button>`).join("")}
      </div>
      <div id="paperGrid" class="paper-grid"></div>
    </div>
  `;

  const grid = el.querySelector("#paperGrid");
  const search = el.querySelector("#paperSearch");
  let activeTag = "";

  function cardHTML(p) {
    const audit = p.audit || {};
    const ok = audit.status === "pass";
    return `
      <a class="paper-card" href="#/paper/${esc(p.slug)}">
        <div class="paper-card-top">
          <span class="badge ${ok ? "badge-ok" : "badge-warn"}" title="证据审计：${esc(audit.status || "unknown")} · locator: ${esc(audit.locator_mode || "-")}">
            ${ok ? "✓ 审计通过" : "⚠ " + esc(audit.status || "未审计")}
          </span>
          <span class="muted small">${fmtDate(p.date)}</span>
        </div>
        <div class="paper-title">${esc(p.title)}</div>
        <div class="muted small">${esc(p.journal || "")}${p.year ? " · " + esc(p.year) : ""}${p.doi ? ` · <span class="mono">${esc(p.doi)}</span>` : ""}</div>
        ${p.summary ? `<p class="paper-summary">${esc(p.summary)}</p>` : ""}
        <div class="tagrow">${(p.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>
      </a>`;
  }

  function apply() {
    const q = search.value.trim().toLowerCase();
    const list = papers.filter((p) => {
      if (activeTag && !(p.tags || []).includes(activeTag)) return false;
      if (!q) return true;
      const hay = [p.title, p.journal, p.doi, p.summary, ...(p.tags || []), ...(p.keywords || [])]
        .join(" ").toLowerCase();
      return hay.includes(q);
    });
    grid.innerHTML = list.length
      ? list.map(cardHTML).join("")
      : `<div class="empty">没有匹配的文献。${papers.length === 0 ? "把精读卡放入 content/papers/&lt;slug&gt;/ 目录并 push，即可自动出现在这里（见仓库 README）。" : ""}</div>`;
  }

  search.addEventListener("input", apply);
  el.querySelector("#tagBar").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tag]");
    if (!btn) return;
    activeTag = btn.dataset.tag;
    el.querySelectorAll("#tagBar .chip-btn").forEach((b) => b.classList.toggle("active", b === btn));
    apply();
  });

  apply();
}
