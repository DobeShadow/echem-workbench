// 数据绘图：上传电化学数据 CSV/TXT，多曲线叠加，图表存本地

import { all, put, del } from "../store.js";
import { nav } from "../state.js";
import { esc, uuid, toast, confirmDialog, fmtDateTime } from "../util.js";

const PALETTE = ["#2563eb", "#d97706", "#0891b2", "#7c3aed", "#dc2626", "#059669", "#db2777", "#65a30d"];
let chart = null;
let curves = [];
let table = null; // {header:[], rows:[[]]}

function detectDelimiter(lines) {
  const sample = lines.slice(0, 60);
  let best = null, bestCount = 0;
  for (const s of [",", "\t", ";"]) {
    const c = sample.reduce((n, l) => n + (l.split(s).length - 1), 0);
    if (c > bestCount) { best = s; bestCount = c; }
  }
  return best;
}

function parseTable(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
  const sep = detectDelimiter(lines);
  const split = (l) => (sep ? l.split(sep) : l.split(/\s+/)).map((c) => c.trim());
  const isNum = (v) => v !== "" && isFinite(Number(v));

  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const cells = split(lines[i]);
    if (cells.length >= 2 && cells.filter(isNum).length >= 2) { start = i; break; }
  }
  if (start < 0) throw new Error("没有找到数值数据行");

  let header = null;
  if (start > 0) {
    const prev = split(lines[start - 1]);
    if (prev.some((c) => !isNum(c))) header = prev;
  }
  const rows = [];
  for (let i = start; i < lines.length; i++) {
    const cells = split(lines[i]);
    if (cells.length >= 2) rows.push(cells);
  }
  const width = Math.max(...rows.map((r) => r.length));
  if (!header || header.length < width) {
    header = Array.from({ length: width }, (_, i) => (header && header[i] && !isNum(header[i]) ? header[i] : `列${i + 1}`));
  }
  return { header, rows };
}

export async function render(el, ctx) {
  const saved = await all("plots");
  if (ctx && ctx.seq !== nav.seq) return;

  el.innerHTML = `
    <div class="page">
      <div class="page-head"><h1>数据绘图</h1>
        <p class="muted">上传 CV / LSV / FE 等数据文件（CSV/TXT），数据仅在本地处理</p></div>

      <div class="grid-2-1">
        <section class="card">
          <div class="toolbar">
            <input type="file" id="plotFile" accept=".csv,.txt,.dat" class="input">
          </div>
          <div id="tablePreview" class="table-wrap"><p class="muted">尚未导入数据</p></div>
          <div id="colPick" class="colpick" hidden>
            <div class="form-row form-row-3">
              <div><label>X 轴数据列</label><select id="xCol" class="input"></select></div>
              <div><label>Y 轴数据列（可多选）</label><select id="yCol" class="input" multiple size="4"></select></div>
              <div><label>曲线名称（可留空）</label><input id="seriesName" class="input" placeholder="留空则用表头/文件名"></div>
            </div>
            <div class="form-row form-row-3">
              <div><label>X 轴标签</label><input id="xLabel" class="input" value="电位 E (V vs. RHE)"></div>
              <div><label>Y 轴标签</label><input id="yLabel" class="input" value="电流密度 j (mA cm⁻²)"></div>
              <div><label>颜色</label><input id="seriesColor" type="color" class="input input-color" value="${PALETTE[curves.length % PALETTE.length]}"></div>
            </div>
            <div class="toolbar" style="justify-content:flex-end"><button id="addCurve" class="btn btn-primary">＋ 添加曲线</button></div>
            <p class="muted small">选中一个 X 列和一至多个 Y 列后添加曲线；曲线名留空时自动取表头或文件名。可重复导入不同文件叠图对比。</p>
          </div>
        </section>

        <section class="card">
          <h2>图库（本地保存）</h2>
          <div id="savedPlots" class="savedlist"></div>
          <div class="toolbar">
            <input id="plotSaveName" class="input" placeholder="当前图表保存名称">
            <button id="savePlot" class="btn">保存当前图表</button>
          </div>
        </section>
      </div>

      <section class="card">
        <h2>图表</h2>
        <div class="chart-wrap"><canvas id="plotCanvas"></canvas></div>
        <div id="curveList" class="curvelist"></div>
        <div class="toolbar" id="exportBar" hidden>
          <button id="exportPNG" class="btn btn-primary">导出 PNG 图片</button>
          <button id="exportCSV" class="btn">导出合并数据 CSV</button>
          <button id="clearCurves" class="btn btn-danger">清空曲线</button>
          <label class="check-inline"><input type="checkbox" id="logY"> Y 轴对数（全正值数据时可用）</label>
        </div>
      </section>
    </div>`;

  const canvas = el.querySelector("#plotCanvas");
  const ctx2d = canvas.getContext("2d");

  function renderChart() {
    const xLabel = el.querySelector("#xLabel").value;
    const yLabel = el.querySelector("#yLabel").value;
    const logY = el.querySelector("#logY").checked &&
      curves.every((c) => c.points.every((p) => p.y > 0));
    if (chart) chart.destroy();
    chart = new Chart(ctx2d, {
      type: "line",
      data: {
        datasets: curves.map((c, i) => ({
          label: c.name,
          data: c.points,
          borderColor: c.color || PALETTE[i % PALETTE.length],
          backgroundColor: "transparent",
          pointRadius: 0,
          borderWidth: 2,
          tension: 0,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        interaction: { mode: "nearest", intersect: false },
        scales: {
          x: { type: "linear", title: { display: !!xLabel, text: xLabel } },
          y: { type: logY ? "logarithmic" : "linear", title: { display: !!yLabel, text: yLabel } },
        },
        plugins: { legend: { display: curves.length > 1, position: "bottom" } },
      },
    });
    renderCurveList();
  }

  function renderCurveList() {
    const listEl = el.querySelector("#curveList");
    listEl.innerHTML = curves.length
      ? curves.map((c, i) => `
        <span class="curvetag" style="--c:${c.color}">
          <i></i>${esc(c.name)}（${c.points.length} 点）
          <button data-i="${i}" class="curve-del" title="移除">✕</button></span>`).join("")
      : '<p class="muted small">尚无曲线。导入文件后选列添加。</p>';
    el.querySelector("#exportBar").hidden = curves.length === 0;
  }

  // 导入文件
  el.querySelector("#plotFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      table = parseTable(await file.text());
      const preview = el.querySelector("#tablePreview");
      const cols = Math.min(table.header.length, 8);
      preview.innerHTML = `<table class="table">
        <thead><tr>${table.header.slice(0, cols).map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${table.rows.slice(0, 6).map((r) => `<tr>${r.slice(0, cols).map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
        <p class="muted small">共 ${table.rows.length} 行 × ${table.header.length} 列${table.rows.length > 6 ? "（预览前 6 行）" : ""}</p>`;
      el.querySelector("#colPick").hidden = false;
      const opts = table.header.map((h, i) => `<option value="${i}">${esc(h)}</option>`).join("");
      el.querySelector("#xCol").innerHTML = opts;
      const ySel = el.querySelector("#yCol");
      ySel.innerHTML = opts;
      if (table.header.length > 1) ySel.options[1].selected = true;
      el.dataset.fileName = file.name;
    } catch (err) {
      toast("解析失败：" + err.message, "warn");
    }
  });

  // 添加曲线
  el.querySelector("#addCurve").addEventListener("click", () => {
    if (!table) { toast("请先导入数据文件", "warn"); return; }
    const xi = Number(el.querySelector("#xCol").value);
    const ySel = el.querySelector("#yCol");
    const ys = [...ySel.selectedOptions].map((o) => Number(o.value));
    if (!ys.length) { toast("请选择至少一个 Y 轴数据列", "warn"); return; }
    const baseName = el.querySelector("#seriesName").value.trim();
    const color0 = el.querySelector("#seriesColor").value || PALETTE[curves.length % PALETTE.length];
    let added = 0;
    ys.forEach((yi) => {
      const points = [];
      for (const row of table.rows) {
        const x = Number(row[xi]);
        const y = Number(row[yi]);
        if (isFinite(x) && isFinite(y)) points.push({ x, y });
      }
      if (points.length < 2) return;
      const colName = table.header[yi] || "曲线" + (curves.length + 1);
      curves.push({
        name: ys.length > 1 ? (baseName ? baseName + " · " : "") + colName : (baseName || `${colName} · ${el.dataset.fileName || "数据"}`),
        color: added === 0 ? color0 : PALETTE[curves.length % PALETTE.length],
        points,
      });
      added++;
    });
    if (!added) { toast("所选 Y 列可用数据点不足", "warn"); return; }
    el.querySelector("#seriesName").value = "";
    el.querySelector("#seriesColor").value = PALETTE[curves.length % PALETTE.length];
    renderChart();
    toast(`已添加 ${added} 条曲线`);
  });

  // 曲线列表删除
  el.querySelector("#curveList").addEventListener("click", (e) => {
    const btn = e.target.closest(".curve-del");
    if (!btn) return;
    curves.splice(Number(btn.dataset.i), 1);
    renderChart();
  });

  // 保存 / 加载 / 删除
  el.querySelector("#savePlot").addEventListener("click", async () => {
    if (!curves.length) { toast("当前没有曲线可保存", "warn"); return; }
    const name = el.querySelector("#plotSaveName").value.trim() || "未命名图表 " + fmtDateTime(new Date());
    await put("plots", {
      id: uuid(), name, createdAt: new Date().toISOString(),
      axis: { x: el.querySelector("#xLabel").value, y: el.querySelector("#yLabel").value },
      curves: JSON.parse(JSON.stringify(curves)),
    });
    toast("已保存到本地图库");
    await refreshSaved();
  });

  async function refreshSaved() {
    const list = (await all("plots")).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    el.querySelector("#savedPlots").innerHTML = list.length
      ? list.map((p) => `
        <div class="saved-item">
          <span class="item-title">${esc(p.name)}</span>
          <span class="muted small">${fmtDateTime(p.createdAt)} · ${p.curves.length} 曲线</span>
          <span class="saved-actions">
            <button data-load="${esc(p.id)}" class="btn btn-small">载入</button>
            <button data-del="${esc(p.id)}" class="btn btn-small btn-danger">删</button>
          </span>
        </div>`).join("")
      : '<p class="muted small">暂无保存的图表。调好曲线后可保存，下次直接载入。</p>';
    saved.splice(0, saved.length, ...list);
  }

  el.querySelector("#savedPlots").addEventListener("click", async (e) => {
    const loadBtn = e.target.closest("[data-load]");
    const delBtn = e.target.closest("[data-del]");
    if (loadBtn) {
      const p = (await all("plots")).find((x) => x.id === loadBtn.dataset.load);
      if (!p) return;
      curves = JSON.parse(JSON.stringify(p.curves || []));
      el.querySelector("#xLabel").value = p.axis?.x || "电位 E (V vs. RHE)";
      el.querySelector("#yLabel").value = p.axis?.y || "电流密度 j (mA cm⁻²)";
      el.querySelector("#plotSaveName").value = p.name;
      renderChart();
      toast("已载入「" + p.name + "」");
    }
    if (delBtn) {
      if (!confirmDialog("删除这个保存的图表？")) return;
      await del("plots", delBtn.dataset.del);
      await refreshSaved();
    }
  });

  // 导出 / 清空
  el.querySelector("#exportPNG").addEventListener("click", () => {
    if (!chart) { toast("当前没有图表", "warn"); return; }
    const a = document.createElement("a");
    a.href = chart.toBase64Image("image/png", 1);
    a.download = "plot-" + new Date().toISOString().slice(0, 10) + ".png";
    a.click();
    toast("已导出 PNG（可直接贴进组会 PPT / 周报）");
  });
  el.querySelector("#logY").addEventListener("change", renderChart);
  el.querySelector("#exportCSV").addEventListener("click", () => {
    const maxLen = Math.max(...curves.map((c) => c.points.length));
    const head = ["x_" + curves[0].name, "y_" + curves[0].name,
      ...curves.slice(1).flatMap((c) => ["x_" + c.name, "y_" + c.name])];
    const lines = [head.join(",")];
    for (let i = 0; i < maxLen; i++) {
      lines.push(curves.map((c) => {
        const p = c.points[i];
        return p ? `${p.x},${p.y}` : ",";
      }).join(","));
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = "curves-export.csv";
    a.click();
  });
  el.querySelector("#clearCurves").addEventListener("click", () => {
    if (curves.length && !confirmDialog("清空所有曲线？")) return;
    curves = [];
    renderChart();
  });

  el.querySelector("#xLabel").addEventListener("change", renderChart);
  el.querySelector("#yLabel").addEventListener("change", renderChart);

  renderChart();
  await refreshSaved();
}
