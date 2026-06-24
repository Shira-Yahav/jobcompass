import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/upload-resume
 * Body: FormData with field "resume" (PDF file) and optional "additionalContext" (string)
 *
 * Parses the PDF server-side using pdf-parse, then saves:
 * - resume_text (extracted plain text)
 * - resume_filename
 * - additional_context (free-text supplement)
 * to the user's profiles row.
 *
 * Returns: { success: true, filename: string }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("resume") as File | null;
  const additionalContext = (formData.get("additionalContext") as string) ?? "";

  if (!file) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return Response.json({ error: "Only PDF files are accepted" }, { status: 400 });
  }

  // Convert the File to a Buffer for pdf-parse
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // pdf-parse v1 API: pdfParse(buffer) → Promise<{ text, numpages, info }>
  // No worker required — works cleanly in Next.js API routes.
  let resumeText: string;
  try {
    // Import the internal lib path to bypass pdf-parse's test file loading,
    // which causes ENOENT in Next.js (it looks for ./test/data/05-versions-space.pdf)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
    const result = await pdfParse(buffer);
    resumeText = result.text ?? "";
  } catch (parseErr) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    console.error("pdf-parse error:", msg);
    return Response.json({ error: `PDF parse failed: ${msg}` }, { status: 422 });
  }

  // Store PDF in Supabase Storage so it can be viewed as a real PDF later
  const storagePath = `${user.id}/base-resume.pdf`;
  let resumeStoragePath: string | null = null;
  try {
    const { error: storageError } = await supabase.storage
      .from("application-resumes")
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (!storageError) resumeStoragePath = storagePath;
  } catch {
    // Non-fatal — text is still saved
  }

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    resume_text: resumeText,
    resume_filename: file.name,
    resume_storage_path: resumeStoragePath,
    additional_context: additionalContext,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, filename: file.name });
}
