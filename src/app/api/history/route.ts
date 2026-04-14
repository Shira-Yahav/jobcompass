import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/history
 * Returns all job search history entries for the authenticated user, newest first.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("job_searches")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

/**
 * POST /api/history
 * Upserts a history entry for the current session.
 * Body: { id, companyName, jobTitle?, jobDescription?, companyResearch?, positionResearch?, tailoredResume? }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const { error } = await supabase.from("job_searches").upsert({
    id: body.id,
    user_id: user.id,
    company_name: body.companyName ?? "",
    job_title: body.jobTitle ?? null,
    job_description: body.jobDescription ?? null,
    company_research: body.companyResearch ?? null,
    position_research: body.positionResearch ?? null,
    tailored_resume: body.tailoredResume ?? null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
