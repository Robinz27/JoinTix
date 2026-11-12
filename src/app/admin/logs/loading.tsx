import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

// ประวัติการใช้งาน while the rows load: the header, the figures, the filters and a list of rows
export default function Loading() {
  return (
    <LoadingRegion>
      <div className="mb-5 space-y-2 sm:mb-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-60 max-w-full rounded-lg sm:h-9" />
        <Skeleton className="h-3.5 w-72 max-w-full" />
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mb-4 h-44 rounded-2xl" />
      <div className="space-y-px overflow-hidden rounded-2xl border border-border">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
            <Skeleton className="size-9 shrink-0 rounded-full max-[359px]:hidden" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-2.5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
