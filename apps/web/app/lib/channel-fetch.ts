import { channelForPath,channelPath } from "@aihot/industry/channels";
export function channelFetch(input:RequestInfo|URL,init?:RequestInit) {
 const target=typeof input==="string" && typeof window!=="undefined" ? channelPath(input,channelForPath(window.location.pathname).key) : input;
 return fetch(target,init);
}
