import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const formData = await request.formData();
  const file = formData.get("resume") as File | null;
  if (!file) return Response.json({ error: "No file uploaded" }, { status: 400 });
  if (file.type !== "application/pdf") return Response.json({ error: "Only PDF files accepted" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let resumeText: string;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
    const result = await pdfParse(buffer);
    resumeText = result.text ?? "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `PDF parse failed: ${msg}` }, { status: 422 });
  }

  const { error } = await supabase
    .from("job_applications")
    .update({
      resume_submitted_filename: file.name,
      resume_submitted_text: resumeText,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true, filename: file.name });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { error } = await supabase
    .from("job_applications")
    .update({
      resume_submitted_filename: null,
      resume_submitted_text: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
