## 语言规范

- 默认使用中文回复

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Ultracite

- 本项目使用 Ultracite 和 Biome，规则以 `biome.json` 为准。
- 修改代码后运行 `bun x ultracite check`。
- 使用 `bun x ultracite fix` 处理格式及可自动修复的问题。
- 不要通过关闭规则规避检查；确需忽略时，应限定到最小范围并说明原因。
- 编写可访问、类型安全且易维护的 React/Next.js 代码。
