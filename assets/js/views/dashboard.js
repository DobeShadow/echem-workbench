// 仪表盘：渐变 Hero、统计、研究方向、待读文献、最近动态、快捷入口

import { S, CONFIG, nav } from "../state.js";
import { all, getLastBackup } from "../store.js";
import { esc, icon, fmtDate, fmtDateTime, dateISO } from "../util.js";

export async function render(el, ctx) {
  const papers = S.index ? S.index.papers : [];
  const [exps, tasks, ideas, reading, lastBackup] = await Promise.all([
    all("experiments"),
    all("tasks"),
    all("ideas"),
    all("papers_list"),
    getLastBackup(),
  ]);
  if (ctx && ctx.seq !== nav.seq) return;

  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const toRead = reading.filter((r) => r.status !== "done");
  const backupDays = lastBackup ? Math.floor((Date.now() - new Date(lastBackup)) / 864e5) : null;
  const needBackup = !lastBackup || backupDays >= 14;

  const recentPapers = [...papers]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 3);
  const recentExps = [...exps]
    .sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""))
    .slice(0, 3);
  const nextReads = toRead
    .sort((a, b) => (a.priority || 2) - (b.priority || 2))
    .slice(0, 3);

  const now = new Date();
  const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][now.getDay()];
  const hour = now.getHours();
  const greet = hour < 6 ? "夜深了" : hour < 11 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";

  el.innerHTML = `
    <div class="page">
      <div class="hero">
        <div class="hero-date">${dateISO(now)}<br>${week}</div>
        <h1>${greet}${CONFIG.userName ? "，" + esc(CONFIG.userName) : ""} 👋</h1>
        <p>${esc(CONFIG.tagline || "")} · 今天也要推进实验和文献呀</p>
      </div>

      ${needBackup ? `
      <div class="banner banner-warn">
        <span>${icon("db")} 实验数据${lastBackup ? `已 ${backupDays} 天` : ""}未备份，所有记录只存在当前浏览器里。</span>
        <a class="btn btn-small" href="#/settings">去备份</a>
      </div>` : ""}

      ${S.indexError ? `
      <div class="banner banner-warn">
        <span>⚠️ 文献索引加载失败（${esc(S.indexError.message)}）。请通过 HTTP 服务访问本站。</span>
      </div>` : ""}

      <div class="stat-grid">
        <a class="stat" href="#/papers"><span class="stat-ico">${icon("book")}</span><span><span class="stat-num">${papers.length}</span><br><span class="stat-label">精读卡</span></span></a>
        <a class="stat" href="#/reading"><span class="stat-ico">${icon("bookmark")}</span><span><span class="stat-num">${toRead.length}</span><br><span class="stat-label">待读文献</span></span></a>
        <a class="stat" href="#/lab"><span class="stat-ico">${icon("flask")}</span><span><span class="stat-num">${exps.length}</span><br><span class="stat-label">实验记录</span></span></a>
        <a class="stat" href="#/board"><span class="stat-ico">${icon("kanban")}</span><span><span class="stat-num">${openTasks}</span><br><span class="stat-label">未完成任务</span></span></a>
      </div>

      <div class="grid-2">
        <section class="card">
          <h2>研究方向</h2>
          <div class="directions">
            ${CONFIG.directions.map((d) => `
              <div class="direction" style="--dir-color:${esc(d.color || "#3b5bfd")}">
                <div class="direction-name">${esc(d.name)}</div>
                <div class="muted small">${esc(d.detail || "")}</div>
              </div>`).join("") || '<p class="muted">在 assets/config.js 中配置研究方向</p>'}
          </div>
        </section>
        <section class="card">
          <h2>快捷入口</h2>
          <div class="quicklinks">
            ${CONFIG.quickLinks.map((q) => `
              <a class="quicklink" href="${esc(q.url)}" target="_blank" rel="noopener noreferrer">${esc(q.label)}${icon("external")}</a>`).join("")}
          </div>
          <h2 style="margin-top:18px">常用工具</h2>
          <div class="quicklinks">
            <a class="quicklink" href="#/tools">${icon("calc")}RHE 换算</a>
            <a class="quicklink" href="#/tools">${icon("calc")}过电位 η</a>
            <a class="quicklink" href="#/tools">${icon("calc")}法拉第效率</a>
            <a class="quicklink" href="#/tools">${icon("calc")}ECSA</a>
            <a class="quicklink" href="#/plots">${icon("chart")}画数据图</a>
          </div>
        </section>
      </div>

      <div class="grid-2">
        <section class="card">
          <h2>最近精读 <a class="head-link" href="#/papers">全部 →</a></h2>
          ${recentPapers.length ? recentPapers.map((p) => `
            <a class="list-item" href="#/paper/${esc(p.slug)}">
              <div class="item-title">${esc(p.title)}</div>
              <div class="muted small">${esc(p.journal || "")}${p.year ? " · " + esc(p.year) : ""}${p.date ? " · " + fmtDate(p.date) : ""}</div>
            </a>`).join("") : `<p class="muted">还没有精读卡，把 paper-card.md 放入 content/papers/&lt;slug&gt;/ 即可。</p>`}
        </section>
        <section class="card">
          <h2>待读队列 <a class="head-link" href="#/reading">文献速录 →</a></h2>
          ${nextReads.length ? nextReads.map((r) => `
            <div class="list-item">
              <div class="item-title">${esc(r.title || r.doi || "（未命名）")}</div>
              <div class="muted small">${esc(r.journal || "")}${r.year ? " · " + esc(r.year) : ""} · 优先级：${({ 1: "高", 2: "中", 3: "低" })[Number(r.priority) || 2]}</div>
            </div>`).join("") : `<p class="muted">待读队列为空。粘贴 DOI 到「文献速录」自动建档。</p>`}
        </section>
      </div>

      <section class="card">
        <h2>最近实验 <a class="head-link" href="#/lab">全部 →</a></h2>
        ${recentExps.length ? recentExps.map((x) => `
          <a class="list-item" href="#/lab">
            <div class="item-title">${esc(x.title || "未命名实验")}${x.sampleId ? ` <span class="chip">${esc(x.sampleId)}</span>` : ""}</div>
            <div class="muted small">${esc(x.method || "")}${x.date ? " · " + fmtDate(x.date) : ""} · 更新于 ${fmtDateTime(x.updatedAt || x.createdAt)}</div>
          </a>`).join("") : `<p class="muted">还没有实验记录，去「实验记录」用模板快速创建第一条合成实验。</p>`}
      </section>
    </div>
  `;
}
