// 应用入口：hash 路由、主题、导航

import { loadIndex, nav } from "./state.js";
import * as dashboard from "./views/dashboard.js";
import * as papers from "./views/papers.js";
import * as paper from "./views/paper.js";
import * as reading from "./views/reading.js";
import * as lab from "./views/lab.js";
import * as plots from "./views/plots.js";
import * as tools from "./views/tools.js";
import * as board from "./views/board.js";
import * as weekly from "./views/weekly.js";
import * as settings from "./views/settings.js";

const routes = {
  dashboard: { view: dashboard.render, title: "仪表盘", nav: "dashboard" },
  papers: { view: papers.render, title: "精读卡库", nav: "papers" },
  paper: { view: paper.render, title: "精读卡", nav: "papers" },
  reading: { view: reading.render, title: "文献速录", nav: "reading" },
  lab: { view: lab.render, title: "实验记录", nav: "lab" },
  plots: { view: plots.render, title: "数据绘图", nav: "plots" },
  tools: { view: tools.render, title: "计算工具", nav: "tools" },
  board: { view: board.render, title: "看板与想法", nav: "board" },
  weekly: { view: weekly.render, title: "周报生成", nav: "weekly" },
  settings: { view: settings.render, title: "设置", nav: "settings" },
};

function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [pathPart, queryPart] = h.split("?");
  const segs = pathPart.split("/").filter(Boolean);
  return {
    name: segs[0] || "dashboard",
    arg: segs[1] || null,
    params: new URLSearchParams(queryPart || ""),
  };
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("wb-theme", theme);
  const btn = document.getElementById("themeBtn");
  if (btn) {
    const use = btn.querySelector("use");
    if (use) use.setAttribute("href", theme === "dark" ? "#i-sun" : "#i-moon");
    else btn.textContent = theme === "dark" ? "☀️" : "🌙";
  }
}

async function render() {
  const seq = ++nav.seq;
  const { name, arg, params } = parseHash();
  const route = routes[name] || routes.dashboard;
  await loadIndex();
  if (seq !== nav.seq) return;

  const main = document.getElementById("view");
  main.innerHTML = '<div class="loading">加载中…</div>';
  try {
    await route.view(main, { arg, params, seq });
  } catch (e) {
    console.error(e);
    if (seq === nav.seq) {
      main.innerHTML = `<div class="card error-card"><h3>视图加载出错</h3><p>${String(e && e.message || e)}</p></div>`;
    }
  }
  if (seq !== nav.seq) return;

  document.title = `${route.title} · ${document.querySelector(".brand .site-name")?.textContent || "电催化工作台"}`;
  const crumb = document.getElementById("crumb");
  if (crumb) crumb.textContent = route.title;

  document.querySelectorAll("[data-route]").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === route.nav);
  });
  document.body.classList.remove("nav-open");
  main.scrollTop = 0;
  window.scrollTo(0, 0);
}

function initNav() {
  document.getElementById("menuBtn")?.addEventListener("click", () => {
    document.body.classList.toggle("nav-open");
  });
  document.getElementById("themeBtn")?.addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(cur);
  });
  document.querySelectorAll("[data-route]").forEach((a) => {
    a.addEventListener("click", () => document.body.classList.remove("nav-open"));
  });
}

function init() {
  const saved = localStorage.getItem("wb-theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
  initNav();
  window.addEventListener("hashchange", render);
  render();
}

init();
