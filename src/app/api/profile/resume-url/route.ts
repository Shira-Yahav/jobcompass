import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("resume_storage_path")
    .eq("id", user.id)
    .single();

  if (!profile?.resume_storage_path) {
    return Response.json({ error: "No PDF stored" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("application-resumes")
    .createSignedUrl(profile.resume_storage_path, 3600);

  if (error || !data?.signedUrl) {
    return Response.json({ error: "Could not generate URL" }, { status: 500 });
  }

  return Response.json({ url: data.signedUrl });
}
