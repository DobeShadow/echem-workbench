// 本地数据层：IndexedDB 封装（实验记录 / 任务 / 想法 / 绘图 / 元信息）
// 所有科研数据只存在浏览器本地，永不进入公开仓库；通过导出 JSON 备份。

const DB_NAME = "echem-workbench";
const DB_VERSION = 3;
const DATA_STORES = ["experiments", "tasks", "ideas", "plots", "papers_list"];
const ALL_STORES = [...DATA_STORES, "meta"];

let _dbPromise = null;

function open() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of ALL_STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: "id" });
      }
    };
    // 旧版本标签页还开着时会阻塞升级：给出明确提示而不是永久挂起
    req.onblocked = () => reject(new Error("数据库升级被另一个本站标签页阻塞：请关闭本站的其他标签页后刷新本页"));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const os = t.objectStore(store);
    let result;
    try {
      const req = fn(os);
      if (req) result = req;
    } catch (e) {
      reject(e);
      return;
    }
    t.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const all = (s) => tx(s, "readonly", (os) => os.getAll());
export const get = (s, id) => tx(s, "readonly", (os) => os.get(id));
export const put = (s, obj) => tx(s, "readwrite", (os) => os.put(obj));
export const del = (s, id) => tx(s, "readwrite", (os) => os.delete(id));
export const clear = (s) => tx(s, "readwrite", (os) => os.clear());

export async function exportAll() {
  const data = {
    app: DB_NAME,
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
  };
  for (const s of DATA_STORES) data[s] = await all(s);
  return data;
}

export async function importAll(data) {
  if (!data || data.app !== DB_NAME) throw new Error("文件不是本工作台的备份（校验失败）");
  for (const s of DATA_STORES) {
    await clear(s);
    const rows = Array.isArray(data[s]) ? data[s] : [];
    for (const obj of rows) {
      if (!obj.id) obj.id = obj.id || "imp-" + Math.random().toString(36).slice(2);
      await put(s, obj);
    }
  }
}

export async function getLastBackup() {
  const rows = await all("meta");
  const row = rows.find((x) => x && x.id === "lastBackup");
  return row ? row.at : null;
}

export async function setLastBackup() {
  await put("meta", { id: "lastBackup", at: new Date().toISOString() });
}

export async function wipeAll() {
  for (const s of DATA_STORES) await clear(s);
  await clear("meta");
}
