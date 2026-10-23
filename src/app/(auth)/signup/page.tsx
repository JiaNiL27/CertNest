import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthForm } from "../auth-form";
import { signup } from "../actions";

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your CertNest account</CardTitle>
      </CardHeader>
      <CardContent>
        <AuthForm
          action={signup}
          submitLabel="Sign up"
          fields={[
            { name: "email", label: "Email", type: "email", autoComplete: "email" },
            {
              name: "password",
              label: "Password (at least 8 characters)",
              type: "password",
              autoComplete: "new-password",
            },
            {
              name: "display_name",
              label: "Display name (optional, shown on your public pages)",
              type: "text",
              autoComplete: "name",
              required: false,
            },
          ]}
        />
      </CardContent>
      <CardFooter className="text-sm">
        <Link href="/login" className="underline">
          Already have an account? Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
