import { Suspense } from "react";
import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthForm } from "../auth-form";
import { login } from "../actions";

async function LinkError({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  if (error !== "link") return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      This link is invalid or has expired. Please try again.
    </p>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to CertNest</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Suspense fallback={null}>
          <LinkError searchParams={searchParams} />
        </Suspense>
        <AuthForm
          action={login}
          submitLabel="Sign in"
          fields={[
            { name: "email", label: "Email", type: "email", autoComplete: "email" },
            {
              name: "password",
              label: "Password",
              type: "password",
              autoComplete: "current-password",
            },
          ]}
        />
      </CardContent>
      <CardFooter className="flex justify-between text-sm">
        <Link href="/signup" className="underline">
          Create an account
        </Link>
        <Link href="/reset-password" className="underline">
          Forgot password?
        </Link>
      </CardFooter>
    </Card>
  );
}
