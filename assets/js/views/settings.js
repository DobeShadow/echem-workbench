// 设置：备份/恢复、数据统计、关于

import { all, exportAll, importAll, getLastBackup, setLastBackup, wipeAll } from "../store.js";
import { S, nav } from "../state.js";
import { esc, fmtDateTime, toast, confirmDialog, download } from "../util.js";

export async function render(el, ctx) {
  const [exps, tasks, ideas, plots, lastBackup] = await Promise.all([
    all("experiments"), all("tasks"), all("ideas"), all("plots"), getLastBackup(),
  ]);
  if (ctx.seq !== nav.seq) return;
  const papers = S.index ? S.index.papers.length : 0;

  el.innerHTML = `
    <div class="page page-narrow">
      <div class="page-head"><h1>设置</h1></div>

      <section class="card">
        <h2>数据备份（重要）</h2>
        <p class="muted small">实验记录、任务、想法、图表全部保存在<strong>当前浏览器的 IndexedDB</strong> 里——不会自动同步、不会上传。
        清理浏览器数据或换电脑都会丢失，请养成导出备份的习惯（建议每周随周报一起导出）。</p>
        <p class="small">上次备份：<b>${lastBackup ? esc(fmtDateTime(lastBackup)) : "从未备份"}</b></p>
        <div class="toolbar">
          <button id="exportBtn" class="btn btn-primary">导出全部数据（JSON）</button>
          <label class="btn">导入备份<input id="importFile" type="file" accept=".json" hidden></label>
        </div>
      </section>

      <section class="card">
        <h2>本地数据统计</h2>
        <div class="stat-grid stat-grid-4">
          <div class="stat"><div class="stat-num">${papers}</div><div class="stat-label">精读卡（仓库）</div></div>
          <div class="stat"><div class="stat-num">${exps.length}</div><div class="stat-label">实验记录</div></div>
          <div class="stat"><div class="stat-num">${tasks.length}</div><div class="stat-label">任务</div></div>
          <div class="stat"><div class="stat-num">${ideas.length + plots.length}</div><div class="stat-label">想法+图表</div></div>
        </div>
      </section>

      <section class="card danger-zone">
        <h2>危险区</h2>
        <div class="toolbar">
          <button id="wipeBtn" class="btn btn-danger">清空本地全部数据</button>
        </div>
        <p class="muted small">仅在确认已有备份后使用。清空不可恢复。</p>
      </section>

      <section class="card">
        <h2>关于</h2>
        <p class="small">
          电催化工作台 v1.0 · 纯静态站点，部署于 GitHub Pages ·
          <a href="https://github.com/DobeShadow/echem-workbench" target="_blank" rel="noopener noreferrer">GitHub 仓库 ↗</a>
        </p>
        <p class="muted small">
          依赖（本地内置，MIT 许可）：Chart.js、marked。设计借鉴 al-folio / grad-research-workbench / memos / ElectroChem 等开源项目的思路，代码为本项目原创。
        </p>
        <p class="muted small">隐私边界：精读笔记等仓库内容是公开的；实验数据等未发表内容只存浏览器本地，永不写入公开仓库。</p>
      </section>
    </div>`;

  el.querySelector("#exportBtn").addEventListener("click", async () => {
    const data = await exportAll();
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    download(`workbench-backup-${stamp}.json`, JSON.stringify(data, null, 2), "application/json");
    await setLastBackup();
    toast("已导出备份，请妥善保存到本地磁盘");
    setTimeout(() => (location.hash = "#/settings"), 600);
  });

  el.querySelector("#importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirmDialog("导入将覆盖当前所有本地数据（实验记录/任务/想法/图表）。确定继续？")) return;
    try {
      await importAll(JSON.parse(await file.text()));
      await setLastBackup();
      toast("备份已恢复");
      setTimeout(() => (location.hash = "#/settings"), 600);
    } catch (err) {
      toast("导入失败：" + err.message, "warn");
    }
  });

  el.querySelector("#wipeBtn").addEventListener("click", async () => {
    if (!confirmDialog("将清空本地全部数据（实验记录/任务/想法/图表）。确定继续？")) return;
    if (!confirmDialog("再次确认：此操作不可恢复，真的要清空吗？")) return;
    await wipeAll();
    toast("已清空", "warn");
    setTimeout(() => (location.hash = "#/settings"), 600);
  });
}
