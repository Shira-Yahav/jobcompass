/**
 * Strips markdown code fences that Claude sometimes wraps around JSON responses,
 * then parses and returns the result.
 * Handles: ```json\n...\n``` and ``` ... ```
 */
export function parseJsonResponse<T>(text: string): T {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  return JSON.parse(stripped) as T;
}
