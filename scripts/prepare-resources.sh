#!/usr/bin/env bash
# 重建 .app 打包所需的内嵌资源（体积巨大，不进 git）
# 来源：本机常驻记忆服务（~/.harness-memory/services）与系统 Node 运行时
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== 复制 node 运行时 =="
mkdir -p src-tauri/resources/node/bin src-tauri/resources/node/lib
REAL_NODE="$(python3 -c 'import os;print(os.path.realpath("/opt/homebrew/bin/node"))')"
cp "$REAL_NODE" src-tauri/resources/node/bin/node
chmod 755 src-tauri/resources/node/bin/node
NODE_LIBDIR="$(dirname "$(dirname "$REAL_NODE")")/lib"
cp "$NODE_LIBDIR"/libnode.*.dylib src-tauri/resources/node/lib/ 2>/dev/null || true

echo "== 复制记忆服务 =="
mkdir -p src-tauri/resources/memory-core src-tauri/resources/memory-proxy
rm -rf src-tauri/resources/memory-core/* src-tauri/resources/memory-proxy/*
cp -R "$HOME/.harness-memory/services/MemoryCore/." src-tauri/resources/memory-core/
cp -R "$HOME/.harness-memory/services/MemoryProxy/." src-tauri/resources/memory-proxy/

echo "== 复制工具服务 =="
mkdir -p src-tauri/resources/tools-server
rm -rf src-tauri/resources/tools-server/*
cp tools-server/index.mjs src-tauri/resources/tools-server/

echo "== 完成 =="
du -sh src-tauri/resources/
