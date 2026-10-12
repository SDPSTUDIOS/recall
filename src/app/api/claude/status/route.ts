import { getClaudeStatus } from "@/lib/claude";

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.has("refresh");
  return Response.json(await getClaudeStatus(force));
}
