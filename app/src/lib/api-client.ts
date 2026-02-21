import { createClient } from "./supabase/client";

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

export class ApiClientError extends Error {
  status: number;
  code?: string;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiClientError";
    this.status = error.status;
    this.code = error.code;
  }
}

async function apiClient<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (session?.access_token)
    headers.set("Authorization", `Bearer ${session.access_token}`);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = "An error occurred";
    let errorCode: string | undefined;

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
      errorCode = errorData.code;
    } catch {
      // Fallback to status text if response isn't JSON
      errorMessage = response.statusText || errorMessage;
    }

    throw new ApiClientError({
      message: errorMessage,
      status: response.status,
      code: errorCode,
    });
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

/**
 * Authenticated API client that automatically attaches the current Supabase
 * session token to requests.
 *
 * Sets `Content-Type: application/json` by default. Returns an empty object
 * for 204 No Content responses. Throws `ApiClientError` on non-OK responses,
 * extracting the error message from the JSON body when possible.
 */
export const api = {
  get: <T>(url: string, options?: RequestInit) =>
    apiClient<T>(url, { ...options, method: "GET" }),

  post: <T>(url: string, data?: unknown, options?: RequestInit) =>
    apiClient<T>(url, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(url: string, data?: unknown, options?: RequestInit) =>
    apiClient<T>(url, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(url: string, data?: unknown, options?: RequestInit) =>
    apiClient<T>(url, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(url: string, options?: RequestInit) =>
    apiClient<T>(url, { ...options, method: "DELETE" }),
};
