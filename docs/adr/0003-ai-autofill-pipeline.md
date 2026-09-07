# ADR 0003: AI 自动填充产线（第一版）

- 状态：已接受
- 日期：2026-09-04
- 更新：2026-09-07（以以下修订为当前实现；原始背景与决策保留作历史）

## 2026-09-07 修订：对话辅助与批量回填

本修订替代原决策 1、2、4、5、7、8、11、13、15 中涉及交互、回填与预算的描述，其余约束继续适用。

- **范围与布局**：AI 仅用于新建录入页，编辑页共用表单布局修复。宽屏默认展开固定在页面右侧、占满视口高度的独立侧边栏；后台主内容区（含页头与保存栏）随展开状态为侧边栏留出空间，表单及卡片按实际容器宽度分列。窄屏默认收起，使用侧边抽屉。收起不销毁对话状态，处理继续，入口显示处理中状态。
- **协议与工具**：现有实现使用 `ToolLoopAgent`、`createAgentUIStreamResponse`、`useChat` 与 `DefaultChatTransport`，不再使用 `Output.object` 或自定 `step/field/done` SSE。采集工具保留 `fetch_page` 和 `fetch_github_repo`；客户端回填工具改为 `fill_fields({ fields: [{ field, value, source, confidence }] })`。一次收集后批量写入，后续修正仅包含涉及字段，避免逐字段调用与反复跳动。代价是第一批结果可能稍晚出现。
- **部分成功**：客户端逐字段按表单 schema 校验，返回 `filled/review/protected/invalid` 结果。有效字段继续写入，失败字段附错误。同一批次重复字段不再次写入。指令要求只重试无效字段且每轮最多纠正一次；这是模型指令约束，不是跨请求硬预算。
- **人工修改保护**：字段人工编辑后即受保护，包括主动清空与改回初始值，同时清除旧 AI 来源与置信度。后续 AI 结果仅作为候选显示，用户可保留当前值或使用 AI 值；选择使用 AI 值后，该字段恢复为可由后续 AI 更新的状态。未被人工修改的新建默认值可回填。保护与候选仅会话内存在，不入库。
- **审核展示**：置信度低于 70%、缺少来源或来源为 `n/a` 的字段标记待核对。其他 AI 字段仅显示紧凑标识；原因、来源和分数点击查看，不把长来源放进标题行。置信度为模型自评，高分不代表已验证。每批摘要提供已填入（含待核对）、待核对、保留人工修改和校验失败计数，并支持定位字段；摘要记录该批执行时的结果。待核对不增加提交门槛，仍由管理员检查后保存。
- **Logo 与预算**：同一官网在当前会话中仅自动触发一次 Logo 采集，已有 Logo 或手工上传时保留。Route Handler 的 8 step 与 55 秒限制仅作用于单次请求，不等同于整轮对话工具调用次数；一次批量回填可包含 11 个字段，采集与重试仍会增加实际调用量。

验证覆盖批量部分失败、重复字段、数组容错与审核阈值，并通过浏览器模拟工具响应检查人工修改保护和布局；模拟结果不代表真实模型的时延或调用次数保证。

## 背景

人工收录一个 shadcn/ui 生态库需要调研官网、GitHub 仓库，再手工填写 `LibraryForm`（14 个字段，schema 见 `src/lib/library-form-schema.ts`），效率低。用户希望搭建一条"给出网址 → agent 自动采集信息并填充表单 → 人工审核提交"的产线。

约束事实：

1. 项目 AI/LLM 依赖为零；正文采集仅有 `src/lib/icon-resolver.ts` 的手写正则 HTML 解析。
2. 已有"服务端采集 → 前端预览 → 确认入库"先例：`fetchLibraryLogoAction`、`fetchGithubMetricsAction`（`src/app/admin/actions.ts`）。
3. 本版本 Next.js（^16.3.4）中 **Server Actions 不支持流式返回部分结果**（单次往返、整体序列化，见 `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`）；Route Handler 返回 `ReadableStream` 是官方支持的流式路径（`streaming.md:484-506`）。
4. 客户端消费流式的官方推荐方式是 `fetch` + `res.body.getReader()` + `TextDecoder`（`streaming.md:737-758`）。
5. AI SDK（`ai` 包）支持 agent 工具循环（`streamText` + `tools` + `stopWhen`）与 `Output.object` 结构化输出的组合；`fullStream` 提供 `tool-call`/`tool-result`/delta 事件，可经 `TransformStream` 转为自定 SSE（官方 custom-stream-format recipe）。
6. 部署于 Netlify：同步函数执行上限 **60 秒（不可配置）**，流式响应载荷上限 20MB。

## 决策

1. **入口形态：嵌入现有新建页**。在 `admin/libraries/new` 页面顶部加"输入 URL，AI 自动填充"入口，结果**预填进现有 `LibraryForm`**，用户在表单中审核修改后走既有 `createLibraryAction` 提交。不做独立向导页，不做 CLI 批量。第一版单条流，批量（多 URL 排队）后置。
2. **运行时体验：步骤流水线 + 字段流式同时展示**。不做"处理中"转圈黑盒：agent 的每次工具调用实时上屏（"抓取官网 ✓ → 抓取 GitHub ✓ → 提取字段中…"），字段值随 LLM 生成流式填入表单（description 打字机效果）。
3. **采集与提取：agent 自主工具循环（非固定编排）**。使用 `streamText` + `tools` + `stopWhen`，LLM 自主决定抓什么、抓几次（如先抓官网 → 发现有 GitHub 链接则抓 README → pricing 信息不足再抓子页面），认为材料充分后产出字段。推翻早期"代码固定编排 Jina + GitHub 抓取顺序"的方案：组件库官网结构各异，固定编排无法覆盖"信息在子页面"的场景；工具调用事件天然映射为 `step` 事件，实时步骤显示不额外造机制。
4. **工具集：精简两件套**。`fetch_page(url)`（经 Jina Reader 抓任意页面 markdown，可跟进子页面）+ `fetch_github_repo(owner, repo)`（GitHub API，README + 仓库元数据一次拿全）。不提供 web 搜索（输入已有明确 URL，伪需求）与细粒度仓库翻文件工具（对填表单无增量价值）——工具越多 LLM 越易绕路烧预算。
5. **LLM 集成：`ToolLoopAgent` + `Output.object` 结构化收尾**。使用 AI SDK 官方推荐的 agent 抽象 `new ToolLoopAgent({ model, instructions, tools, stopWhen, output })`（`ai` 包）而非裸 `streamText` 手工拼循环——官方文档明确 ToolLoopAgent 是大多数场景的推荐路径（自管理循环与消息数组），且 `agent.stream()` 返回 `StreamTextResult`，`fullStream` 事件面不变。构造器直接配置 `output: Output.object({ schema })`（结构化生成计一步，`stopWhen` 相应 +1）：agent 采集完材料后自动进入最终生成，object delta 即字段流式来源。不用 `WorkflowAgent`（`@ai-sdk/workflow`，持久化运行时为长时任务设计，45s 单发请求用不上且多一个运行时依赖）；不用 `streamObject`（单次生成无工具循环）；不用 `useObject`。
6. **description 策略：AI 提炼统一风格的英文简介**。不照抄官网原文，由 LLM 将官网/README 内容精炼为英文简介；风格基准取自存量数据——以站内现有条目的 description 提炼 few-shot 示例写进 prompt，保证新条目与存量数据风格（语言、长度、句式）一致，不引入新的风格变量。
7. **审核精细度：字段级来源/置信度标注**。LLM 输出为 `{ value, source, confidence }` 三元组，预填进表单后每个 AI 字段带来源角标（如"来自 GitHub README"），可疑字段高亮，未采集到的字段留空由人工补。
8. **传输协议：自定 SSE，不使用 `useObject`**。新建 Route Handler 返回 `text/event-stream`：AI SDK `fullStream`（`tool-call`/`tool-result`/`text-delta`/object delta 等事件）经 `TransformStream` 映射为三类自定事件——`step`（agent 工具调用即流水线步骤）、`field`（字段值/来源/置信度增量）、`done`/`error`，客户端用 `fetch` + reader 手动解析。选自定协议而非 `useObject` 的原因：需要同时承载步骤进度与字段内容两种事件，`useObject` 只覆盖后者。
9. **slug 由 LLM 建议、人工裁决**：LLM 从 name 派生建议值（受 kebab-case schema 约束），提交时复用现有唯一性校验，冲突时报错由用户手改。不做自动后缀——slug 是编辑决策，`-2` 会产生丑标识符。
10. **LLM 接入走 OpenAI 兼容接口**：使用 `@ai-sdk/openai-compatible` provider，`baseURL` / `apiKey` / `model` 全部由环境变量配置，不绑定任何具体厂商（DeepSeek、z.ai GLM 等均可切换）。
11. **失败降级：部分成功，不自动重试**：单个工具调用失败（Jina 超时、GitHub 404 等）作为结果返回给 agent，由其决定换路径还是放弃该来源；若 agent 最终未产出完整字段，用已采集材料能填几个填几个，缺失字段标"未采集到"留空。审核制下部分结果仍有价值；自动重试会烧穿函数预算，失败后用户手动重跑即可。例外——工具内部的廉价纠正不烧 LLM 预算：`fetch_page` 在 Reader（r.jina.ai）不可达时降级直连目标站点抓原始 HTML（手写极简 HTML 转文本，链接保留为 `text (url)`）；`fetch_github_repo` 在 404 时经 GitHub Search 自动纠正仓库名（两轮查询处理连字符变体）并返回 `resolvedRepo`。
12. **原始材料仅会话内保留**：审核面板可展开查看本次抓取的官网 markdown / README 原文，便于核对 source/pricing 等判断字段；只存在于请求内存与前端 state，不落库、不进 R2。
13. **串联 Logo 抓取，不串联 GitHub 指标**：AI 填充完成后自动触发现有 `fetchLibraryLogoAction`（预览确认后上传）；`fetchGithubMetricsAction` 保持手动——指标是收录后的运维快照，与"录入条目"是不同生命周期。
14. **SSE 路由鉴权沿用 ADR 0002 语义**：`auth()` + `isAdminSession()` 判定，非 admin 返回 404（不暴露端点存在），不复用 `requireAdmin()`（其 redirect/notFound 语义不适配 Route Handler）。
15. **预算与护栏**：`stopWhen: isStepCount(8)`（约 5 次工具调用 + 2 次推理步 + 1 次结构化输出）；每个 fetch 工具 15s 超时；`agent.stream()` 原生支持 `timeout` / `abortSignal`，整体设 55s 硬超时（`AbortSignal.timeout(55_000)`）兜底 Netlify 60s 函数硬顶。超时中断时无最终结构化输出，但 `field` 事件是增量推送的，客户端已收到的部分字段不丢失，仍可走部分成功审核路径。流水线预算估计：Jina 抓取 ~10s/页 + GitHub ~1s + LLM 流式 ~20s，约 30s 常态在预算内。
16. **依赖面收敛**：新增 `ai` + `@ai-sdk/openai-compatible` 两个包；采集用原生 fetch（Jina Reader 是 GET 接口，GitHub API 沿用现有 `github-metrics-fetcher` 模式），不引入 cheerio/firecrawl。

## 后果

- 表单校验、入库、Logo 上传链路全部复用，新增面收敛为：一个流式 Route Handler（agent 工具循环 + SSE 转换）、`fetch_page`/`fetch_github_repo` 两个工具、一个表单顶部入口组件、字段角标 UI、原始材料查看面板。
- 引入外部运行时依赖：OpenAI 兼容接口（计费，环境变量配置）与 Jina Reader（免 key 限速使用，可选 `JINA_API_KEY` 提额度）。
- agent 自主循环的采集路径不可预知，字段来源角标依赖 LLM 自报 + 工具调用记录交叉印证，准确率需在实测中校准。
- 字段角标需要 `LibraryForm` 支持外部元数据注入，是其首次为 AI 预填做的改造。
- 净新增环境变量：`AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`，可选 `JINA_API_KEY`。
- 若未来做批量（多 URL 排队），受 60s 函数上限约束，需改后台函数（Netlify Background Functions，15min）另立 ADR。
