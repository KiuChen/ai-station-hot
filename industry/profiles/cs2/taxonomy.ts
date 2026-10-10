export const CATEGORIES = [
  {
    "key": "cs2-updates",
    "label": "更新",
    "section": "更新",
    "guide": "游戏版本、地图、平衡与官方更新"
  },
  {
    "key": "cs2-esports",
    "label": "赛事",
    "section": "赛事",
    "guide": "赛事、比赛结果与赛程"
  },
  {
    "key": "cs2-teams",
    "label": "战队",
    "section": "战队",
    "guide": "战队、选手与阵容动态"
  },
  {
    "key": "cs2-guides",
    "label": "攻略",
    "section": "攻略",
    "guide": "战术、训练与游戏技巧"
  },
  {
    "key": "cs2-equipment",
    "label": "装备",
    "section": "装备",
    "guide": "外设、设置与装备实测"
  },
  {
    "key": "cs2-community",
    "label": "社区",
    "section": "社区",
    "guide": "社区项目、创作与讨论"
  }
] as const;
export { ITEM_TYPES } from "../../taxonomy-ai.ts";
export const CATEGORY_TAGS = ["更新", "赛事", "战队", "攻略", "装备", "社区", "其他"] as const;
export const TOPIC_TAGS = ["官方更新", "赛事", "战队", "选手", "战术", "训练", "地图", "设置", "外设", "社区创作"] as const;
export const ENTITY_TAGS: readonly string[] = [];
export const TAG_SYNONYMS: Readonly<Record<string,string>> = {};
export const CATEGORY_BY_ITEM_TYPE: Readonly<Record<string,string>> = {"model_release": "更新", "product_launch": "更新", "tool_or_prompt": "赛事", "research_paper": "攻略", "industry_event": "装备", "opinion_analysis": "社区", "tutorial_explainer": "赛事"};
export const ENTITIES: typeof import("../../taxonomy-ai.ts").ENTITIES = {};
export const IDENTITY_LEXICON: typeof import("../../taxonomy-ai.ts").IDENTITY_LEXICON = [];
export const PUBLISHER_DOMAINS: typeof import("../../taxonomy-ai.ts").PUBLISHER_DOMAINS = [];
export const IDENTITY_CONTEXT_ALIASES: typeof import("../../taxonomy-ai.ts").IDENTITY_CONTEXT_ALIASES = [];
