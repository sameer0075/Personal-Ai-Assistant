"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { tokens } from "@/lib/theme";
import { useAuth } from "@/lib/auth/AuthProvider";
import AuthLayout from "@/components/auth/AuthLayout";
import PasswordField from "@/components/auth/PasswordField";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong signing in");
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to pick up where you left off."
      footer={
        <Typography variant="body2" sx={{ color: tokens.muted }}>
          New here?{" "}
          <Typography
            component={Link}
            href="/signup"
            variant="body2"
            sx={{ color: tokens.accentBright, fontWeight: 600, textDecoration: "none" }}
          >
            Create an account
          </Typography>
        </Typography>
      }
    >
      <Stack component="form" onSubmit={handleSubmit} spacing={2}>
        {error && (
          <Alert severity="error" sx={{ borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
          required
          fullWidth
        />

        <PasswordField
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          fullWidth
        />

        <Button
          type="submit"
          variant="contained"
          disableElevation
          disabled={isSubmitting}
          sx={{
            py: 1.1,
            background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})`,
            "&:hover": { background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})` },
          }}
        >
          {isSubmitting ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Log in"}
        </Button>
      </Stack>
    </AuthLayout>
  );
}