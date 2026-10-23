"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export type FormState = { error?: string; message?: string };

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8).max(72);

const GENERIC_ERROR = "Something went wrong. Please try again.";

// Server-side diagnostics only: never log emails, passwords or tokens.
function logAuthError(action: string, error: { name: string; status?: number; code?: string }) {
  console.error(`[auth] ${action} failed`, {
    name: error.name,
    status: error.status,
    code: error.code,
  });
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ email, password: z.string().min(1).max(72) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid email or password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    logAuthError("login", error);
    // Only reachable with the correct password, so it reveals nothing new.
    if (error.code === "email_not_confirmed") {
      return { error: "Please confirm your email before signing in." };
    }
    return { error: "Invalid email or password." };
  }
  redirect("/dashboard");
}

export async function signup(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      email,
      password,
      display_name: z.string().trim().max(80).optional().default(""),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error:
        "Enter a valid email and a password of 8–72 characters. Display name is limited to 80 characters.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/dashboard`,
      data: { display_name: parsed.data.display_name },
    },
  });
  if (error) {
    logAuthError("signup", error);
    if (error.code === "weak_password") {
      return { error: "That password is too weak. Please choose a stronger one." };
    }
    if (error.status === 429) {
      return { error: "Too many attempts. Please wait a while and try again." };
    }
    // Delivery problems say nothing about whether the account exists.
    if (error.code === "email_address_not_authorized" || error.code === "email_address_invalid") {
      return { error: "We couldn't send a confirmation email to this address." };
    }
    return { error: GENERIC_ERROR };
  }
  // With email confirmation on, Supabase answers the same way for existing
  // emails, so this message never reveals whether an account exists.
  return {
    message: "Check your email for a confirmation link to finish signing up.",
  };
}

export async function requestPasswordReset(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = z.object({ email }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/reset-password/update`,
  });
  if (error) logAuthError("password reset", error);
  // Never reveal whether the email exists.
  return {
    message: "If an account exists for that email, we've sent a password reset link.",
  };
}

export async function updatePassword(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = z.object({ password }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Password must be 8–72 characters." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logAuthError("password update", error);
    if (error.code === "weak_password") {
      return { error: "That password is too weak. Please choose a stronger one." };
    }
    if (error.code === "same_password") {
      return { error: "Choose a password different from your current one." };
    }
    return { error: GENERIC_ERROR };
  }
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
