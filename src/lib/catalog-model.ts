export const sourceModels = [
  "open-source",
  "source-available",
  "proprietary",
  "undisclosed",
] as const;

export const pricingModels = [
  "free",
  "freemium",
  "paid",
  "undisclosed",
] as const;

export const accessModels = [
  "direct",
  "login-required",
  "purchase-required",
  "undisclosed",
] as const;

export const deliveryTypes = ["components", "blocks", "templates"] as const;

export const useCases = [
  "marketing",
  "dashboard",
  "commerce",
  "content",
  "data-display",
  "ai",
] as const;

export type SourceModel = (typeof sourceModels)[number];
export type PricingModel = (typeof pricingModels)[number];
export type AccessModel = (typeof accessModels)[number];
export type DeliveryType = (typeof deliveryTypes)[number];
export type UseCase = (typeof useCases)[number];

export interface Library {
  access: AccessModel;
  addedAt: string;
  delivery: DeliveryType[];
  description: string;
  featuredRank?: number;
  github?: string;
  logo?: string;
  name: string;
  pricing: PricingModel;
  slug: string;
  source: SourceModel;
  tags: string[];
  useCases: UseCase[];
  website: string;
}

export interface GithubMetric {
  latestCommitAt: string | null;
  stars: number;
  syncedAt: string;
}

export interface GithubSnapshot {
  repositories: Record<string, GithubMetric>;
  syncedAt: string | null;
}

export interface CatalogSnapshot {
  libraries: Library[];
  metrics: GithubSnapshot;
}
