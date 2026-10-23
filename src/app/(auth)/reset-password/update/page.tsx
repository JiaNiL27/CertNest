import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthForm } from "../../auth-form";
import { updatePassword } from "../../actions";

// Reached from the reset email via /auth/callback, which signs the user in.
// The proxy requires a session here.
export default function UpdatePasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
      </CardHeader>
      <CardContent>
        <AuthForm
          action={updatePassword}
          submitLabel="Update password"
          fields={[
            {
              name: "password",
              label: "New password (at least 8 characters)",
              type: "password",
              autoComplete: "new-password",
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}
