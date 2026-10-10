import { channelSwitchHref } from "./channel-switch";
import { forwardRef, type ComponentProps } from "react";
import { Link as RouterLink, NavLink as RouterNavLink, useLocation, useNavigate as routerUseNavigate, type LinkProps, type NavLinkProps, type To, type NavigateOptions, Form as RouterForm, type FormProps } from "react-router";
import { CHANNELS, channelForPath, channelPath, type EditorialChannel } from "@aihot/industry/channels";
export function useCurrentChannel() { return channelForPath(useLocation().pathname); }
function toChannel(to: To, key: EditorialChannel): To {
  return typeof to === "string" ? channelPath(to,key) : { ...to, ...(to.pathname ? {pathname:channelPath(to.pathname,key)} : {}) };
}
export const Link = forwardRef<HTMLAnchorElement,LinkProps>(function Link(props,ref) { const c=useCurrentChannel(); return <RouterLink {...props} ref={ref} to={toChannel(props.to,c.key)} />; });
export const NavLink = forwardRef<HTMLAnchorElement,NavLinkProps>(function NavLink(props,ref) { const c=useCurrentChannel(); return <RouterNavLink {...props} ref={ref} to={toChannel(props.to,c.key)} />; });
export function useNavigate() { const navigate=routerUseNavigate(); const c=useCurrentChannel(); return ((to:To|number,opts?:NavigateOptions) => typeof to === "number" ? navigate(to) : navigate(toChannel(to,c.key),opts)) as typeof navigate; }
export function Anchor(props:ComponentProps<"a">) { const c=useCurrentChannel();return <a {...props} href={props.href ? channelPath(props.href,c.key) : undefined} />; }
export function Form(props:ComponentProps<"form">) { const c=useCurrentChannel();return <form {...props} action={typeof props.action === "string" ? channelPath(props.action,c.key) : props.action} />; }
export function ChannelSwitcher({ admin = false, className = "" }: { admin?: boolean; className?: string }) {
  const channel = useCurrentChannel();
  const location = useLocation();
  const navigate = routerUseNavigate();
  return (
    <nav aria-label="资讯频道" className={`grid grid-cols-4 gap-1 rounded-control bg-bg-sunk p-1 lg:grid-cols-2 ${className}`}>
      {CHANNELS.map((target) => (
        <RouterLink
          key={target.key}
          to={channelSwitchHref(location.pathname, location.search, target.key, admin)}
          onClick={(event) => {
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            const input = [...document.querySelectorAll<HTMLInputElement>('input[name="q"]')].find((field) => field.getClientRects().length > 0);
            const destination = channelSwitchHref(location.pathname, location.search, target.key, admin, input?.value);
            event.preventDefault();
            void navigate(destination);
          }}
          aria-current={channel.key === target.key ? 'page' : undefined}
          className={`flex min-h-11 min-w-0 items-center justify-center rounded-control px-2 py-1.5 text-center text-[13px] lg:flex-col ${channel.key === target.key ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-3 hover:text-ink"}`}
        >
          <span className="block">{target.label}</span>{target.pilot && <span className="hidden text-[11px] opacity-70 lg:block">{target.dataReady ? "试运行" : "待启用"}</span>}
        </RouterLink>
      ))}
    </nav>
  );
}

export function ScopedRouterForm(props:FormProps) {const c=useCurrentChannel();return <RouterForm {...props} action={props.action ? channelPath(props.action,c.key) : undefined} />;}
