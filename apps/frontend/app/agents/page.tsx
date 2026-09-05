import AgentsView from "./AgentsView";
import RequireAuth from "@/lib/auth/RequireAuth";

export default function AgentsPage() {
  return (
    <RequireAuth>
      <AgentsView />
    </RequireAuth>
  );
}