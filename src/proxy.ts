import { NextResponse, type NextRequest } from "next/server";
import { isOnboarded } from "@/lib/onboarding";

/** Sends the first visit to the welcome page, and the welcome page home once it's done. */
export function proxy(request: NextRequest) {
  const onWelcome = request.nextUrl.pathname === "/welcome";
  const onboarded = isOnboarded();
  if (!onboarded && !onWelcome) return NextResponse.redirect(new URL("/welcome", request.url));
  if (onboarded && onWelcome) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = {
  // Pages only: skip API routes, Next internals and anything with a file extension (icons, images).
  matcher: ["/((?!api/|_next/|.*\\.[\\w]+$).*)"],
};
