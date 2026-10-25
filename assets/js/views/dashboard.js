// 仪表盘：统计、研究方向、最近动态、快捷入口

import { S, CONFIG, nav } from "../state.js";
import { all, getLastBackup } from "../store.js";
import { esc, fmtDate, fmtDateTime, toast } from "../util.js";

export async function render(el, ctx) {
  const papers = S.index ? S.index.papers : [];
  const [exps, tasks, ideas, lastBackup] = await Promise.all([
    all("experiments"),
    all("tasks"),
    all("ideas"),
    getLastBackup(),
  ]);
  if (ctx && ctx.seq !== nav.seq) return;

  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const backupDays = lastBackup ? Math.floor((Date.now() - new Date(lastBackup)) / 864e5) : null;
  const needBackup = !lastBackup || backupDays >= 14;

  const recentPapers = [...papers]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 3);
  const recentExps = [...exps]
    .sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""))
    .slice(0, 3);

  el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>你好${CONFIG.userName ? "，" + esc(CONFIG.userName) : ""} 👋</h1>
          <p class="muted">${esc(CONFIG.tagline || "")} · 数据保存在本浏览器，记得定期备份</p>
        </div>
      </div>

      ${needBackup ? `
      <div class="banner banner-warn">
        <span>⚠️ 实验数据${lastBackup ? `已 ${backupDays} 天` : ""}未备份。所有记录只存在当前浏览器里。</span>
        <a class="btn btn-small" href="#/settings">去备份</a>
      </div>` : ""}

      ${S.indexError ? `
      <div class="banner banner-warn">
        <span>⚠️ 文献索引加载失败（${esc(S.indexError.message)}）。请通过 HTTP 服务访问本站（本地用 <code>python -m http.server</code>）。</span>
      </div>` : ""}

      <div class="stat-grid">
        <a class="stat" href="#/papers"><div class="stat-num">${papers.length}</div><div class="stat-label">精读卡</div></a>
        <a class="stat" href="#/lab"><div class="stat-num">${exps.length}</div><div class="stat-label">实验记录</div></a>
        <a class="stat" href="#/board"><div class="stat-num">${openTasks}</div><div class="stat-label">未完成任务</div></a>
        <a class="stat" href="#/board?tab=ideas"><div class="stat-num">${ideas.length}</div><div class="stat-label">想法</div></a>
      </div>

      <div class="grid-2">
        <section class="card">
          <h2>研究方向</h2>
          <div class="directions">
            ${CONFIG.directions.map((d) => `
              <div class="direction" style="--dir-color:${esc(d.color || "#2563eb")}">
                <div class="direction-name">${esc(d.name)}</div>
                <div class="muted small">${esc(d.detail || "")}</div>
              </div>`).join("") || '<p class="muted">在 assets/config.js 中配置研究方向</p>'}
          </div>
        </section>
        <section class="card">
          <h2>快捷入口</h2>
          <div class="quicklinks">
            ${CONFIG.quickLinks.map((q) => `
              <a class="quicklink" href="${esc(q.url)}" target="_blank" rel="noopener noreferrer">${esc(q.label)} ↗</a>`).join("")}
          </div>
        </section>
      </div>

      <div class="grid-2">
        <section class="card">
          <h2>最近文献 <a class="head-link" href="#/papers">全部 →</a></h2>
          ${recentPapers.length ? recentPapers.map((p) => `
            <a class="list-item" href="#/paper/${esc(p.slug)}">
              <div class="item-title">${esc(p.title)}</div>
              <div class="muted small">${esc(p.journal || "")}${p.year ? " · " + esc(p.year) : ""}${p.date ? " · " + fmtDate(p.date) : ""}</div>
            </a>`).join("") : '<p class="muted">还没有精读卡。把 paper-card.md 放入 content/papers/&lt;slug&gt;/ 后 push 即自动上线。</p>'}
        </section>
        <section class="card">
          <h2>最近实验 <a class="head-link" href="#/lab">全部 →</a></h2>
          ${recentExps.length ? recentExps.map((x) => `
            <a class="list-item" href="#/lab">
              <div class="item-title">${esc(x.title || "未命名实验")}${x.sampleId ? ` <span class="chip">${esc(x.sampleId)}</span>` : ""}</div>
              <div class="muted small">${esc(x.method || "")}${x.date ? " · " + fmtDate(x.date) : ""} · 更新于 ${fmtDateTime(x.updatedAt || x.createdAt)}</div>
            </a>`).join("") : '<p class="muted">还没有实验记录，去「实验记录」创建第一条合成实验吧。</p>'}
        </section>
      </div>
    </div>
  `;
}
