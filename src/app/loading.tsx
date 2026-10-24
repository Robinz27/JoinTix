import { BannerSkeleton, EventsSkeleton, HeroSkeleton } from "@/components/skeletons";
import { LoadingRegion } from "@/components/ui/skeleton";

// Shown at once while the home page loads, and for any route without a loading.tsx of its own
export default function Loading() {
  return (
    <LoadingRegion className="flex flex-1 flex-col pb-16">
      <HeroSkeleton />
      <BannerSkeleton />
      <EventsSkeleton />
    </LoadingRegion>
  );
}
