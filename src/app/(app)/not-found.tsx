import { NotFoundCard } from "@/components/NotFoundCard";

/** notFound() from app pages, shown inside the app header and footer. */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-10">
      <NotFoundCard />
    </div>
  );
}
