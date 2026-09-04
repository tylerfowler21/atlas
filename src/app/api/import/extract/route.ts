import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user";
import { unauthorized } from "@/lib/api";
import { extractText } from "@/lib/extract-text";

/// Two megabytes. A list of places is words; anything larger is a document
/// with pictures in it, and reading it would not produce a better list.
const MAX_BYTES = 2 * 1024 * 1024;

/// Turns an uploaded file into text somebody can check before anything is
/// saved. Nothing is stored: the file is read, the words come back, and the
/// bytes are forgotten.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Expected a file" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "That file is over 2 MB. Paste the part you want instead." },
      { status: 413 },
    );
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const { text, note } = await extractText(file.name, bytes);

    if (!text.trim()) {
      return NextResponse.json(
        { error: note ?? "Nothing readable in that file." },
        { status: 422 },
      );
    }
    return NextResponse.json({ text, note });
  } catch {
    return NextResponse.json(
      { error: "That file could not be read. Try saving it as .csv, or paste the text." },
      { status: 422 },
    );
  }
}
