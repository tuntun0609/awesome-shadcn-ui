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

export const libraries = [
  {
    access: "direct",
    addedAt: "2026-09-01",
    delivery: ["components", "blocks", "templates"],
    description:
      "Animated components and effects for expressive product and marketing interfaces.",
    featuredRank: 1,
    github: "https://github.com/magicuidesign/magicui",
    logo: "/logos/magic-ui.ico",
    name: "Magic UI",
    pricing: "freemium",
    slug: "magic-ui",
    source: "open-source",
    tags: ["animation", "motion", "landing pages"],
    useCases: ["marketing", "content"],
    website: "https://magicui.design/",
  },
  {
    access: "direct",
    addedAt: "2026-09-01",
    delivery: ["components", "blocks", "templates"],
    description:
      "Motion-rich React components and polished blocks for modern landing pages.",
    featuredRank: 2,
    logo: "/logos/aceternity-ui.ico",
    name: "Aceternity UI",
    pricing: "freemium",
    slug: "aceternity-ui",
    source: "source-available",
    tags: ["animation", "effects", "landing pages"],
    useCases: ["marketing", "content"],
    website: "https://ui.aceternity.com/",
  },
  {
    access: "direct",
    addedAt: "2026-09-01",
    delivery: ["components"],
    description:
      "Animated React primitives built with Motion, Tailwind CSS, Base UI, and Radix UI.",
    featuredRank: 3,
    github: "https://github.com/imskyleen/animate-ui",
    logo: "/logos/animate-ui.ico",
    name: "Animate UI",
    pricing: "free",
    slug: "animate-ui",
    source: "open-source",
    tags: ["animation", "primitives", "motion"],
    useCases: ["marketing", "dashboard"],
    website: "https://animate-ui.com/",
  },
  {
    access: "direct",
    addedAt: "2026-09-01",
    delivery: ["components", "blocks", "templates"],
    description:
      "A broad shadcn collection spanning application UI, data tools, and marketing blocks.",
    featuredRank: 4,
    github: "https://github.com/keenthemes/reui",
    logo: "/logos/reui.ico",
    name: "ReUI",
    pricing: "freemium",
    slug: "reui",
    source: "open-source",
    tags: ["application UI", "charts", "forms"],
    useCases: ["dashboard", "commerce", "data-display", "ai"],
    website: "https://reui.io/",
  },
  {
    access: "direct",
    addedAt: "2026-09-01",
    delivery: ["components", "blocks"],
    description:
      "Composable application components for complex workflows beyond the core shadcn set.",
    featuredRank: 5,
    github: "https://github.com/shadcnblocks/kibo",
    logo: "/logos/kibo-ui.png",
    name: "Kibo UI",
    pricing: "free",
    slug: "kibo-ui",
    source: "open-source",
    tags: ["application UI", "ai", "editor"],
    useCases: ["dashboard", "data-display", "ai"],
    website: "https://www.kibo-ui.com/",
  },
  {
    access: "direct",
    addedAt: "2026-09-01",
    delivery: ["components"],
    description:
      "Accessible, composable primitives for building richer interactions and application interfaces.",
    github: "https://github.com/sadmann7/diceui",
    logo: "/logos/dice-ui.png",
    name: "Dice UI",
    pricing: "free",
    slug: "dice-ui",
    source: "open-source",
    tags: ["primitives", "accessible", "application UI"],
    useCases: ["dashboard", "data-display"],
    website: "https://www.diceui.com/docs/introduction",
  },
  {
    access: "direct",
    addedAt: "2026-09-01",
    delivery: ["components", "blocks"],
    description:
      "Playful, production-ready components and blocks with a focused shadcn registry.",
    github: "https://github.com/kokonut-labs/kokonutui",
    logo: "/logos/kokonut-ui.png",
    name: "Kokonut UI",
    pricing: "freemium",
    slug: "kokonut-ui",
    source: "open-source",
    tags: ["animation", "application UI", "landing pages"],
    useCases: ["marketing", "dashboard", "content"],
    website: "https://kokonutui.com/",
  },
  {
    access: "direct",
    addedAt: "2026-09-01",
    delivery: ["components", "blocks"],
    description:
      "An open component collection with an optional Pro registry for larger interface sections.",
    github: "https://github.com/starc007/ui-components",
    logo: "/logos/beui.png",
    name: "beUI",
    pricing: "freemium",
    slug: "beui",
    source: "open-source",
    tags: ["application UI", "forms", "effects"],
    useCases: ["marketing", "dashboard", "content"],
    website: "https://beui.dev/",
  },
  {
    access: "direct",
    addedAt: "2026-09-01",
    delivery: ["blocks"],
    description:
      "Ready-made authentication and application blocks distributed through a shadcn registry.",
    logo: "/logos/efferd.png",
    name: "Efferd",
    pricing: "freemium",
    slug: "efferd",
    source: "source-available",
    tags: ["authentication", "application UI", "saas"],
    useCases: ["dashboard", "commerce"],
    website: "https://efferd.com/",
  },
  {
    access: "purchase-required",
    addedAt: "2026-09-01",
    delivery: ["blocks", "templates"],
    description:
      "Premium marketing sections and templates delivered as a private shadcn registry.",
    logo: "/logos/tailark.svg",
    name: "Tailark",
    pricing: "paid",
    slug: "tailark",
    source: "proprietary",
    tags: ["landing pages", "saas", "marketing"],
    useCases: ["marketing", "commerce", "content"],
    website: "https://tailark.com/",
  },
  {
    access: "direct",
    addedAt: "2026-09-01",
    delivery: ["components", "blocks"],
    description:
      "Open UI components and interface sections from Coss, formerly published as Origin UI.",
    github: "https://github.com/cosscom/coss",
    logo: "/logos/coss-ui.ico",
    name: "coss ui",
    pricing: "free",
    slug: "coss-ui",
    source: "open-source",
    tags: ["application UI", "forms", "navigation"],
    useCases: ["dashboard", "commerce", "content"],
    website: "https://coss.com/ui",
  },
  {
    access: "direct",
    addedAt: "2026-09-01",
    delivery: ["components"],
    description:
      "Animated React components for text, backgrounds, and interactions with shadcn CLI support.",
    github: "https://github.com/DavidHDev/react-bits",
    logo: "/logos/react-bits.ico",
    name: "React Bits",
    pricing: "freemium",
    slug: "react-bits",
    source: "source-available",
    tags: ["animation", "text effects", "backgrounds"],
    useCases: ["marketing", "content"],
    website: "https://reactbits.dev/get-started/introduction",
  },
] satisfies Library[];
