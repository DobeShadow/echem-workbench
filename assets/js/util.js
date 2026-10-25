// 通用工具：转义、日期、下载、复制、toast

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** 内联 SVG 图标（图标库在 index.html 的 sprite 中） */
export const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

export function dateISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export const todayISO = () => dateISO(new Date());

export const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(String(d).length === 10 ? d + "T00:00:00" : d);
  return isNaN(dt) ? String(d) : dateISO(dt);
};

export function fmtDateTime(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  const p = (n) => String(n).padStart(2, "0");
  return `${dateISO(dt)} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

export const uuid = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);

export function toast(msg, type = "info") {
  const wrap = document.getElementById("toastWrap");
  if (!wrap) return;
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.innerHTML = `${icon(type === "warn" ? "zap" : "check")}<span>${esc(msg)}</span>`;
  wrap.appendChild(el);
  setTimeout(() => el.classList.add("show"), 10);
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 2800);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function download(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function confirmDialog(msg) {
  return window.confirm(msg);
}

// 周工具：传入周一的 ISO 日期，返回 {start, end}（周日 23:59:59 收尾）
export function weekRange(mondayISO) {
  const start = new Date(mondayISO + "T00:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function thisMondayISO() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 周一=0
  d.setDate(d.getDate() - day);
  return dateISO(d);
}

export const inRange = (d, range) => {
  if (!d) return false;
  const t = new Date(String(d).length === 10 ? d + "T00:00:00" : d);
  return !isNaN(t) && t >= range.start && t <= range.end;
};
