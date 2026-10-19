import { validateInstance } from "../config/schema.js";
import { findingsSchema, FINDINGS_SCHEMA_NAME, type FindingsDocument } from "./findings.js";

/**
 * xAI Responses API.
 * https://docs.x.ai/developers/rest-api-reference/inference/responses
 * https://docs.x.ai/developers/model-capabilities/text/structured-outputs
 *
 * POST https://api.x.ai/v1/responses
 * Structured output uses text.format type json_schema with strict true.
 * The key is sent only in the Authorization header and is never written to a log field.
 */

export const RESPONSES_ENDPOINT = "https://api.x.ai/v1/responses";
export const DEFAULT_TIMEOUT_MS = 120_000;

export class ResponsesApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResponsesApiError";
  }
}

export class MalformedOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MalformedOutputError";
  }
}

export function redactSecrets(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length >= 8) {
      out = out.split(secret).join("[redacted]");
    }
  }
  return out.replace(/Bearer\s+\S+/g, "Bearer [redacted]");
}

export function buildResponsesBody(input: { model: string; system: string; user: string; schema: object }): object {
  return {
    model: input.model,
    store: false,
    temperature: 0,
    max_output_tokens: 4096,
    input: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
    text: {
      format: {
        type: "json_schema",
        name: FINDINGS_SCHEMA_NAME,
        strict: true,
        schema: input.schema,
      },
    },
  };
}

export function extractOutputText(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) {
    throw new MalformedOutputError("responses payload was not an object");
  }
  const record = payload as Record<string, unknown>;
  if (record.error !== undefined && record.error !== null) {
    throw new ResponsesApiError("responses payload included an error");
  }
  if (record.status !== "completed") {
    throw new ResponsesApiError(`responses status was ${String(record.status)}`);
  }
  if (!Array.isArray(record.output)) {
    throw new MalformedOutputError("responses payload did not include output");
  }
  const parts: string[] = [];
  for (const item of record.output) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const outputItem = item as Record<string, unknown>;
    if (outputItem.type !== "message" || !Array.isArray(outputItem.content)) {
      continue;
    }
    for (const content of outputItem.content) {
      if (typeof content !== "object" || content === null) {
        continue;
      }
      const block = content as Record<string, unknown>;
      if (block.type === "output_text" && typeof block.text === "string") {
        parts.push(block.text);
      }
    }
  }
  if (parts.length === 0) {
    throw new MalformedOutputError("responses payload did not include output text");
  }
  return parts.join("");
}

export function parseFindings(text: string): FindingsDocument {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new MalformedOutputError("model output was not JSON");
  }
  const result = validateInstance(findingsSchema, value);
  if (!result.ok) {
    throw new MalformedOutputError(`model output did not match the findings schema: ${result.errors.join("; ")}`);
  }
  return value as FindingsDocument;
}

export async function requestReview(options: {
  model: string;
  apiKey: string;
  system: string;
  user: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<string> {
  const body = buildResponsesBody({
    model: options.model,
    system: options.system,
    user: options.user,
    schema: findingsSchema,
  });
  const bodyText = JSON.stringify(body);
  if (options.apiKey.length > 0 && bodyText.includes(options.apiKey)) {
    throw new ResponsesApiError("refusing to send a request body that contains the API key");
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(RESPONSES_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: bodyText,
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    throw new ResponsesApiError(redactSecrets(`responses request failed: ${message}`, [options.apiKey]));
  }
  const raw = await response.text();
  if (response.status < 200 || response.status >= 300) {
    const detail = redactSecrets(raw.slice(0, 200), [options.apiKey]);
    throw new ResponsesApiError(`responses request failed with HTTP ${response.status}: ${detail}`);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw) as unknown;
  } catch {
    throw new MalformedOutputError("responses payload was not JSON");
  }
  return extractOutputText(payload);
}

export type ReviewProvider = {
  complete(input: { model: string; system: string; user: string }): Promise<string>;
};

export function xaiProvider(apiKey: string, fetchImpl?: typeof fetch): ReviewProvider {
  return {
    async complete(input) {
      return requestReview({ ...input, apiKey, fetchImpl });
    },
  };
}
