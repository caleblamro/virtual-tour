export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: Response,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiRequestBody =
  | string
  | FormData
  | Blob
  | ArrayBuffer
  | URLSearchParams
  | Record<string, unknown>
  | unknown[];

export interface ApiRequestConfig
  extends Omit<RequestInit, "body" | "headers"> {
  baseUrl?: string;
  params?: Record<string, string | number | boolean>;
  body?: ApiRequestBody;
  headers?: Record<string, string> | Headers;
}

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

const DEFAULT_HEADERS = new Headers({ "Content-Type": "application/json" });

function buildUrl(
  base: string,
  endpoint: string,
  params?: Record<string, string | number | boolean>,
): string {
  const url = new URL(
    endpoint.startsWith("/") ? endpoint.slice(1) : endpoint,
    base.endsWith("/") ? base : `${base}/`,
  );
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    }
  }
  return url.toString();
}

function normalizeHeaders(
  extra: Record<string, string> | Headers | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};
  DEFAULT_HEADERS.forEach((v, k) => {
    result[k] = v;
  });
  if (extra instanceof Headers) {
    extra.forEach((v, k) => {
      result[k] = v;
    });
  } else if (extra) {
    Object.assign(result, extra);
  }
  return result;
}

function processBody(
  body: ApiRequestBody | undefined,
  method: string,
): BodyInit | null {
  if (!body || method === "GET") return null;
  if (
    typeof body === "string" ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    body instanceof URLSearchParams
  ) {
    return body;
  }
  return JSON.stringify(body);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (
    response.status === 204 ||
    response.headers.get("content-length") === "0"
  ) {
    return {} as T;
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError("Failed to parse response", response.status, response);
  }

  if (!response.ok) {
    const message =
      (data as { error?: string; message?: string }).error ??
      (data as { error?: string; message?: string }).message ??
      `HTTP ${response.status}`;
    throw new ApiError(message, response.status, response);
  }

  // Unwrap { data: T } envelope when present
  if (
    data !== null &&
    typeof data === "object" &&
    "data" in (data as object)
  ) {
    return (data as { data: T }).data;
  }
  return data as T;
}

/** Core fetch wrapper — unwraps the API envelope. No auth headers (MVP). */
export async function fetchApi<T = unknown>(
  endpoint: string,
  config: ApiRequestConfig = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    headers,
    baseUrl = BASE_URL,
    params,
    ...rest
  } = config;

  const requestHeaders = normalizeHeaders(headers);

  const response = await fetch(buildUrl(baseUrl, endpoint, params), {
    ...rest,
    method,
    headers: requestHeaders,
    body: processBody(body, method),
  });

  return parseResponse<T>(response);
}

/** Convenience wrappers that mirror the starter `api.*` interface. */
export const api = {
  get: <T = unknown>(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
    headers?: Record<string, string> | Headers,
  ) => fetchApi<T>(endpoint, { method: "GET", params, headers }),

  post: <T = unknown>(
    endpoint: string,
    body?: ApiRequestBody,
    headers?: Record<string, string> | Headers,
  ) => fetchApi<T>(endpoint, { method: "POST", body, headers }),

  put: <T = unknown>(
    endpoint: string,
    body?: ApiRequestBody,
    headers?: Record<string, string> | Headers,
  ) => fetchApi<T>(endpoint, { method: "PUT", body, headers }),

  patch: <T = unknown>(
    endpoint: string,
    body?: ApiRequestBody,
    headers?: Record<string, string> | Headers,
  ) => fetchApi<T>(endpoint, { method: "PATCH", body, headers }),

  delete: <T = unknown>(
    endpoint: string,
    headers?: Record<string, string> | Headers,
  ) => fetchApi<T>(endpoint, { method: "DELETE", headers }),
} as const;
