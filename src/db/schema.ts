import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const libraries = sqliteTable(
  "libraries",
  {
    /** 获取组件库内容所需的访问方式。 */
    access: text("access").notNull(),
    /** 组件库加入目录的业务日期，格式为 YYYY-MM-DD。 */
    addedAt: text("added_at").notNull(),
    /** 数据库记录的创建时间。 */
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    /** 用于列表和详情页展示的组件库简介。 */
    description: text("description").notNull(),
    /** 精选列表中的人工排序位次；为空表示未精选。 */
    featuredRank: integer("featured_rank"),
    /** GitHub 仓库的完整 URL；为空表示未关联仓库。 */
    github: text("github"),
    /** 仅供数据库内部关联使用的自增主键。 */
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** 站点 public 目录下的 Logo 路径；为空表示没有本地图标。 */
    logo: text("logo"),
    /** 组件库的展示名称。 */
    name: text("name").notNull(),
    /** 组件库的收费模式。 */
    pricing: text("pricing").notNull(),
    /** 用于公开 URL 的唯一 kebab-case 标识。 */
    slug: text("slug").notNull(),
    /** 组件库源码的开放程度。 */
    source: text("source").notNull(),
    /** 数据库记录的最后更新时间。 */
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    /** 组件库官方网站的完整 URL。 */
    website: text("website").notNull(),
  },
  (table) => [
    uniqueIndex("libraries_slug_unique").on(table.slug),
    uniqueIndex("libraries_featured_rank_unique").on(table.featuredRank),
    check(
      "libraries_slug_check",
      sql`length(${table.slug}) > 0
        and ${table.slug} not glob '*[^a-z0-9-]*'
        and ${table.slug} not like '-%'
        and ${table.slug} not like '%-'
        and ${table.slug} not like '%--%'`
    ),
    check(
      "libraries_source_check",
      sql`${table.source} in ('open-source', 'source-available', 'proprietary', 'undisclosed')`
    ),
    check(
      "libraries_pricing_check",
      sql`${table.pricing} in ('free', 'freemium', 'paid', 'undisclosed')`
    ),
    check(
      "libraries_access_check",
      sql`${table.access} in ('direct', 'login-required', 'purchase-required', 'undisclosed')`
    ),
    check(
      "libraries_added_at_check",
      sql`length(${table.addedAt}) = 10
        and ${table.addedAt} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        and date(${table.addedAt}) = ${table.addedAt}`
    ),
    check(
      "libraries_featured_rank_check",
      sql`${table.featuredRank} is null or ${table.featuredRank} > 0`
    ),
  ]
);

export const libraryDeliveries = sqliteTable(
  "library_deliveries",
  {
    /** 所属组件库的主键。 */
    libraryId: integer("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    /** 在所属组件库交付类型列表中的零基顺序。 */
    position: integer("position").notNull(),
    /** 交付类型，如组件、区块或模板。 */
    value: text("value").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.libraryId, table.value] }),
    uniqueIndex("library_deliveries_position_unique").on(
      table.libraryId,
      table.position
    ),
    index("library_deliveries_value_idx").on(table.value),
    check(
      "library_deliveries_value_check",
      sql`${table.value} in ('components', 'blocks', 'templates')`
    ),
    check("library_deliveries_position_check", sql`${table.position} >= 0`),
  ]
);

export const libraryUseCases = sqliteTable(
  "library_use_cases",
  {
    /** 所属组件库的主键。 */
    libraryId: integer("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    /** 在所属组件库使用场景列表中的零基顺序。 */
    position: integer("position").notNull(),
    /** 组件库适用的场景分类。 */
    value: text("value").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.libraryId, table.value] }),
    uniqueIndex("library_use_cases_position_unique").on(
      table.libraryId,
      table.position
    ),
    index("library_use_cases_value_idx").on(table.value),
    check(
      "library_use_cases_value_check",
      sql`${table.value} in ('marketing', 'dashboard', 'commerce', 'content', 'data-display', 'ai')`
    ),
    check("library_use_cases_position_check", sql`${table.position} >= 0`),
  ]
);

export const libraryTags = sqliteTable(
  "library_tags",
  {
    /** 所属组件库的主键。 */
    libraryId: integer("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    /** 在所属组件库标签列表中的零基顺序。 */
    position: integer("position").notNull(),
    /** 用于搜索和筛选的自由文本标签。 */
    value: text("value").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.libraryId, table.value] }),
    uniqueIndex("library_tags_position_unique").on(
      table.libraryId,
      table.position
    ),
    index("library_tags_value_idx").on(table.value),
    check("library_tags_value_check", sql`length(trim(${table.value})) > 0`),
    check("library_tags_position_check", sql`${table.position} >= 0`),
  ]
);

export const githubMetrics = sqliteTable(
  "github_metrics",
  {
    /** 默认分支最近一次提交的时间；为空表示未知。 */
    latestCommitAt: text("latest_commit_at"),
    /** 所属组件库的主键；同时保证每个组件库最多一条快照。 */
    libraryId: integer("library_id")
      .primaryKey()
      .references(() => libraries.id, { onDelete: "cascade" }),
    /** 同步时记录的 GitHub Star 数量。 */
    stars: integer("stars").notNull(),
    /** 本条 GitHub 指标成功同步的时间。 */
    syncedAt: text("synced_at").notNull(),
  },
  (table) => [
    index("github_metrics_stars_idx").on(table.stars),
    index("github_metrics_latest_commit_at_idx").on(table.latestCommitAt),
    check("github_metrics_stars_check", sql`${table.stars} >= 0`),
    check(
      "github_metrics_latest_commit_at_check",
      sql`${table.latestCommitAt} is null or datetime(${table.latestCommitAt}) is not null`
    ),
    check(
      "github_metrics_synced_at_check",
      sql`datetime(${table.syncedAt}) is not null`
    ),
  ]
);
