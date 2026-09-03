const DOMAIN_TRAILING_SLASHES = /\/+$/;
const KEY_LEADING_SLASHES = /^\/+/;

/**
 * 将 R2 对象 key 拼接为公共访问 URL。
 * 域名来自 NEXT_PUBLIC_R2_PUBLIC_DOMAIN（公共只读，非机密），
 * 未配置时返回 undefined，渲染层回退为首字母占位。
 */
export function logoPublicUrl(key: string): string | undefined {
  const domain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN;
  if (!domain) {
    return undefined;
  }
  return `${domain.replace(DOMAIN_TRAILING_SLASHES, "")}/${key.replace(
    KEY_LEADING_SLASHES,
    ""
  )}`;
}
