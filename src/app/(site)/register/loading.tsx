import { AuthCardSkeleton } from "@/components/skeletons";
import { LoadingRegion } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion className="flex flex-1 flex-col">
      <AuthCardSkeleton fields={5} />
    </LoadingRegion>
  );
}
