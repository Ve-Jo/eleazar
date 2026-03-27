import type { JsonResult } from "../types/activityServer.ts";

export async function parseJsonResponse(response: Response): Promise<JsonResult> {
  const text = await response.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}
