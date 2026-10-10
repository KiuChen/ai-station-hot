export const CATEGORIES = [
 {key:"art-exhibitions",label:"展览",section:"展览与机构",guide:"博物馆、美术馆、画廊与展览的公告、常设陈列及策展内容"},
 {key:"art-works",label:"作品",section:"作品与创作者",guide:"绘画、插画、雕塑、装置与作品系列"},
 {key:"art-photography",label:"摄影",section:"摄影",guide:"摄影作品、摄影师与摄影实践"},
 {key:"art-design",label:"设计",section:"设计",guide:"视觉设计、平面设计与艺术书籍"},
 {key:"art-practice",label:"创作教程",section:"创作与学习",guide:"艺术技法、材料、创作过程与可复用实践"},
 {key:"art-perspective",label:"观点",section:"观点与研究",guide:"艺术评论、访谈、艺术史与文化观察"},
] as const;
// Stable internal types; their domain interpretation is supplied by the art prompts.
export { ITEM_TYPES } from "../../taxonomy-ai.ts";
export const CATEGORY_TAGS = ["展览","作品","摄影","设计","创作教程","艺术观点","艺术研究","机构动态","其他"] as const;
export const TOPIC_TAGS = ["绘画","插画","摄影","雕塑","装置","策展","视觉设计","材料技法","艺术史","创作过程","博物馆","常设展","特展","文物"] as const;
export const ENTITY_TAGS: readonly string[] = [];
export const TAG_SYNONYMS: Readonly<Record<string,string>> = {插图:"插画",美术展:"展览",教程:"创作教程",评论:"艺术观点"};
export const CATEGORY_BY_ITEM_TYPE: Readonly<Record<string,string>> = {model_release:"作品",product_launch:"展览",tool_or_prompt:"创作教程",research_paper:"艺术研究",industry_event:"机构动态",opinion_analysis:"艺术观点",tutorial_explainer:"创作教程"};
export const ENTITIES: typeof import("../../taxonomy-ai.ts").ENTITIES = {};
export const IDENTITY_LEXICON: typeof import("../../taxonomy-ai.ts").IDENTITY_LEXICON = [];
export const PUBLISHER_DOMAINS: typeof import("../../taxonomy-ai.ts").PUBLISHER_DOMAINS = [];
export const IDENTITY_CONTEXT_ALIASES: typeof import("../../taxonomy-ai.ts").IDENTITY_CONTEXT_ALIASES = [];
