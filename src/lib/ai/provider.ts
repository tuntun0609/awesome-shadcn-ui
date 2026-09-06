import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * 从环境变量构建 OpenAI 兼容的模型实例（ADR 0003 决策 #10：
 * 不绑定厂商，baseURL / apiKey / model 均由环境变量配置）。
 */
export function getAutofillModel() {
  const baseURL = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const modelId = process.env.AI_MODEL;

  if (!(baseURL && apiKey && modelId)) {
    throw new Error("缺少 AI_BASE_URL / AI_API_KEY / AI_MODEL 环境变量");
  }

  const provider = createOpenAICompatible({
    apiKey,
    baseURL,
    name: "autofill-provider",
  });

  return provider.chatModel(modelId);
}
