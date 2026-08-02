import { Suspense } from "react";
import IntegrationsView from "./IntegrationsView";

// useSearchParams (used in IntegrationsView to read the OAuth callback flag)
// requires a Suspense boundary so Next doesn't bail out of static generation
// for the whole route.
export default function IntegrationsPage() {
  return (
    <Suspense fallback={null}>
      <IntegrationsView />
    </Suspense>
  );
}