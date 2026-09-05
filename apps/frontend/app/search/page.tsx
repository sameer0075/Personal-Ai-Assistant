import SearchView from "./SearchView";
import RequireAuth from "@/lib/auth/RequireAuth";

export default function SearchPage() {
  return (
    <RequireAuth>
      <SearchView />
    </RequireAuth>
  );
}