"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { tokens } from "@/lib/theme";
import { useAuth } from "./AuthProvider";

/** Wrap any page's content in this to require a logged-in user, redirecting to /login otherwise. */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", bgcolor: tokens.bg }}>
        <CircularProgress size={22} sx={{ color: tokens.mutedDim }} />
      </Box>
    );
  }

  return <>{children}</>;
}