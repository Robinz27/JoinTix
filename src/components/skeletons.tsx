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

/** The /events page's list: search box, filter chips and a grid of cards (components/event-browser.tsx) */
export function EventsGridSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="h-10 w-full rounded-full sm:flex-1" />
        <div className="flex flex-wrap gap-1.5">
          {[16, 16, 20, 28].map((w, i) => (
            <Skeleton key={i} className="h-8 rounded-full" style={{ width: `${w * 0.25}rem` }} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <EventCardSkeleton key={i} />
        ))}
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

/** Event page, mirrors app/events/[id]/page.tsx: poster and facts on the left, the ticket panel beside them */
export function EventPageSkeleton() {
  return (
    <main className="flex flex-1 justify-center px-3 pt-6 pb-16 sm:pt-8">
      <div className="w-full max-w-5xl">
        <SkeletonText lineClassName="mb-4 h-5" className="h-3.5 w-24" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
          <div className="flex flex-col gap-5 sm:flex-row">
            <Skeleton className="aspect-[4/5] w-full shrink-0 rounded-2xl sm:w-56" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-8 w-3/4 rounded-lg" />
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-4 w-56" />
              ))}
            </div>
          </div>
          <div className="space-y-2 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <Skeleton className="mb-3 h-6 w-28" />
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
            <Skeleton className="mt-4 h-11 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </main>
  );
}

/** Profile page, mirrors app/profile/page.tsx: name header, details card, email card */
export function ProfileSkeleton() {
  return (
    <main className="flex flex-1 justify-center px-3 pt-8 pb-16 sm:pt-10">
      <div className="w-full max-w-xl space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-40 rounded-lg" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <Skeleton className="mb-1 h-4 w-24" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-64" />
          ))}
        </div>
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>
    </main>
  );
}

/** หลังบ้าน content area: header, four stat cards and two panels, mirrors app/admin/page.tsx */
export function AdminContentSkeleton() {
  return (
    <div>
      <div className="mb-5 space-y-2 sm:mb-6">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-56 rounded-lg sm:h-9" />
        <Skeleton className="h-3.5 w-64 max-w-full" />
      </div>
      <Skeleton className="mb-2.5 h-4 w-20" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-2xl sm:h-[138px]" />
        ))}
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    </div>
  );
}

/** The whole back office while the session is checked, mirrors components/admin/admin-shell.tsx */
export function AdminSkeleton() {
  return (
    <div className="flex min-h-svh">
      <div className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
          <Skeleton className="size-7 rounded-lg" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-1.5 px-2.5 py-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <div className="flex h-14 items-center gap-3 border-b border-border px-3 sm:px-5 lg:hidden">
          <Skeleton className="size-5 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="px-3 py-5 sm:px-5 sm:py-6">
          <div className="mx-auto max-w-6xl">
            <AdminContentSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
