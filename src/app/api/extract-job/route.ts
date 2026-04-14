import Anthropic from "@anthropic-ai/sdk";
import { tavily } from "@tavily/core";

const anthropic = new Anthropic();

/**
 * POST /api/extract-job
 * Body: { url: string }
 *
 * Fetches the job posting at the given URL using Tavily, then uses Claude
 * to extract structured data: companyName, jobTitle, jobDescription.
 *
 * Returns: { companyName: string; jobTitle: string; jobDescription: string }
 */
export async function POST(request: Request) {
  const { url } = (await request.json()) as { url: string };

  if (!url?.trim()) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  // ── 1. Fetch page content via Tavily ─────────────────────────────────────
  let pageContent = "";
  try {
    const tv = tavily({ apiKey: process.env.TAVILY_API_KEY! });

    // Try Tavily's extract method first (purpose-built for URL content)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extracted = await (tv as any).extract([url]);
    if (extracted?.results?.[0]?.rawContent) {
      pageContent = extracted.results[0].rawContent;
    }
  } catch {
    // fall through to search fallback
  }

  // Fallback: use Tavily search with the URL as query
  if (!pageContent) {
    try {
      const tv = tavily({ apiKey: process.env.TAVILY_API_KEY! });
      const result = await tv.search(url, {
        maxResults: 3,
        searchDepth: "basic",
        // @ts-expect-error — includeRawContent is valid but not in older type defs
        includeRawContent: true,
      });
      const match = result.results.find((r) => r.url === url || r.url.includes(new URL(url).hostname));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pageContent = (match as any)?.rawContent ?? result.results.map((r) => r.content).join("\n\n");
    } catch {
      pageContent = "";
    }
  }

  if (!pageContent) {
    return Response.json({ error: "Could not fetch content from that URL. Paste the job description manually." }, { status: 422 });
  }

  // Truncate to ~12,000 chars to stay within token limits
  const truncated = pageContent.slice(0, 12000);

  // ── 2. Claude extraction ──────────────────────────────────────────────────
  const prompt = `You are extracting structured data from a job posting page.

PAGE CONTENT:
${truncated}

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
    const { parseJsonResponse } = await import("@/lib/parseJson");
    const result = parseJsonResponse<{ companyName: string; jobTitle: string; jobDescription: string }>(text);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to parse extracted job data", raw: text }, { status: 500 });
  }
}
