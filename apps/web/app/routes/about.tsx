import { scopeMeta } from "../lib/channel-meta";
import { Anchor } from "../lib/channel-ui";
import { ABOUT, SITE } from "@aihot/industry/site";
import { pageMeta, organizationLd } from "../lib/seo";
import { Kicker } from "../components/ui/Kicker";
import { buttonClass } from "../components/ui/Controls";
import { LegalFooterLinks } from "../features/copy/CopyPage";

export function headers() {
  return { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" };
}

function baseMeta() {
  return pageMeta({ title: "关于", description: `由 ${ABOUT.identity.name} 维护的个人 AI 资讯站。`, path: "/about", image: "/og/pages/about.png", jsonLd: organizationLd() });
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[var(--page-max-reading)] pb-14 pt-6 lg:pt-3">
      <header className="border-b border-line pb-10 sm:pb-14">
        <Kicker>{ABOUT.kicker}</Kicker>
        <h1 className="mt-5 text-[34px] font-black leading-[1.18] tracking-[-0.03em] text-ink sm:text-[46px] xl:text-[56px] 2xl:text-[64px]">
          {ABOUT.identity.name}
        </h1>
        <p className="mt-5 text-[15.5px] leading-[1.85] text-ink-3 xl:text-[17px]">{ABOUT.identity.role}。</p>
        <Anchor href={ABOUT.identity.url} target="_blank" rel="noopener noreferrer" className={`${buttonClass("secondary", "lg")} mt-7`}>GitHub · {ABOUT.identity.name}</Anchor>
      </header>
      <div className="mt-8">
        <LegalFooterLinks links={[{ to: "/terms", label: "使用规则" }, { to: "/privacy", label: "隐私说明" }]} note={SITE.footerNote ?? ""} />
      </div>
    </div>
  );
}

export function meta(args: { location: { pathname: string } }) { return scopeMeta(baseMeta(),args.location.pathname); }
