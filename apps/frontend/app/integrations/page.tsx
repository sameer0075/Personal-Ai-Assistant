import { Suspense } from "react";
import IntegrationsView from "./IntegrationsView";
import RequireAuth from "@/lib/auth/RequireAuth";

// useSearchParams (used in IntegrationsView to read the OAuth callback flag)
// requires a Suspense boundary so Next doesn't bail out of static generation
// for the whole route.
export default function IntegrationsPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <IntegrationsView />
      </Suspense>
    </RequireAuth>
  );
}