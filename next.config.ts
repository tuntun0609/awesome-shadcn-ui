import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // VS Code 端口转发/隧道会改写 host 头，导致 origin 与 host 不一致，
      // 触发 Server Actions 的 CSRF 校验（Invalid Server Actions request）。
      // 将转发域名加入白名单以放行。
      allowedOrigins: [
        "localhost:3000",
        "*.preview.app.github.dev",
        "*.devtunnels.ms",
        "*.tunnels.api.visualstudio.com",
      ],
    },
  },
};

export default withNextIntl(nextConfig);
