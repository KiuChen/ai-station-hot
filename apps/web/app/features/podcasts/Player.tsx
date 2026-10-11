import {useEffect,useRef,useState} from 'react';
import type {PodcastEpisode,PodcastProgram} from '@aihot/contracts/site';

const KEY='ai-station-podcast-progress-v1';
export function podcastTime(seconds:number|null):string {
 if(seconds===null||!Number.isFinite(seconds)||seconds<0)return '时长未注明';
 const whole=Math.floor(seconds),hours=Math.floor(whole/3600),minutes=Math.floor(whole%3600/60),rest=String(whole%60).padStart(2,'0');return hours?`${hours}:${String(minutes).padStart(2,'0')}:${rest}`:`${minutes}:${rest}`;
}
function storedProgress(id:string):number {
 try{const value=JSON.parse(localStorage.getItem(KEY)||'{}')[id];return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=172800?value:0;}catch{return 0;}
}
export function PodcastPlayer({episode,program,onClose}:{episode:PodcastEpisode;program:PodcastProgram;onClose:()=>void}) {
 const ref=useRef<HTMLAudioElement>(null),restored=useRef(false),lastSave=useRef(0),[error,setError]=useState<string|null>(null),[playing,setPlaying]=useState(false),[rate,setRate]=useState('1');
 function save(node=ref.current){if(!node||!restored.current||!Number.isFinite(node.currentTime))return;try{const previous=JSON.parse(localStorage.getItem(KEY)||'{}');previous[episode.id]=node.ended?0:node.currentTime;const entries=Object.entries(previous).slice(-200);localStorage.setItem(KEY,JSON.stringify(Object.fromEntries(entries)));}catch{/* The player remains usable when storage is unavailable. */}}
 useEffect(()=>{const node=ref.current;const store=()=>save(node);window.addEventListener('pagehide',store);return()=>{store();window.removeEventListener('pagehide',store);node?.pause();};},[episode.id]);
 async function ready(){const node=ref.current;if(!node)return;const saved=storedProgress(episode.id);try{if(saved>0)node.currentTime=Number.isFinite(node.duration)?Math.min(saved,Math.max(0,node.duration-1)):saved;}catch{/* Seeking depends on the publisher's audio server. */}restored.current=true;try{await node.play();}catch{setError('请点击播放器的播放按钮继续。');}}
 useEffect(()=>{const node=ref.current;if(node){void node.play().catch(()=>setError('请点击播放器的播放按钮继续。'));}},[episode.id]);
 return <section aria-label="播客播放器" className="card mb-5 border border-accent/30 p-4 sm:p-5">
  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[12px] text-accent" role="status">{playing?'正在收听':'当前播放器'} · {program.name}</p><h2 className="mt-1 text-[17px] font-semibold leading-6 text-ink">{episode.title}</h2></div><button type="button" onClick={onClose} className="min-h-11 shrink-0 px-2 text-[13px] text-ink-3">关闭播放器</button></div>
  <audio ref={ref} controls preload="none" src={episode.audioUrl} aria-label={episode.title} className="mt-3 w-full" onLoadedMetadata={ready} onPlay={()=>{setPlaying(true);setError(null);}} onPause={()=>{setPlaying(false);save();}} onEnded={()=>{setPlaying(false);save();}} onTimeUpdate={()=>{if(Date.now()-lastSave.current>5000){save();lastSave.current=Date.now();}}} onError={()=>setError('音频暂时无法播放，可打开官方页面收听。')} />
  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-ink-3"><label className="inline-flex min-h-11 items-center gap-2">播放速度<select aria-label="播放速度" value={rate} onChange={e=>{setRate(e.target.value);if(ref.current)ref.current.playbackRate=Number(e.target.value);}} className="min-h-9 rounded-control border border-line bg-surface px-2">{['0.75','1','1.25','1.5','2'].map(v=><option key={v} value={v}>{v}×</option>)}</select></label><span>进度仅保存在本机浏览器</span><a href={episode.pageUrl||program.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-accent">官方收听页面 ↗</a></div>
  {error&&<p role="alert" className="mt-2 text-[13px] text-ink-3">{error}</p>}
 </section>;
}
