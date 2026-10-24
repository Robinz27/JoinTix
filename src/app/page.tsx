import { Suspense } from "react";
import Link from "next/link";
import { InformationCircleIcon, Leaf01Icon } from "@hugeicons/core-free-icons";
import { DbStatusDot, DbStatusDotFallback } from "@/components/db-status";
import { DotMatrixLoader } from "@/components/dot-matrix-loader";
import { HeroVeil } from "@/components/hero-veil";
import { Icon } from "@/components/icon";
import { TextAnimate, animateSteps } from "@/components/text-animate";
import { Hint } from "@/components/ui/hint";

const WELCOME = "ยินดีต้อนรับสู่";
const SITE_NAME = "JoinTix";
const DESCRIPTION = "กดบัตรคอนเสิร์ต อีเวนต์ และงานเลี้ยงรุ่น ไว ไม่มีซ้ำ ล็อกที่นั่งให้คุณทันทีที่กด";
/** After the status pill above it (the .stagger entrance: 80ms + 55ms) */
const HERO_START = 0.135;
// The welcome block's timeline: heading letters, then the description's words, then the buttons
const DESCRIBE_AT = HERO_START + (animateSteps(WELCOME) + animateSteps(SITE_NAME)) * 0.03;
const BUTTONS_AT = DESCRIBE_AT + Math.min(animateSteps(DESCRIPTION, "word"), 40) * 0.02 + 0.1;

export default function Home() {
  return (
    <main className="flex flex-1 flex-col pb-16">
      <section className="relative isolate flex justify-center px-3 pt-[50px] pb-10 sm:pb-14 lg:pb-16">
        <HeroVeil />
        <div className="stagger w-full max-w-5xl text-center">
          <div className="mb-10 flex justify-center">
            <div className="flex items-center rounded-full border border-border bg-card px-2 py-1 text-xs outline outline-offset-1 outline-border">
              <span className="mr-1.5 ml-0.5 flex">
                <Suspense fallback={<DbStatusDotFallback />}>
                  <DbStatusDot />
                </Suspense>
              </span>
              <p className="text-shimmer">พร้อมให้บริการแล้วนะ</p>
              <div className="mx-2 h-[10px] w-px bg-border" />
              <DotMatrixLoader />
            </div>
          </div>

          {/* Letter by letter, then the description word by word (components/text-animate.tsx) */}
          <h1 className="stagger-skip mb-2 text-3xl font-semibold tracking-tight text-balance text-foreground min-[360px]:text-4xl sm:text-5xl 2xl:text-6xl">
            <TextAnimate delay={HERO_START} className="inline-block whitespace-nowrap">
              {WELCOME}
            </TextAnimate>{" "}
            <TextAnimate delay={HERO_START} offset={animateSteps(WELCOME)} className="inline-block max-w-full break-words">
              {SITE_NAME}
            </TextAnimate>
          </h1>

          <p className="stagger-skip mx-auto max-w-lg text-xs text-muted-foreground 2xl:max-w-xl 2xl:text-sm">
            <TextAnimate by="word" delay={DESCRIBE_AT} stagger={0.02}>
              {DESCRIPTION}
            </TextAnimate>
          </p>

          <div className="mt-5 flex justify-center gap-2" style={{ animationDelay: `${BUTTONS_AT}s` }}>
            <Link
              href="/register"
              className="inline-flex h-9 items-center gap-1.5 rounded-4xl bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              เริ่มต้นการใช้งาน
              <Icon icon={Leaf01Icon} className="size-4" />
            </Link>
            <Hint label="คู่มือการใช้งาน">
              <Link
                href="/docs"
                prefetch={false}
                aria-label="คู่มือการใช้งาน"
                className="inline-flex size-9 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary-hover"
              >
                <Icon icon={InformationCircleIcon} className="size-4" />
              </Link>
            </Hint>
          </div>
        </div>
      </section>
    </main>
  );
}
