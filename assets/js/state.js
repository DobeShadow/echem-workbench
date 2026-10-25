// 全局共享状态：文献索引缓存、配置
export const S = {
  index: null,      // content/index.json 的内容
  indexError: null, // 加载失败的错误信息
};

// 路由渲染代次：每次 render 自增；视图在异步回调里比对，避免旧渲染覆盖新页面
export const nav = { seq: 0 };

export const CONFIG = window.WB_CONFIG || {
  siteName: "电催化工作台",
  userName: "",
  directions: [],
  quickLinks: [],
};

export async function loadIndex() {
  if (S.index || S.indexError) return;
  try {
    const r = await fetch("content/index.json");
    if (!r.ok) throw new Error("HTTP " + r.status);
    S.index = await r.json();
  } catch (e) {
    S.indexError = e;
  }
}
