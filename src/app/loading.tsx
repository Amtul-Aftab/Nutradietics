import { Spinner } from "@/components/ui";

export default function Loading() {
  return (
    <div className="route-loading">
      <Spinner size={32} label="Loading page" />
    </div>
  );
}
