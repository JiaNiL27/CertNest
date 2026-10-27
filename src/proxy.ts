import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { checkPublicLink } from "@/lib/sharing/link-check";

// Routes reachable without a session. Everything else requires login.
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/reset-password",
  "/auth/callback",
  "/link-unavailable",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) =>
    p.endsWith("/") ? pathname.startsWith(p) : pathname === p,
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public share pages never use the visitor's session. Invalid links get a
  // real 404 here, before the page starts streaming.
  if (pathname.startsWith("/p/") || pathname.startsWith("/b/") || pathname.startsWith("/u/")) {
    if ((await checkPublicLink(pathname)) === "invalid") {
      return NextResponse.rewrite(new URL("/link-unavailable", request.url), { status: 404 });
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Refreshes the session and validates it with the Auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
