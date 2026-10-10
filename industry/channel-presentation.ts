import type {EditorialChannel} from './channels.ts';

/** Reader-facing capabilities; selection, taxonomy and collection settings stay in their profiles. */
export const CHANNEL_PRESENTATION = {
 ai: {title:'AI · 今日情报',description:'精选、事件进展与日报，追踪值得关注的 AI 动态。',taskPath:'/daily',taskLabel:'AI 日报',tracking:false,reportsReady:true,contentPaths:['/','/all','/hot','/daily','/topics','/starred'],mobilePaths:['/','/all','/daily','/more']},
 art: {title:'艺术 · 看展与阅读',description:'国内博物馆展览、作品与艺术资讯。',taskPath:'/exhibitions',taskLabel:'国内看展',tracking:true,reportsReady:false,contentPaths:['/','/exhibitions','/all','/topics','/starred'],mobilePaths:['/','/exhibitions','/all','/more']},
 beauty: {title:'美妆 · 时尚阅读',description:'护肤妆发、时尚杂志与品牌动态，保留来源与原文。',taskPath:'/topics',taskLabel:'关注主题',tracking:false,reportsReady:false,contentPaths:['/','/all','/topics','/starred'],mobilePaths:['/','/all','/topics','/more']},
 cs2: {title:'CS2 · 当前赛事',description:'当前顶级赛事阶段、赛事资讯与游戏更新。',taskPath:'/events',taskLabel:'当前顶级赛事',tracking:true,reportsReady:false,contentPaths:['/','/events','/all','/topics','/starred'],mobilePaths:['/','/events','/all','/more']},
} satisfies Record<EditorialChannel,{title:string;description:string;taskPath:string;taskLabel:string;tracking:boolean;reportsReady:boolean;contentPaths:string[];mobilePaths:string[]}>;
