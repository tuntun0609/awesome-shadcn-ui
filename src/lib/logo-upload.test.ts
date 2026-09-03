import { describe, expect, test } from "bun:test";
import { validateLibraryLogoUpload } from "@/lib/r2";

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const ICO = Uint8Array.from([0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x00, 0x00]);

function svg(value: string) {
  return new TextEncoder().encode(value);
}

describe("validateLibraryLogoUpload", () => {
  test("accepts a png and derives a slug-based key", () => {
    const plan = validateLibraryLogoUpload("magic-ui", PNG);
    expect(plan.key).toBe("awesome-shadcn-ui/icons/magic-ui.png");
    expect(plan.contentType).toBe("image/png");
  });

  test("accepts an ico file", () => {
    const plan = validateLibraryLogoUpload("magic-ui", ICO);
    expect(plan.key).toBe("awesome-shadcn-ui/icons/magic-ui.ico");
    expect(plan.contentType).toBe("image/x-icon");
  });

  test("accepts a safe svg", () => {
    const plan = validateLibraryLogoUpload(
      "tailark",
      svg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>')
    );
    expect(plan.key).toBe("awesome-shadcn-ui/icons/tailark.svg");
    expect(plan.contentType).toBe("image/svg+xml");
  });

  test("rejects an empty file", () => {
    expect(() =>
      validateLibraryLogoUpload("magic-ui", new Uint8Array())
    ).toThrow("Logo 文件为空");
  });

  test("rejects files larger than 512KB", () => {
    const bytes = new Uint8Array(512 * 1024 + 1);
    bytes.set(PNG, 0);
    expect(() => validateLibraryLogoUpload("magic-ui", bytes)).toThrow(
      "Logo 不能超过 512KB"
    );
  });

  test("rejects unsupported formats such as jpeg", () => {
    expect(() => validateLibraryLogoUpload("magic-ui", JPEG)).toThrow(
      "Logo 仅支持 svg、png、ico、webp 格式"
    );
  });

  test("rejects svg with scripts or external references", () => {
    expect(() =>
      validateLibraryLogoUpload(
        "magic-ui",
        svg('<svg><script>alert("x")</script></svg>')
      )
    ).toThrow("SVG 包含脚本或外部引用");
    expect(() =>
      validateLibraryLogoUpload(
        "magic-ui",
        svg('<svg><image href="https://example.com/tracker.png" /></svg>')
      )
    ).toThrow("SVG 包含脚本或外部引用");
  });
});
