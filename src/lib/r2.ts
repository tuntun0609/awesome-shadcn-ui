import { AwsClient } from "aws4fetch";
import {
  detectIconFormat,
  iconContentType,
  isSafeSvgText,
} from "@/lib/icon-validation";

const MAX_LOGO_UPLOAD_BYTES = 512 * 1024;
const UPLOADABLE_FORMATS = new Set(["ico", "png", "svg", "webp"]);
// 公用 R2 桶按项目目录隔离，本项目所有对象统一放在该前缀下。
export const LOGO_KEY_PREFIX = "awesome-shadcn-ui/icons/";
const R2_REQUIRED_VARIABLES = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

export interface R2Config {
  accessKeyId: string;
  accountId: string;
  bucket: string;
  secretAccessKey: string;
}

export function getR2Config(
  environment: NodeJS.ProcessEnv = process.env
): R2Config {
  const missing = R2_REQUIRED_VARIABLES.filter((name) => !environment[name]);
  if (missing.length > 0) {
    throw new Error(
      `缺少 R2 环境变量：${missing.join(", ")}。请在 .env 中配置后重试。`
    );
  }

  return {
    accessKeyId: environment.R2_ACCESS_KEY_ID as string,
    accountId: environment.R2_ACCOUNT_ID as string,
    bucket: environment.R2_BUCKET as string,
    secretAccessKey: environment.R2_SECRET_ACCESS_KEY as string,
  };
}

export async function uploadR2Object(
  key: string,
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string
) {
  const config = getR2Config();
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
  });
  const url = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key}`;

  const response = await client.fetch(url, {
    body: new Blob([bytes], { type: contentType }),
    headers: { "Content-Type": contentType },
    method: "PUT",
  });
  if (!response.ok) {
    throw new Error(`R2 上传失败（HTTP ${response.status}）`);
  }
}

export interface LogoUploadPlan {
  contentType: string;
  key: string;
}

/** 校验上传的 Logo 字节并生成确定性对象 key；不发起网络请求。 */
export function validateLibraryLogoUpload(
  slug: string,
  bytes: Uint8Array
): LogoUploadPlan {
  if (bytes.byteLength === 0) {
    throw new Error("Logo 文件为空");
  }
  if (bytes.byteLength > MAX_LOGO_UPLOAD_BYTES) {
    throw new Error("Logo 不能超过 512KB");
  }

  const format = detectIconFormat(bytes);
  if (!(format && UPLOADABLE_FORMATS.has(format))) {
    throw new Error("Logo 仅支持 svg、png、ico、webp 格式");
  }
  if (format === "svg" && !isSafeSvgText(new TextDecoder().decode(bytes))) {
    throw new Error("SVG 包含脚本或外部引用，已拒绝上传");
  }

  return {
    contentType: iconContentType(format),
    key: `${LOGO_KEY_PREFIX}${slug}.${format}`,
  };
}

export async function uploadLibraryLogo(
  slug: string,
  bytes: Uint8Array<ArrayBuffer>
) {
  const plan = validateLibraryLogoUpload(slug, bytes);
  await uploadR2Object(plan.key, bytes, plan.contentType);
  return plan.key;
}
