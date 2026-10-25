import {Link} from '../../lib/channel-ui';
export function ExhibitionNavigation({venues=false}:{venues?:boolean}) {
 return <nav aria-label="看展内容" className="my-5 flex flex-wrap gap-2 text-[14px]">
  {[{to:'/exhibitions',label:'展览动态',active:!venues},{to:'/exhibitions/venues',label:'北京场馆与高校',active:venues}].map(item=><Link key={item.to} to={item.to} aria-current={item.active?'page':undefined} className={'inline-flex min-h-11 items-center rounded-full border px-4 '+(item.active?'border-accent bg-accent text-accent-contrast':'border-line bg-surface text-ink-3')}>{item.label}</Link>)}
 </nav>;
}
