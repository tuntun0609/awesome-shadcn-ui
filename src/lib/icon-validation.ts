export type IconFormat = "ico" | "jpeg" | "png" | "svg" | "webp";

const SVG_BOM_PATTERN = /^\uFEFF/;
const SVG_ROOT_PATTERN = /^(?:<\?xml[^>]*>\s*)?<svg\b/i;
const UNSAFE_SVG_PATTERN = /<script\b|<foreignObject\b|\bon\w+\s*=/i;
const SVG_HREF_PATTERN =
  /(?:href|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

function hasBytes(bytes: Uint8Array, expected: number[], offset = 0) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

/** 通过魔数或 SVG 根元素识别图标格式；无法识别时返回 null。 */
export function detectIconFormat(bytes: Uint8Array): IconFormat | null {
  if (bytes.byteLength < 8) {
    return null;
  }

  if (hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }
  if (hasBytes(bytes, [0x00, 0x00, 0x01, 0x00])) {
    return "ico";
  }
  if (
    hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    hasBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "webp";
  }
  if (hasBytes(bytes, [0xff, 0xd8, 0xff])) {
    return "jpeg";
  }

  const svg = new TextDecoder()
    .decode(bytes)
    .replace(SVG_BOM_PATTERN, "")
    .trimStart();
  return SVG_ROOT_PATTERN.test(svg) ? "svg" : null;
}

/** 校验 SVG 文本：以 <svg> 开头、不含脚本/事件处理器、所有引用均为内部锚点。 */
export function isSafeSvgText(svg: string) {
  const trimmed = svg.replace(SVG_BOM_PATTERN, "").trimStart();
  if (!SVG_ROOT_PATTERN.test(trimmed) || UNSAFE_SVG_PATTERN.test(trimmed)) {
    return false;
  }
  return [...trimmed.matchAll(SVG_HREF_PATTERN)].every((match) =>
    (match[1] ?? match[2] ?? match[3] ?? "").startsWith("#")
  );
}

const CONTENT_TYPES: Record<IconFormat, string> = {
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

export function iconContentType(format: IconFormat) {
  return CONTENT_TYPES[format];
}
