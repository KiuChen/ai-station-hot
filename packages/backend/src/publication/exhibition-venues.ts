import {readFileSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import type {ExhibitionVenueDirectory} from '@aihot/contracts/site';
import {REPO_ROOT} from '../config.ts';

const publicUrl=z.string().url().refine(value=>{
 const u=new URL(value);
 return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&!/^(localhost|127\.|0\.|\[|10\.|192\.168\.)/i.test(u.hostname)&&!u.hostname.endsWith('.local');
},'Public website URL required');
const venue=z.object({
 id:z.string().regex(/^[a-z0-9-]+$/),name:z.string().min(1),aliases:z.array(z.string()),city:z.literal('北京'),district:z.string(),address:z.string(),
 kind:z.enum(['museum','art-museum','art-space','university']),university:z.string().nullable(),subjects:z.array(z.string()).min(1),
 websiteUrl:publicUrl.nullable(),exhibitionsUrl:publicUrl.nullable(),referenceUrl:publicUrl,referenceLabel:z.string().min(1),
 accessNote:z.string().min(1),verifiedAt:z.iso.datetime(),verification:z.enum(['institution','directory']),notes:z.string(),trackingOrganizations:z.array(z.string()),
});
const schema=z.object({updatedAt:z.iso.datetime(),coverage:z.object({summary:z.string().min(1),sources:z.array(z.object({title:z.string(),url:publicUrl,records:z.number().int().positive().nullable()}))}),venues:z.array(venue)});
export function parseExhibitionVenues(input:unknown):ExhibitionVenueDirectory {
 const data=schema.parse(input),ids=new Set<string>(),names=new Set<string>();
 for(const item of data.venues){
  if(ids.has(item.id)||names.has(item.name))throw new Error('Duplicate exhibition venue: '+item.name);
  if((item.kind==='university')!==Boolean(item.university))throw new Error('University attribution required: '+item.name);
  ids.add(item.id);names.add(item.name);
 }
 return data;
}
let directory:ExhibitionVenueDirectory|undefined;
/** Read once per release. Visiting this directory performs no collection or model calls. */
export function loadExhibitionVenues():ExhibitionVenueDirectory {
 return directory??=parseExhibitionVenues(JSON.parse(readFileSync(path.join(REPO_ROOT,'industry/profiles/art/exhibition-venues.json'),'utf8')));
}
