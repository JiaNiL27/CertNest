import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthForm } from "../auth-form";
import { requestPasswordReset } from "../actions";

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
      </CardHeader>
      <CardContent>
        <AuthForm
          action={requestPasswordReset}
          submitLabel="Send reset link"
          fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
        />
      </CardContent>
      <CardFooter className="text-sm">
        <Link href="/login" className="underline">
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
