// 实验记录：电催化合成实验的结构化记录（仅存本地 IndexedDB）
// v2：合成方法模板快速填充、表征图片附件（本地压缩存储）、关联文献

import { all, put, del } from "../store.js";
import { S, nav } from "../state.js";
import { esc, icon, todayISO, uuid, toast, confirmDialog, fmtDate } from "../util.js";

const STATUSES = ["计划", "进行中", "已完成", "搁置"];
const statusColor = (s) =>
  ({ 计划: "chip-gray", 进行中: "chip-blue", 已完成: "chip-green", 搁置: "chip-amber" }[s] || "chip-gray");

// 合成方法模板：快速填充骨架提示
const TEMPLATES = {
  "水热/溶剂热": {
    precursors: "例：Ni(NO₃)₂·6H₂O ___ mmol + Fe(NO₃)₃·9H₂O ___ mmol + 尿素 ___ mmol，溶于 __ mL 去离子水/乙醇",
    conditions: "例：__ mL 内衬聚四氟乙烯反应釜，___ °C 保温 __ h；升温速率 __ °C/min；自然冷却",
    postTreat: "例：去离子水/乙醇交替离心洗涤 3 次，__ °C 真空干燥 __ h；__ °C 下 Ar 气氛退火 __ h",
  },
  "电沉积": {
    precursors: "例：电解液 __ M MSO₄ + __ M 支持电解质，pH ≈ __；工作电极：泡沫镍 __ cm²，对电极 Pt 片",
    conditions: "例：恒电流 __ mA cm⁻² 沉积 __ s（或恒电位 __ V vs. 参比）；磁力搅拌 ___ rpm",
    postTreat: "例：去离子水轻洗，室温真空干燥 __ h；__ °C 退火 __ h（如需要）",
  },
  "浸渍-焙烧": {
    precursors: "例：载体 __ g，金属盐 __ g 溶于 __ mL 去离子水，等体积浸渍 __ h",
    conditions: "例：80 °C 水浴蒸干，120 °C 干燥 12 h",
    postTreat: "例：空气中 __ °C 焙烧 __ h（升温 __ °C/min），__ °C H₂/N₂ 还原 __ h",
  },
  "CO₂RR 流动池电解": {
    precursors: "例：催化剂墨水 __ mg/mL（催化剂 : 水 : 乙醇 : Nafion = __ : __ : __ : __），滴涂于 GDE __ cm²",
    conditions: "例：阴极液 1 M KOH __ mL，阳极液同；CO₂ 流量 __ sccm；恒电流 __ mA cm⁻² 电解 __ h",
    postTreat: "例：尾气进 GC 每 __ min 进样一次；液体产物 ¹H NMR 定量（内标 DMSO __ mM）",
  },
};

/** 图片压缩为 dataURL（最长边 1280px，JPEG 82%） */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1280;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ name: file.name, data: canvas.toDataURL("image/jpeg", 0.82) });
      };
      img.onerror = () => reject(new Error("图片读取失败"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

export async function render(el, ctx) {
  if (ctx.params.get("new") === "1") return renderForm(el, null, ctx);
  await renderList(el, ctx);
}

async function renderList(el, ctx) {
  const params = ctx.params;
  const exps = await all("experiments");
  if (ctx.seq !== nav.seq) return;
  const sortDesc = (a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "");

  el.innerHTML = `
    <div class="page">
      <div class="page-head"><h1>实验记录</h1>
        <p class="muted">${exps.length} 条记录 · 仅保存在本浏览器，可在「设置」导出 JSON 备份</p></div>
      <div class="toolbar">
        <input id="labSearch" class="input" type="search" placeholder="搜索材料 / 样品编号 / 方法…">
        <select id="labStatus" class="input">
          <option value="">全部状态</option>
          ${STATUSES.map((s) => `<option ${params.get("status") === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
        <a class="btn btn-primary" href="#/lab?new=1">${icon("plus")}新建实验</a>
      </div>
      <div id="labGrid" class="lab-grid"></div>
    </div>`;

  const grid = el.querySelector("#labGrid");
  const search = el.querySelector("#labSearch");
  const statusSel = el.querySelector("#labStatus");

  function apply() {
    const q = search.value.trim().toLowerCase();
    const st = statusSel.value;
    const list = exps
      .filter((x) => (!st || x.status === st))
      .filter((x) => {
        if (!q) return true;
        return [x.title, x.sampleId, x.method, x.conclusion, ...(x.tags || [])]
          .join(" ").toLowerCase().includes(q);
      })
      .sort(sortDesc);
    grid.innerHTML = list.length
      ? list.map((x) => `
        <a class="lab-card" href="#/lab?edit=${esc(x.id)}">
          <div class="lab-card-top">
            <span class="chip ${statusColor(x.status)}">${esc(x.status || "计划")}</span>
            ${x.sampleId ? `<span class="chip">${esc(x.sampleId)}</span>` : ""}
            ${(x.attachments || []).length ? `<span class="chip">${icon("image")}${x.attachments.length}</span>` : ""}
            <span class="muted small">${fmtDate(x.date)}</span>
          </div>
          <div class="item-title">${esc(x.title || "未命名实验")}</div>
          <div class="muted small">${esc(x.method || "未填方法")}</div>
          ${x.performance ? `<p class="lab-perf">${esc(x.performance.split("\n")[0])}</p>` : ""}
          <div class="tagrow">${(x.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>
        </a>`).join("")
      : `<div class="empty">${icon("flask")}还没有实验记录。<br>点「新建实验」，或用水热 / 电沉积 / CO₂RR 电解等模板快速建档。</div>`;
  }

  search.addEventListener("input", apply);
  statusSel.addEventListener("change", apply);
  apply();
}

export async function renderForm(el, existing, ctx) {
  let exp = existing;
  if (!exp) {
    const id = new URLSearchParams(location.hash.split("?")[1] || "").get("edit");
    if (id) {
      exp = (await all("experiments")).find((x) => x.id === id);
      if (!exp) { toast("没有找到该实验记录", "warn"); location.hash = "#/lab"; return; }
    }
  }
  if (ctx && ctx.seq !== nav.seq) return;

  const v = exp || {};
  let attachments = JSON.parse(JSON.stringify(v.attachments || []));
  const isNew = !exp;

  el.innerHTML = `
    <div class="page page-narrow">
      <a class="back" href="#/lab">返回列表</a>
      <div class="card">
        <h1 style="font-size:19px;margin:0 0 4px">${isNew ? "新建实验" : "编辑实验"}</h1>
        ${isNew ? `
        <div class="tmpl-bar">
          <span class="label">${icon("zap")} 模板快速填充：</span>
          ${Object.keys(TEMPLATES).map((k) => `<button class="btn btn-small" data-tmpl="${esc(k)}">${esc(k)}</button>`).join("")}
        </div>` : ""}
        <form id="labForm" class="form">
          <label>实验名称 / 目标材料 *</label>
          <input class="input" name="title" required value="${esc(v.title || "")}" placeholder="例：NiFe-LDH/CF 泡沫镍基底 OER 催化剂">
          <div class="form-row">
            <div><label>样品编号</label><input class="input" name="sampleId" value="${esc(v.sampleId || "")}" placeholder="例：S2026-001"></div>
            <div><label>实验日期</label><input class="input" type="date" name="date" value="${esc(v.date || todayISO())}"></div>
          </div>
          <div class="form-row">
            <div><label>合成方法</label>
              <input class="input" name="method" list="methodList" value="${esc(v.method || "")}" placeholder="水热 / 电沉积 / 浸渍…">
              <datalist id="methodList">${[...Object.keys(TEMPLATES), "共沉淀", "溶胶凝胶", "CVD", "球磨", "商业化", "其他"].map((m) => `<option value="${m}">`).join("")}</datalist>
            </div>
            <div><label>状态</label>
              <select class="input" name="status">${STATUSES.map((s) => `<option ${v.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
            </div>
          </div>
          <label>前驱体与配比</label>
          <textarea class="input" name="precursors" rows="3" placeholder="${esc(TEMPLATES["水热/溶剂热"].precursors)}">${esc(v.precursors || "")}</textarea>
          <label>合成条件（温度 / 时间 / pH / 气氛 / 电流密度等）</label>
          <textarea class="input" name="conditions" rows="3" placeholder="${esc(TEMPLATES["水热/溶剂热"].conditions)}">${esc(v.conditions || "")}</textarea>
          <label>后处理（洗涤 / 干燥 / 退火等）</label>
          <textarea class="input" name="postTreat" rows="2" placeholder="${esc(TEMPLATES["水热/溶剂热"].postTreat)}">${esc(v.postTreat || "")}</textarea>
          <label>表征结果（XRD / SEM / TEM / XPS …）</label>
          <textarea class="input" name="characterization" rows="3">${esc(v.characterization || "")}</textarea>
          <label>电化学性能</label>
          <textarea class="input" name="performance" rows="3" placeholder="例：η₁₀ = 268 mV；FE(CO) = 92% @ −0.9 V vs RHE；24 h 稳定性衰减 <5%">${esc(v.performance || "")}</textarea>
          <label>结论与下一步</label>
          <textarea class="input" name="conclusion" rows="2">${esc(v.conclusion || "")}</textarea>
          <div class="form-row">
            <div><label>标签（逗号分隔）</label><input class="input" name="tags" value="${esc((v.tags || []).join(", "))}" placeholder="OER, LDH, NiFe"></div>
            <div><label>受启发文献 DOI（可选）</label><input class="input" name="doi" value="${esc(v.doi || "")}" placeholder="10.xxxx/xxxxx"></div>
          </div>
          <label>表征 / 实验图片（自动压缩存本地，最多 9 张）</label>
          <div class="toolbar" style="margin-bottom:8px">
            <label class="btn" style="cursor:pointer">${icon("upload")}添加图片<input id="attachInput" type="file" accept="image/*" multiple hidden></label>
            <span class="muted small" id="attachHint"></span>
          </div>
          <div class="attach-grid" id="attachGrid"></div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${icon("check")}保存</button>
            ${exp ? `<button type="button" id="labDelete" class="btn btn-danger">${icon("trash")}删除</button>` : ""}
            <a class="btn" href="#/lab">取消</a>
          </div>
        </form>
      </div>
    </div>`;

  // 模板填充
  el.querySelectorAll("[data-tmpl]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = TEMPLATES[btn.dataset.tmpl];
      const f = el.querySelector("#labForm");
      if (!f.method.value) f.method.value = btn.dataset.tmpl;
      f.precursors.value = t.precursors;
      f.conditions.value = t.conditions;
      f.postTreat.value = t.postTreat;
      toast("已填充「" + btn.dataset.tmpl + "」模板骨架，替换其中的 ___ 参数即可");
    });
  });

  // 图片附件
  const grid = el.querySelector("#attachGrid");
  const hint = el.querySelector("#attachHint");
  function paintAttachments() {
    grid.innerHTML = attachments.map((a, i) => `
      <div class="attach-thumb">
        <img src="${a.data}" alt="${esc(a.name)}" data-view="${i}">
        <button type="button" data-rm="${i}" title="移除">✕</button>
      </div>`).join("");
    hint.textContent = attachments.length ? `已添加 ${attachments.length}/9 张` : "";
  }
  paintAttachments();

  el.querySelector("#attachInput").addEventListener("change", async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    for (const file of files) {
      if (attachments.length >= 9) { toast("最多 9 张图片", "warn"); break; }
      try {
        attachments.push(await compressImage(file));
      } catch (err) {
        toast(err.message, "warn");
      }
    }
    paintAttachments();
  });
  grid.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-rm]");
    if (rm) {
      attachments.splice(Number(rm.dataset.rm), 1);
      paintAttachments();
      return;
    }
    const img = e.target.closest("img[data-view]");
    if (img) openLightbox(attachments[Number(img.dataset.view)].data);
  });

  // 提交
  const form = el.querySelector("#labForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const obj = {
      id: v.id || uuid(),
      title: fd.get("title").trim(),
      sampleId: fd.get("sampleId").trim(),
      date: fd.get("date"),
      method: fd.get("method").trim(),
      status: fd.get("status"),
      precursors: fd.get("precursors"),
      conditions: fd.get("conditions"),
      postTreat: fd.get("postTreat"),
      characterization: fd.get("characterization"),
      performance: fd.get("performance"),
      conclusion: fd.get("conclusion"),
      tags: fd.get("tags").split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      doi: fd.get("doi").trim(),
      attachments: attachments.slice(0, 9),
      createdAt: v.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await put("experiments", obj);
    toast("已保存");
    location.hash = "#/lab";
  });

  const delBtn = el.querySelector("#labDelete");
  if (delBtn) delBtn.addEventListener("click", async () => {
    if (!confirmDialog("确定删除这条实验记录？此操作不可恢复（建议先在「设置」导出备份）。")) return;
    await del("experiments", v.id);
    toast("已删除", "warn");
    location.hash = "#/lab";
  });
}

/** 图片灯箱 */
export function openLightbox(src) {
  const box = document.createElement("div");
  box.className = "lightbox";
  box.innerHTML = `<img src="${src}" alt="">`;
  box.addEventListener("click", () => box.remove());
  document.body.appendChild(box);
}
