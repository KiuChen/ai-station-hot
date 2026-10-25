import type {ExhibitionVenue} from '@aihot/contracts/site';

export const VENUE_KINDS:Record<ExhibitionVenue['kind'],string>={museum:'博物馆与文博馆','art-museum':'美术馆与艺术馆','art-space':'艺术中心与展览空间',university:'高校自建场馆'};
export interface VenueFilters {q:string;district:string;kind:string;university:string;subject:string}
export function filterVenues(venues:ExhibitionVenue[],filters:VenueFilters) {
 const q=filters.q.trim().toLocaleLowerCase();
 return venues.filter(v=>(!q||[v.name,...v.aliases,v.university||'',v.address,...v.subjects].join(' ').toLocaleLowerCase().includes(q))&&(!filters.district||v.district===filters.district)&&(!filters.kind||v.kind===filters.kind)&&(!filters.university||v.university===filters.university)&&(!filters.subject||v.subjects.includes(filters.subject))).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
}
export function venuePageHref(filters:VenueFilters,page=1) {
 const query=new URLSearchParams();for(const [k,v] of Object.entries(filters))if(v)query.set(k,v);if(page>1)query.set('page',String(page));
 return '/exhibitions/venues'+(query.size?'?'+query:'');
}
