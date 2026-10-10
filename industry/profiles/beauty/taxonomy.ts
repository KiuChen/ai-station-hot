export const CATEGORIES = [
  {
    "key": "beauty-new",
    "label": "新品",
    "section": "新品",
    "guide": "彩妆、护肤、美妆工具、服饰系列与配饰的发布"
  },
  {
    "key": "beauty-tutorials",
    "label": "教程",
    "section": "教程",
    "guide": "妆容、护肤流程与实用步骤"
  },
  {
    "key": "beauty-reviews",
    "label": "测评",
    "section": "测评",
    "guide": "有方法和证据的产品比较与评测"
  },
  {
    "key": "beauty-ingredients",
    "label": "成分",
    "section": "成分",
    "guide": "成分、配方与相关研究"
  },
  {
    "key": "beauty-industry",
    "label": "行业",
    "section": "行业",
    "guide": "美妆与时尚品牌、市场、秀场、工艺、法规及行业动态"
  },
  {
    "key": "beauty-perspective",
    "label": "观点",
    "section": "观点",
    "guide": "审美趋势、访谈与分析"
  }
] as const;
export { ITEM_TYPES } from "../../taxonomy-ai.ts";
export const CATEGORY_TAGS = ["新品", "教程", "测评", "成分", "行业", "观点", "其他"] as const;
export const TOPIC_TAGS = ["彩妆", "护肤", "妆容", "配方", "成分", "产品比较", "使用方法", "审美趋势", "时尚", "秀场", "奢侈品牌", "配饰", "工艺", "巴黎世家", "爱马仕"] as const;
export const ENTITY_TAGS: readonly string[] = ["巴黎世家","爱马仕"];
export const TAG_SYNONYMS: Readonly<Record<string,string>> = {};
export const CATEGORY_BY_ITEM_TYPE: Readonly<Record<string,string>> = {"model_release": "新品", "product_launch": "新品", "tool_or_prompt": "教程", "research_paper": "成分", "industry_event": "行业", "opinion_analysis": "观点", "tutorial_explainer": "教程"};
export const ENTITIES: typeof import("../../taxonomy-ai.ts").ENTITIES = {balenciaga:{name:"Balenciaga",displayTag:"巴黎世家",aliases:["Balenciaga","巴黎世家"]},hermes:{name:"Hermès",displayTag:"爱马仕",aliases:["Hermès","Hermes","爱马仕"]}};
export const IDENTITY_LEXICON: typeof import("../../taxonomy-ai.ts").IDENTITY_LEXICON = [];
export const PUBLISHER_DOMAINS: typeof import("../../taxonomy-ai.ts").PUBLISHER_DOMAINS = [];
export const IDENTITY_CONTEXT_ALIASES: typeof import("../../taxonomy-ai.ts").IDENTITY_CONTEXT_ALIASES = [];
