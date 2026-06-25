import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Try the standard path directly first — don't rely on DB column being set
  const storagePath = `${user.id}/base-resume.pdf`;

  // Verify the file exists in storage before generating a URL
  const { data: files } = await supabase.storage
    .from("application-resumes")
    .list(user.id, { search: "base-resume.pdf", limit: 1 });

  const fileExists = files && files.length > 0 && files.some(f => f.name === "base-resume.pdf");

  if (!fileExists) {
    // Also check DB column as fallback (for non-standard paths)
    const { data: profile } = await supabase
      .from("profiles")
      .select("resume_storage_path")
      .eq("id", user.id)
      .single();

    if (!profile?.resume_storage_path) {
      return Response.json({ error: "No PDF stored" }, { status: 404 });
    }

    const { data: alt, error: altErr } = await supabase.storage
      .from("application-resumes")
      .createSignedUrl(profile.resume_storage_path, 3600);

    if (altErr || !alt?.signedUrl) return Response.json({ error: "Could not generate URL" }, { status: 500 });
    return Response.json({ url: alt.signedUrl });
  }

  // File confirmed in storage — generate signed URL
  const { data, error } = await supabase.storage
    .from("application-resumes")
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    return Response.json({ error: "Could not generate URL" }, { status: 500 });
  }

  // Keep DB column in sync
  await supabase.from("profiles").update({ resume_storage_path: storagePath }).eq("id", user.id);

  return Response.json({ url: data.signedUrl });
}
