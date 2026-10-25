// 模块语法检查：能被 ES module 解析器解析的输出 OK/RUNTIME，语法错误输出 SYNTAX
import { pathToFileURL } from "node:url";

for (const f of process.argv.slice(2)) {
  try {
    await import(pathToFileURL(f).href);
    console.log("OK      ", f);
  } catch (e) {
    const kind = e instanceof SyntaxError ? "SYNTAX " : "RUNTIME";
    console.log(kind, " ", f, "-", String(e.message).slice(0, 110));
  }
}
