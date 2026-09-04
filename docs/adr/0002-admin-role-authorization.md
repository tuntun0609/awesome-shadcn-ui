# ADR 0002: 基于 Clerk publicMetadata 的 Admin 角色授权

- 状态：已接受
- 日期：2026-09-04

## 背景

站点通过 Clerk 提供用户系统（`clerkMiddleware` 挂载于 `src/proxy.ts`，登录/注册页位于 `[locale]` 路由下），但全项目没有任何 `auth()` 或 `protect()` 调用。`/admin` 后台（目录列表、新建、编辑三个页面，以及 `src/app/admin/actions.ts` 中的 server actions，可读写数据库并上传 R2 logo）此前处于零保护状态，任何匿名请求都能访问页面并直接调用 server actions。

ADR 0001 曾预留该决策："Adding an editing workflow later will require a separate authorization ... design."本 ADR 补上这一授权设计。

约束事实：

1. server actions 可被绕过页面直接调用，仅靠 layout 层校验无法防护。
2. `proxy.ts` 的 matcher 为国际化处理排除了 `/admin`；admin 是独立的非国际化根 layout，且此前不含 `ClerkProvider`。
3. 数据库中没有 User 表和 role 字段，用户数据完全由 Clerk 托管；项目没有任何 webhook 或 API route 基础设施。

## 决策

1. **管理员身份由 Clerk `publicMetadata.role` 判定**：只有 `publicMetadata.role === "admin"` 的用户可以访问 `/admin`。不比对邮箱字符串——初始管理员为 tun.nozomi@gmail.com 对应的 Clerk 账号，但授权与邮箱解耦，将来换账号或增加管理员无需改代码。
2. **授予方式为 Clerk Dashboard 手工操作**：在 Dashboard → Users → 选中用户 → Metadata 中设置 `publicMetadata: { "role": "admin" }`。不做自动化脚本。
3. **双层防护**：
   - 页面层：`src/app/admin/layout.tsx`（服务端组件）调用 `requireAdmin()`；
   - 数据层：`src/app/admin/actions.ts` 中每个导出的 server action 首行调用 `await requireAdmin()`。
   - 不在 `proxy.ts` 中增加边缘层拦截（本站流量极小，收益不抵 matcher 改动的 intl 回归风险）。
4. **`requireAdmin()` 的行为**（实现于 `src/lib/admin-auth.ts`）：
   - 无 session → 重定向到 Clerk 登录页，登录后跳回 `/admin`；
   - 有 session 但 role 非 admin → `notFound()`，以 404 响应，不暴露后台的存在；
   - role 为 admin → 放行。
5. **role 读取自 session claims**（`auth().sessionClaims`），不做实时 `currentUser()` 网络请求。Dashboard 修改 role 后，最长约一个 token 刷新周期（约 1 分钟）内旧 session 仍按旧值判定。
6. **admin layout 补齐 `ClerkProvider`**，并在侧边栏头部加 `<UserButton />`，使管理员能在后台内退出登录。

## 后果

- 换管理员或新增管理员只需在 Clerk Dashboard 操作，无需部署。
- Dashboard 改标后约 1 分钟内权限变更才对已有 session 生效；紧急回收权限可先在 Dashboard 禁用该用户。
- `requireAdmin()` 是所有 admin server actions 的安全边界，新增 action 时必须调用；这依赖约定而非类型系统强制，代码评审需留意。
- `/admin` 在 `proxy.ts` matcher 中仍被排除（保持 intl 隔离），安全完全由应用层（layout + actions）保证，不依赖边缘层。
- 若未来需要更细粒度权限（如内容编辑、只读审计等角色），`publicMetadata.role` 单值需扩展为角色集合或迁移到数据库角色表 + webhook 同步，届时另立 ADR。
