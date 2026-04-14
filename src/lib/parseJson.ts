/**
 * Robustly extracts and parses JSON from Claude's response text.
 *
 * Handles:
 * - Bare JSON
 * - JSON wrapped in ```json ... ``` or ``` ... ```
 * - JSON buried after/before prose (finds the outermost { } or [ ])
 */
export function parseJsonResponse<T>(text: string): T {
  const trimmed = text.trim();

  // 1. Strip markdown code fences
  const fenceStripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  // 2. Try parsing directly
  try {
    return JSON.parse(fenceStripped) as T;
  } catch {
    // fall through
  }

  // 3. Find the outermost JSON object or array in the text
  const objStart = fenceStripped.indexOf("{");
  const arrStart = fenceStripped.indexOf("[");

  let start = -1;
  let closingChar = "";

  if (objStart === -1 && arrStart === -1) {
    throw new Error("No JSON found in response");
  } else if (objStart === -1) {
    start = arrStart;
    closingChar = "]";
  } else if (arrStart === -1) {
    start = objStart;
    closingChar = "}";
  } else {
    start = Math.min(objStart, arrStart);
    closingChar = start === objStart ? "}" : "]";
  }

  const end = fenceStripped.lastIndexOf(closingChar);
  if (end === -1 || end <= start) {
    throw new Error("Malformed JSON in response");
  }

  const jsonSlice = fenceStripped.slice(start, end + 1);
  return JSON.parse(jsonSlice) as T;
}
