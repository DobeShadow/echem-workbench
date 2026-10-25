#!/usr/bin/env python3
"""本地开发服务器：禁用缓存，保证刷新即见最新代码。
用法：python tools/devserver.py [端口]（默认 8080）
"""
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), NoCacheHandler) as srv:
        print(f"serving http://127.0.0.1:{PORT} (Cache-Control: no-store)")
        srv.serve_forever()
