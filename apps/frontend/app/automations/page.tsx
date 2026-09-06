import AutomationsView from "./AutomationsView";
import RequireAuth from "@/lib/auth/RequireAuth";

export default function AutomationsPage() {
  return (
    <RequireAuth>
      <AutomationsView />
    </RequireAuth>
  );
}