import Link from "next/link";
import { Logo } from "@/components/Logo";
import { NotFoundCard } from "@/components/NotFoundCard";

/** Unmatched URLs render outside the app layout, so this one carries the logo. */
export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <Link href="/" aria-label="Recall home" className="mx-auto mb-8 flex w-fit rounded-lg">
        <Logo className="text-lg" />
      </Link>
      <NotFoundCard />
    </div>
  );
}
