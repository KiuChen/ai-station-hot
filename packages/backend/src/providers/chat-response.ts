// Compatible endpoints can report an API failure inside an HTTP 200 response (MiniMax base_resp).
// Keep quota failures distinct from temporary rate limits and malformed model output.
import { ProviderRejectedError } from "./receipts.ts";

export function parseChatResponse(text: string, status: number): Record<string, unknown> {
  let json: Record<string, unknown>;
  try { json = JSON.parse(text); }
  catch { json = { unparsable: text.slice(0, 20000) }; }
  const base = json?.base_resp as { status_code?: number; status_msg?: string } | undefined;
  if (base && Number(base.status_code) > 0) {
    const code = Number(base.status_code);
    throw new ProviderRejectedError(`provider code ${code}: ${String(base.status_msg ?? "request rejected").slice(0, 300)}`, code, [1000, 1001, 1002, 1024, 1033, 2056].includes(code));
  }
  if (status < 200 || status >= 300) {
    throw new ProviderRejectedError(`HTTP ${status}: ${text.slice(0, 500)}`, status, status === 429 || status >= 500);
  }
  return json;
}
