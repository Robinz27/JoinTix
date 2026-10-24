import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

// Page and section skeletons. Each mirrors the real layout's container, spacing and heights (named in its
// comment) so the content drops into place without the page shifting.

/** Home hero, mirrors the first <section> of app/page.tsx */
export function HeroSkeleton() {
  return (
    <section className="flex justify-center px-3 pt-[50px] pb-6 sm:pb-8">
      <div className="flex w-full max-w-5xl flex-col items-center text-center">
        <Skeleton className="mb-10 h-[26px] w-52 rounded-full" />
        <Skeleton className="mb-2 h-9 w-[min(30rem,90%)] rounded-lg sm:h-12" />
        <div className="flex w-full max-w-lg flex-col items-center gap-1.5 py-0.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        <div className="mt-5 flex gap-2">
          <Skeleton className="h-9 w-40 rounded-full" />
          <Skeleton className="size-9 rounded-full" />
        </div>
      </div>
    </section>
  );
}

/** Banner carousel, mirrors components/banner-carousel.tsx */
export function BannerSkeleton() {
  return (
    <section className="px-3 pb-6 sm:pb-8">
      <div className="mx-auto max-w-5xl">
        <Skeleton className="aspect-[5/2] w-full rounded-2xl sm:rounded-3xl" />
        <div className="mt-4 flex justify-center gap-1.5">
          <Skeleton className="h-2 w-6 rounded-full" />
          <Skeleton className="size-2 rounded-full" />
          <Skeleton className="size-2 rounded-full" />
        </div>
      </div>
    </section>
  );
}

/** One event card, mirrors components/event-card.tsx */
export function EventCardSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-2.5 sm:p-3">
      <Skeleton className="mb-3 aspect-[4/5] w-full rounded-xl" />
      <div className="flex flex-1 flex-col px-0.5">
        <SkeletonText lineClassName="mb-1 h-4" className="h-3 w-24" />
        <div className="mb-1.5 space-y-1.5 py-0.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <SkeletonText lineClassName="mb-3 h-4" className="h-3 w-32" />
        <Skeleton className="mt-auto h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Recommended events section: header row and four cards */
export function EventsSkeleton() {
  return (
    <section className="flex justify-center px-3">
      <div className="w-full max-w-5xl">
        <div className="mb-3 flex items-center gap-3 sm:mb-4">
          <Skeleton className="size-9 rounded-xl sm:size-10" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-24" />
          </div>
          <span className="flex-1" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Login / sign-up card, mirrors components/auth/auth-ui.tsx AuthCard with `fields` inputs */
export function AuthCardSkeleton({ fields }: { fields: number }) {
  return (
    <main className="flex flex-1 justify-center px-3 py-10 sm:py-14">
      <div className="w-full max-w-[440px] self-start rounded-2xl border border-border bg-surface px-5 pt-8 pb-6 sm:px-10 sm:pt-10 sm:pb-10">
        <div className="mb-8 flex flex-col items-center gap-2.5">
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="space-y-5">
          {Array.from({ length: fields }, (_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonText className="h-3.5 w-20" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ))}
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </main>
  );
}
