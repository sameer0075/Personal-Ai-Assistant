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

const MIN_PASSWORD_LENGTH = 8;

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setIsSubmitting(true);
    try {
      await signup(email, password, name.trim() || undefined);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong creating your account");
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up your assistant in under a minute."
      footer={
        <Typography variant="body2" sx={{ color: tokens.muted }}>
          Already have an account?{" "}
          <Typography
            component={Link}
            href="/login"
            variant="body2"
            sx={{ color: tokens.accentBright, fontWeight: 600, textDecoration: "none" }}
          >
            Log in
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
          label="Name"
          placeholder="Jane Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          fullWidth
        />

        <TextField
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          fullWidth
        />

        <PasswordField
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          fullWidth
          error={passwordTooShort}
          helperText={passwordTooShort ? `At least ${MIN_PASSWORD_LENGTH} characters` : " "}
        />

        <PasswordField
          label="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
          fullWidth
          error={passwordsMismatch}
          helperText={passwordsMismatch ? "Passwords don't match" : " "}
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
          {isSubmitting ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Create account"}
        </Button>

        <Typography sx={{ fontSize: 11.5, color: tokens.mutedDim, textAlign: "center" }}>
          By continuing you agree this is a demo app — don't upload anything truly sensitive.
        </Typography>
      </Stack>
    </AuthLayout>
  );
}