import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/db";
import { extractPages } from "@/lib/pdf";
import { insertDocument } from "@/lib/repo";

const MAX_BYTES = 100 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "PDF is larger than 100 MB." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
    return Response.json({ error: `"${file.name}" is not a PDF.` }, { status: 400 });
  }

  let pages: string[];
  try {
    // pdf.js may take ownership of the buffer, so give it a copy.
    pages = await extractPages(bytes.slice());
  } catch (err) {
    return Response.json(
      { error: `Could not read "${file.name}": ${err instanceof Error ? err.message : err}` },
      { status: 422 },
    );
  }

  const id = randomUUID();
  const fileName = `${id}.pdf`;
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), bytes);

  insertDocument(
    {
      id,
      name: file.name.replace(/\.pdf$/i, ""),
      fileName,
      size: file.size,
      pageCount: pages.length,
      charCount: pages.reduce((n, p) => n + p.length, 0),
      createdAt: Date.now(),
    },
    pages,
  );

  return Response.json({ id });
}
