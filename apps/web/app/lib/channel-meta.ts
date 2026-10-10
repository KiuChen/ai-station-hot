import { CHANNELS } from "@aihot/industry/channels";
import type { MetaDescriptor } from "react-router";
export function scopeMeta(tags:MetaDescriptor[]|undefined,pathname:string):MetaDescriptor[] {
 const c=CHANNELS.find(c=>c.prefix&&(pathname===c.prefix||pathname.startsWith(c.prefix+"/")));
 if(!c)return tags??[];
 const adjust=(value:unknown):unknown=>{
  if(typeof value==="string"&&/^https?:\/\//.test(value)) {
   const u=new URL(value); const site=new URL(typeof window!=="undefined"?window.location.origin:typeof process!=="undefined"?process.env.SITE_URL||"http://localhost:3000":"http://localhost:3000");
   if(u.host===site.host && u.pathname!==c.prefix && !u.pathname.startsWith(c.prefix+"/"))u.pathname=c.prefix+(u.pathname==="/"?"":u.pathname);
   return u.toString();
  }
  if(Array.isArray(value))return value.map(adjust);
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,adjust(v)]));
  return value;
 };
 return (tags??[]).map(t=>adjust(t) as MetaDescriptor);
}
