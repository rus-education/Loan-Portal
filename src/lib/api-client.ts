/**
 * Standardized API client for all frontend HTTP requests.
 * Handles credentials, headers, 401 session expiration, 403 authorization errors,
 * 429 rate limiting, and 500 error reporting consistently.
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: unknown;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Global auth expiration listener
type AuthExpiredListener = () => void;
const authExpiredListeners = new Set<AuthExpiredListener>();

export function onAuthExpired(listener: AuthExpiredListener): () => void {
  authExpiredListeners.add(listener);
  return () => authExpiredListeners.delete(listener);
}

function notifyAuthExpired() {
  authExpiredListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Ignored
    }
  });
}

export async function apiFetch(
  input: string | URL,
  init?: RequestInit
): Promise<Response> {
  const options: RequestInit = {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  };

  try {
    const res = await fetch(input, options);

    // Handle 401 Unauthorized (Expired or missing session)
    if (res.status === 401) {
      notifyAuthExpired();
    }

    return res;
  } catch (err: unknown) {
    throw err;
  }
}

export async function apiFetchJson<T = unknown>(
  input: string | URL,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  const res = await apiFetch(input, init);
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMessage =
      json.error ||
      json.message ||
      (res.status === 403
        ? "Access denied: insufficient permissions"
        : res.status === 429
        ? "Rate limit exceeded. Please wait a moment."
        : `Server returned status ${res.status}`);

    throw new ApiError(errorMessage, res.status, json.code, json.details);
  }

  return json as ApiResponse<T>;
}
