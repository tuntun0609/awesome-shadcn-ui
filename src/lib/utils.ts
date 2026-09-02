import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function withRefParam(url: string, host: string) {
  if (!host) {
    return url;
  }
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("ref", host);
    return parsed.toString();
  } catch {
    return url;
  }
}
