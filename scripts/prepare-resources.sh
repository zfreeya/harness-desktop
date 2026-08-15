#!/usr/bin/env bash
# 重建 .app 打包所需的内嵌资源（体积巨大，不进 git）
# 来源：本机常驻记忆服务（~/.harness-memory/services）与系统 Node 运行时
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== 复制 node 运行时 =="
mkdir -p resources/node/bin resources/node/lib
REAL_NODE="$(python3 -c 'import os;print(os.path.realpath("/opt/homebrew/bin/node"))')"
cp "$REAL_NODE" resources/node/bin/node
chmod 755 resources/node/bin/node
NODE_LIBDIR="$(dirname "$(dirname "$REAL_NODE")")/lib"
cp "$NODE_LIBDIR"/libnode.*.dylib resources/node/lib/ 2>/dev/null || true

echo "== 复制记忆服务 =="
mkdir -p resources/memory-core resources/memory-proxy
rm -rf resources/memory-core/* resources/memory-proxy/*
cp -R "$HOME/.harness-memory/services/MemoryCore/." resources/memory-core/
cp -R "$HOME/.harness-memory/services/MemoryProxy/." resources/memory-proxy/

echo "== 完成 =="
du -sh resources/
