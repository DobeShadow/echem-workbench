// 看板与想法：任务看板（待办/进行中/已完成）+ memos 式想法捕捉

import { all, put, del } from "../store.js";
import { esc, uuid, toast, confirmDialog, fmtDate } from "../util.js";

const COLS = [
  { key: "todo", label: "待办", icon: "📋" },
  { key: "doing", label: "进行中", icon: "🔥" },
  { key: "done", label: "已完成", icon: "✅" },
];

export async function render(el, { params }) {
  const tab = params.get("tab") === "ideas" ? "ideas" : "board";
  el.innerHTML = `
    <div class="page">
      <div class="page-head"><h1>看板与想法</h1>
        <div class="tabs">
          <a class="tab ${tab === "board" ? "active" : ""}" href="#/board">看板</a>
          <a class="tab ${tab === "ideas" ? "active" : ""}" href="#/board?tab=ideas">想法</a>
        </div></div>
      <div id="tabBody"></div>
    </div>`;
  if (tab === "ideas") await renderIdeas(el.querySelector("#tabBody"));
  else await renderBoard(el.querySelector("#tabBody"));
}

async function renderBoard(body) {
  const tasks = (await all("tasks")).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  body.innerHTML = `
    <div class="toolbar">
      <input id="taskInput" class="input" placeholder="新任务标题，回车快速添加（例：补测 PtNi 的 EIS）">
      <button id="taskAdd" class="btn btn-primary">添加</button>
    </div>
    <div class="kanban">
      ${COLS.map((c) => `
        <div class="kanban-col" data-col="${c.key}">
          <div class="kanban-head">${c.icon} ${c.label} <span class="muted small" data-count></span></div>
          <div class="kanban-cards" data-cards></div>
        </div>`).join("")}
    </div>`;

  function cardHTML(t) {
    return `
      <div class="kanban-card" data-id="${esc(t.id)}">
        <div class="kanban-card-title">${esc(t.title)}</div>
        ${t.note ? `<div class="muted small">${esc(t.note)}</div>` : ""}
        <div class="kanban-card-foot">
          <span class="muted small">${fmtDate(t.doneAt || t.createdAt)}</span>
          <span>
            <button data-move="-1" title="左移">◀</button>
            <button data-move="1" title="右移">▶</button>
            <button data-del title="删除">✕</button>
          </span>
        </div>
      </div>`;
  }

  function paint() {
    for (const c of COLS) {
      const col = body.querySelector(`[data-col="${c.key}"]`);
      const list = tasks.filter((t) => (t.status || "todo") === c.key);
      col.querySelector("[data-count]").textContent = list.length ? `· ${list.length}` : "";
      col.querySelector("[data-cards]").innerHTML = list.map(cardHTML).join("") ||
        '<div class="muted small" style="padding:8px">空</div>';
    }
  }

  async function add() {
    const input = body.querySelector("#taskInput");
    const title = input.value.trim();
    if (!title) return;
    input.value = "";
    await put("tasks", { id: uuid(), title, status: "todo", createdAt: new Date().toISOString(), doneAt: null });
    await reload();
  }

  async function reload() {
    const fresh = (await all("tasks")).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    tasks.splice(0, tasks.length, ...fresh);
    paint();
  }

  body.addEventListener("click", async (e) => {
    const card = e.target.closest(".kanban-card");
    if (!card) return;
    const id = card.dataset.id;
    const t = tasks.find((x) => x.id === id);
    if (!t) return;

    const moveBtn = e.target.closest("[data-move]");
    if (moveBtn) {
      const idx = COLS.findIndex((c) => c.key === (t.status || "todo"));
      const next = COLS[Math.min(COLS.length - 1, Math.max(0, idx + Number(moveBtn.dataset.move)))];
      t.status = next.key;
      t.doneAt = next.key === "done" ? new Date().toISOString() : null;
      await put("tasks", t);
      await reload();
      return;
    }
    if (e.target.closest("[data-del]")) {
      if (!confirmDialog("删除任务「" + t.title + "」？")) return;
      await del("tasks", id);
      await reload();
    }
  });
  body.querySelector("#taskAdd").addEventListener("click", add);
  body.querySelector("#taskInput").addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });

  paint();
}

async function renderIdeas(body) {
  const ideas = (await all("ideas")).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  body.innerHTML = `
    <div class="card">
      <textarea id="ideaInput" class="input" rows="3" placeholder="随手记：实验灵感、文献里看到的点子、想验证的猜想…（Ctrl+Enter 保存）"></textarea>
      <div class="toolbar" style="justify-content:flex-end">
        <button id="ideaAdd" class="btn btn-primary">记一笔</button>
      </div>
    </div>
    <div id="ideaList" class="idealist"></div>`;

  function paint() {
    body.querySelector("#ideaList").innerHTML = ideas.length
      ? ideas.map((i) => `
        <div class="idea-item" data-id="${esc(i.id)}">
          <div class="idea-text">${esc(i.text)}</div>
          <div class="idea-foot">
            <span class="muted small">${fmtDate(i.createdAt)}${i.convertedTo ? " · 已转为任务" : ""}</span>
            <span>
              ${i.convertedTo ? "" : '<button data-to-task class="btn btn-small">转为任务</button>'}
              <button data-del class="btn btn-small btn-danger">删</button>
            </span>
          </div>
        </div>`).join("")
      : '<div class="empty">还没有想法。看到好点子随手记下来。</div>';
  }

  async function reload() {
    const fresh = (await all("ideas")).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    ideas.splice(0, ideas.length, ...fresh);
    paint();
  }

  async function add() {
    const ta = body.querySelector("#ideaInput");
    const text = ta.value.trim();
    if (!text) return;
    await put("ideas", { id: uuid(), text, createdAt: new Date().toISOString(), convertedTo: null });
    ta.value = "";
    await reload();
  }

  body.addEventListener("click", async (e) => {
    const item = e.target.closest(".idea-item");
    if (!item) return;
    const idea = ideas.find((x) => x.id === item.dataset.id);
    if (!idea) return;

    if (e.target.closest("[data-to-task]")) {
      const task = { id: uuid(), title: idea.text.slice(0, 80), status: "todo", createdAt: new Date().toISOString(), doneAt: null, fromIdea: idea.id };
      await put("tasks", task);
      idea.convertedTo = task.id;
      await put("ideas", idea);
      await reload();
      toast("已转为看板任务，去「看板」查看");
      return;
    }
    if (e.target.closest("[data-del]")) {
      if (!confirmDialog("删除这条想法？")) return;
      await del("ideas", idea.id);
      await reload();
    }
  });
  body.querySelector("#ideaAdd").addEventListener("click", add);
  body.querySelector("#ideaInput").addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") add();
  });

  paint();
}
