import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

// A member's page while it loads: the figures and two cards, under the header and tabs the layout already shows
export default function Loading() {
  return (
    <LoadingRegion>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[4.5rem] rounded-xl" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </LoadingRegion>
  );
}
