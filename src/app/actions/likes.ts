"use server";

import { z } from "zod";
import { setLike } from "@/db/likes-repository";
import { ensureVisitorId } from "@/lib/visitor-id";

const inputSchema = z.object({
  liked: z.boolean(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "invalid slug")
    .max(100),
});

export type ToggleLikeResult =
  | { count: number; liked: boolean; status: "ok" }
  | { status: "not-found" };

export async function toggleLikeAction(input: {
  liked: boolean;
  slug: string;
}): Promise<ToggleLikeResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "not-found" };
  }

  const visitorId = await ensureVisitorId();
  const result = await setLike(visitorId, parsed.data.slug, parsed.data.liked);
  if (result === null) {
    return { status: "not-found" };
  }

  return { ...result, status: "ok" };
}
