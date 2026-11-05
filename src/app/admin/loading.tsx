import { AdminContentSkeleton } from "@/components/skeletons";
import { LoadingRegion } from "@/components/ui/skeleton";

// Between the back office's tabs: the menu stays, only the content area waits
export default function Loading() {
  return (
    <LoadingRegion>
      <AdminContentSkeleton />
    </LoadingRegion>
  );
}
