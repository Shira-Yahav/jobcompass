import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: app } = await supabase
    .from("job_applications")
    .select("resume_storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!app?.resume_storage_path) {
    return Response.json({ error: "No PDF stored" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("application-resumes")
    .createSignedUrl(app.resume_storage_path, 3600); // 1 hour

  if (error || !data?.signedUrl) {
    return Response.json({ error: "Could not generate URL" }, { status: 500 });
  }

  return Response.json({ url: data.signedUrl });
}
