import Anthropic from "@anthropic-ai/sdk";
import { tavily } from "@tavily/core";
import { parseJsonResponse } from "@/lib/parseJson";

const anthropic = new Anthropic();

/**
 * POST /api/extract-job
 * Body: { url: string }
 *
 * Strategy:
 * 1. Fetch page content via Tavily extract (handles most job boards)
 * 2. Pass to Claude to extract companyName, jobTitle, jobDescription
 * 3. If jobDescription is empty (LinkedIn hides it behind JS), run a second
 *    Tavily search using the company + title to find the full JD from other sources
 * 4. Re-extract with the supplemental content
 *
 * Returns: { companyName: string; jobTitle: string; jobDescription: string }
 */
export async function POST(request: Request) {
  const { url } = (await request.json()) as { url: string };

  if (!url?.trim()) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  const tv = tavily({ apiKey: process.env.TAVILY_API_KEY! });

  // ── 1. Fetch page content ────────────────────────────────────────────────
  let pageContent = "";

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extracted = await (tv as any).extract([url]);
    if (extracted?.results?.[0]?.rawContent) {
      pageContent = extracted.results[0].rawContent;
    }
  } catch { /* fall through */ }

  if (!pageContent) {
    try {
      const result = await tv.search(url, {
        maxResults: 3,
        searchDepth: "basic",
        // @ts-expect-error — includeRawContent valid but not in older type defs
        includeRawContent: true,
      });
      const match = result.results.find((r) => r.url === url || r.url.includes(new URL(url).hostname));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pageContent = (match as any)?.rawContent ?? result.results.map((r) => r.content).join("\n\n");
    } catch { /* fall through */ }
  }

  if (!pageContent) {
    return Response.json(
      { error: "Could not fetch content from that URL. Paste the job description manually." },
      { status: 422 }
    );
  }

  // ── 2. First Claude pass — extract what's available ─────────────────────
  const firstResult = await extractWithClaude(pageContent.slice(0, 12000));

  // ── 3. If description is empty (e.g. LinkedIn JS rendering), search for it ──
  if (!firstResult.jobDescription && firstResult.companyName && firstResult.jobTitle) {
    let supplemental = "";
    try {
      const searchQuery = `"${firstResult.companyName}" "${firstResult.jobTitle}" job description responsibilities requirements`;
      const searchResult = await tv.search(searchQuery, {
        maxResults: 4,
        searchDepth: "basic",
        // @ts-expect-error — includeRawContent valid but not in older type defs
        includeRawContent: true,
      });
      supplemental = searchResult.results
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r) => (r as any).rawContent ?? r.content)
        .join("\n\n---\n\n")
        .slice(0, 12000);
    } catch { /* fall through */ }

    if (supplemental) {
      // Second pass with supplemental content but keep company/title from first pass
      const secondResult = await extractWithClaude(supplemental);
      return Response.json({
        companyName: firstResult.companyName || secondResult.companyName,
        jobTitle: firstResult.jobTitle || secondResult.jobTitle,
        jobDescription: secondResult.jobDescription || "",
      });
    }
  }

  return Response.json(firstResult);
}

async function extractWithClaude(content: string) {
  const prompt = `You are extracting structured data from a job posting page.

PAGE CONTENT:
${content}

Extract the following from the job posting. Return ONLY valid JSON with no markdown fences:
{
  "companyName": "string — the hiring company's name",
  "jobTitle": "string — the exact job title",
  "jobDescription": "string — the full job description text, including responsibilities, requirements, and any other relevant sections. Preserve line breaks with \\n. Include everything relevant but exclude navigation, headers, footers, and unrelated page content."
}

If you cannot determine a field with confidence, use an empty string "".`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    return parseJsonResponse<{ companyName: string; jobTitle: string; jobDescription: string }>(text);
  } catch {
    return { companyName: "", jobTitle: "", jobDescription: "" };
  }
}
