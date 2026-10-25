// 精读卡详情：渲染 markdown、章节目录、图片与原文页浏览

import { S, nav } from "../state.js";
import { renderMarkdown } from "../md.js";
import { esc, fmtDate } from "../util.js";

export async function render(el, ctx) {
  const slug = ctx.arg;
  const entry = S.index && S.index.papers.find((p) => p.slug === slug);
  if (!entry) {
    el.innerHTML = `<div class="page"><div class="empty">
      没有找到精读卡 <code>${esc(slug || "")}</code>。<br>
      可能它被标记为 private，或索引尚未构建（push 后由 Actions 自动构建）。
      <br><br><a class="btn" href="#/papers">返回文献库</a></div></div>`;
    return;
  }

  const base = `content/papers/${slug}/`;
  const audit = entry.audit || {};
  const ok = audit.status === "pass";

  el.innerHTML = `
    <div class="page page-wide">
      <a class="back" href="#/papers">← 返回文献库</a>
      <header class="paper-head">
        <h1>${esc(entry.title)}</h1>
        <div class="paper-meta">
          ${entry.journal ? `<span class="chip">${esc(entry.journal)}${entry.year ? " · " + esc(entry.year) : ""}</span>` : ""}
          ${entry.doi ? `<a class="chip chip-link" href="https://doi.org/${esc(entry.doi)}" target="_blank" rel="noopener noreferrer">DOI: ${esc(entry.doi)} ↗</a>` : ""}
          <span class="badge ${ok ? "badge-ok" : "badge-warn"}" title="证据审计 ${esc(audit.status || "-")} · 通过 ${audit.passes ?? "-"} / 警告 ${audit.warnings ?? "-"} / 错误 ${audit.errors ?? "-"} · ${esc(audit.locator_mode || "")}">
            ${ok ? "✓ 证据审计通过" : "⚠ 证据审计: " + esc(audit.status || "未审计")}
          </span>
          ${(entry.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}
          ${entry.date ? `<span class="muted small">收录 ${fmtDate(entry.date)}</span>` : ""}
        </div>
      </header>

      <div class="paper-layout">
        <aside class="toc card">
          <div class="toc-title">目录</div>
          <a data-anchor="sec-glossary">术语表</a>
          ${(entry.sections || []).map((s) => `<a data-anchor="sec-${esc(s.num)}">${esc(s.num)} ${esc(s.title)}</a>`).join("")}
        </aside>
        <article class="card paper-body"><div class="loading">加载精读卡…</div></article>
      </div>

      ${(entry.figures || []).length ? `
      <section class="card">
        <h2>文献图片（figures/）</h2>
        <div class="imggrid">
          ${entry.figures.map((f) => `
            <figure><img loading="lazy" src="${base}figures/${esc(f)}" alt="${esc(f)}"
              data-full="${base}figures/${esc(f)}"><figcaption>${esc(f)}</figcaption></figure>`).join("")}
        </div>
      </section>` : ""}

      ${entry.pages && (entry.pages.main || []).length ? `
      <section class="card">
        <h2>主文原文页（点击看大图）</h2>
        <div class="imggrid pages">
          ${entry.pages.main.map((f) => `
            <figure><img loading="lazy" src="${base}rendered-pages/${esc(f)}" alt="${esc(f)}"
              data-full="${base}rendered-pages/${esc(f)}"><figcaption>${esc(f)}</figcaption></figure>`).join("")}
        </div>
      </section>` : ""}

      ${entry.pages && (entry.pages.si || []).length ? `
      <section class="card">
        <h2>补充材料 SI 原文页（点击看大图）</h2>
        <div class="imggrid pages">
          ${entry.pages.si.map((f) => `
            <figure><img loading="lazy" src="${base}si-rendered-pages/${esc(f)}" alt="${esc(f)}"
              data-full="${base}si-rendered-pages/${esc(f)}"><figcaption>${esc(f)}</figcaption></figure>`).join("")}
        </div>
      </section>` : ""}
    </div>
  `;

  // 目录滚动
  el.querySelector(".toc").addEventListener("click", (e) => {
    const a = e.target.closest("[data-anchor]");
    if (!a) return;
    const target = el.querySelector("#" + CSS.escape(a.dataset.anchor));
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", "#/paper/" + slug);
    }
  });

  // 图片点击放大
  el.addEventListener("click", (e) => {
    const img = e.target.closest("img[data-full]");
    if (img) window.open(img.dataset.full, "_blank");
  });

  // 正文 markdown（异步写回前确认本次渲染未被更新的路由取代）
  try {
    const r = await fetch(base + "paper-card.md");
    if (!r.ok) throw new Error("HTTP " + r.status);
    const text = await r.text();
    if (ctx.seq !== nav.seq) return;
    const body = el.querySelector(".paper-body");
    if (!body) return;
    body.innerHTML = "";
    body.appendChild(renderMarkdown(text, { basePath: base }));
  } catch (e) {
    if (ctx.seq !== nav.seq) return;
    const body = el.querySelector(".paper-body");
    if (!body) return;
    body.innerHTML =
      `<p class="muted">精读卡内容加载失败（${esc(e.message)}）。请通过 HTTP 访问本站。</p>`;
  }
}
