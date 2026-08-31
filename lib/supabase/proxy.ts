import { createServerClient } from "@supabase/ssr";
import {
  NextResponse,
  type NextRequest,
} from "next/server";

export async function updateSession(
  request: NextRequest
) {
  let supabaseResponse =
    NextResponse.next({
      request,
    });

  const supabase =
    createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(cookiesToSet) {
            cookiesToSet.forEach(
              ({ name, value }) =>
                request.cookies.set(
                  name,
                  value
                )
            );

            supabaseResponse =
              NextResponse.next({
                request,
              });

            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) =>
                supabaseResponse.cookies.set(
                  name,
                  value,
                  options
                )
            );
          },
        },
      }
    );

  const pathname =
    request.nextUrl.pathname;

  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname === "/prenota" ||
    pathname.startsWith("/api/availability") ||
    pathname.startsWith("/api/reservations") ||
    pathname.startsWith("/api/booking-link");

  if (isPublicRoute) {
    return supabaseResponse;
  }

  const { data } =
    await supabase.auth.getClaims();

  const user =
    data?.claims;

  if (!user) {
    const url =
      request.nextUrl.clone();

    url.pathname = "/login";

    return NextResponse.redirect(
      url
    );
  }

  return supabaseResponse;
}