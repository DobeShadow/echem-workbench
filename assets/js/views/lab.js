// 实验记录：电催化合成实验的结构化记录（仅存本地 IndexedDB）

import { all, put, del } from "../store.js";
import { nav } from "../state.js";
import { esc, todayISO, uuid, toast, confirmDialog, fmtDate, fmtDateTime } from "../util.js";

const STATUSES = ["计划", "进行中", "已完成", "搁置"];
const METHODS = ["水热", "溶剂热", "电沉积", "浸渍-焙烧", "共沉淀", "溶胶凝胶", "CVD", "电化学剥离", "球磨", "商业化/购买", "其他"];

const statusColor = (s) =>
  ({ 计划: "chip-gray", 进行中: "chip-blue", 已完成: "chip-green", 搁置: "chip-amber" }[s] || "chip-gray");

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
        <a class="btn btn-primary" href="#/lab?new=1">＋ 新建实验</a>
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
            <span class="muted small">${fmtDate(x.date)}</span>
          </div>
          <div class="item-title">${esc(x.title || "未命名实验")}</div>
          <div class="muted small">${esc(x.method || "未填方法")}</div>
          ${x.performance ? `<p class="lab-perf">${esc(x.performance.split("\n")[0])}</p>` : ""}
          <div class="tagrow">${(x.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>
        </a>`).join("")
      : `<div class="empty">还没有实验记录。点「＋ 新建实验」记录第一条合成实验。</div>`;
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
  el.innerHTML = `
    <div class="page page-narrow">
      <a class="back" href="#/lab">← 返回列表</a>
      <div class="card">
        <h1>${exp ? "编辑实验" : "新建实验"}</h1>
        <form id="labForm" class="form">
          <label>实验名称 / 目标材料 *</label>
          <input class="input" name="title" required value="${esc(v.title || "")}" placeholder="例：NiFe-LDH/CF 基底 OER 催化剂">
          <div class="form-row">
            <div><label>样品编号</label><input class="input" name="sampleId" value="${esc(v.sampleId || "")}" placeholder="例：S2026-001"></div>
            <div><label>实验日期</label><input class="input" type="date" name="date" value="${esc(v.date || todayISO())}"></div>
          </div>
          <div class="form-row">
            <div><label>合成方法</label>
              <input class="input" name="method" list="methodList" value="${esc(v.method || "")}">
              <datalist id="methodList">${METHODS.map((m) => `<option value="${m}">`).join("")}</datalist>
            </div>
            <div><label>状态</label>
              <select class="input" name="status">${STATUSES.map((s) => `<option ${v.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
            </div>
          </div>
          <label>前驱体与配比</label>
          <textarea class="input" name="precursors" rows="3" placeholder="例：Ni(NO₃)₂·6H₂O 0.5 mmol + Fe(NO₃)₃·9H₂O 0.25 mmol，溶于 36 mL 去离子水">${esc(v.precursors || "")}</textarea>
          <label>合成条件（温度 / 时间 / pH / 气氛 / 电压等）</label>
          <textarea class="input" name="conditions" rows="3" placeholder="例：120 °C 水热 12 h；自然冷却；气氛：空气">${esc(v.conditions || "")}</textarea>
          <label>后处理（洗涤 / 干燥 / 退火等）</label>
          <textarea class="input" name="postTreat" rows="2" placeholder="例：乙醇/水洗 3 次，60 °C 真空干燥 12 h，300 °C Ar 退火 2 h">${esc(v.postTreat || "")}</textarea>
          <label>表征结果</label>
          <textarea class="input" name="characterization" rows="3" placeholder="XRD / SEM / TEM / XPS 等关键结果">${esc(v.characterization || "")}</textarea>
          <label>电化学性能</label>
          <textarea class="input" name="performance" rows="3" placeholder="例：η₁₀ = 250 mV；FE(CO) = 92% @ −0.9 V vs RHE；稳定性 24 h 衰减 <5%">${esc(v.performance || "")}</textarea>
          <label>结论与下一步</label>
          <textarea class="input" name="conclusion" rows="2">${esc(v.conclusion || "")}</textarea>
          <label>标签（逗号分隔）</label>
          <input class="input" name="tags" value="${esc((v.tags || []).join(", "))}" placeholder="例：OER, LDH, NiFe">
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">保存</button>
            ${exp ? '<button type="button" id="labDelete" class="btn btn-danger">删除</button>' : ""}
            <a class="btn" href="#/lab">取消</a>
          </div>
        </form>
      </div>
    </div>`;

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
