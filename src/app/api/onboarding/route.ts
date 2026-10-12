import { markOnboarded } from "@/lib/onboarding";

/** Completes the first-run welcome so it isn't shown again. */
export async function POST() {
  markOnboarded();
  return Response.json({ ok: true });
}
