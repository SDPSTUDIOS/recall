import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

/** Extracts text per page (index 0 = page 1). */
export async function extractPages(data: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: false });
  return text.map((t) => t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim());
}
