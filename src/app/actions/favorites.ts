"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { setFavorite } from "@/db/favorites-repository";

const inputSchema = z.object({
  favorited: z.boolean(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "invalid slug")
    .max(100),
});

export type ToggleFavoriteResult =
  | { favorited: false; status: "unauthenticated" }
  | { favorited: boolean; status: "ok" }
  | { status: "not-found" };

export async function toggleFavoriteAction(input: {
  favorited: boolean;
  slug: string;
}): Promise<ToggleFavoriteResult> {
  const { userId } = await auth();
  if (!userId) {
    return { favorited: false, status: "unauthenticated" };
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "not-found" };
  }

  const favorited = await setFavorite(
    userId,
    parsed.data.slug,
    parsed.data.favorited
  );
  if (favorited === null) {
    return { status: "not-found" };
  }

  return { favorited, status: "ok" };
}
