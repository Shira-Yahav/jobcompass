import { createClient } from "@/lib/supabase/server";
import type { JobApplication } from "@/types";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("job_applications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Partial<JobApplication>;

  // Auto-fill resume + position from profile if not explicitly provided
  const { data: profile } = await supabase
    .from("profiles")
    .select("resume_filename, desired_position")
    .eq("id", user.id)
    .single();

  const { data, error } = await supabase
    .from("job_applications")
    .insert({
      user_id: user.id,
      company_name: body.company_name ?? "",
      position: body.position ?? profile?.desired_position ?? "",
      job_description: body.job_description ?? null,
      job_posting_url: body.job_posting_url ?? null,
      resume_submitted_filename: body.resume_submitted_filename ?? profile?.resume_filename ?? null,
      date_started: body.date_started ?? new Date().toISOString().split("T")[0],
      stage: body.stage ?? "applied",
      status: body.status ?? "active",
      notes: body.notes ?? null,
      research_session_id: body.research_session_id ?? null,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
