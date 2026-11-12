import { EventsGridSkeleton } from "@/components/skeletons";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion className="flex flex-1 justify-center px-3 pt-8 pb-16 sm:pt-10">
      <div className="w-full min-w-0 max-w-5xl space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-52" />
        </div>
        <EventsGridSkeleton />
      </div>
    </LoadingRegion>
  );
}
