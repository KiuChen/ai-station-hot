import * as AI from "./taxonomy-ai.ts";
import * as BEAUTY from "./profiles/beauty/taxonomy.ts";
import * as CS2 from "./profiles/cs2/taxonomy.ts";
import * as ART from "./profiles/art/taxonomy.ts";
import { PROFILE_KEY } from "./profile.ts";
export function taxonomyForChannel(key: typeof PROFILE_KEY) { return { ai: AI, art: ART, beauty: BEAUTY, cs2: CS2 }[key]; }
const selected = taxonomyForChannel(PROFILE_KEY);
export const ALL_CATEGORIES = [...AI.CATEGORIES, ...ART.CATEGORIES, ...BEAUTY.CATEGORIES, ...CS2.CATEGORIES] as const;
export const CATEGORIES = selected.CATEGORIES;
export const ITEM_TYPES = selected.ITEM_TYPES;
export const CATEGORY_TAGS = selected.CATEGORY_TAGS;
export const TOPIC_TAGS = selected.TOPIC_TAGS;
export const ENTITY_TAGS = selected.ENTITY_TAGS;
export const TAG_SYNONYMS = selected.TAG_SYNONYMS;
export const CATEGORY_BY_ITEM_TYPE = selected.CATEGORY_BY_ITEM_TYPE;
export const ENTITIES = selected.ENTITIES;
export const IDENTITY_LEXICON = selected.IDENTITY_LEXICON;
export const PUBLISHER_DOMAINS = selected.PUBLISHER_DOMAINS;
export const IDENTITY_CONTEXT_ALIASES = selected.IDENTITY_CONTEXT_ALIASES;
