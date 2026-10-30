export const TOKEN_KEY = 'fernly_token';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly rule?: string,
  ) {
    super(message);
  }
}

/** Calls the Fernly API through the dev-server proxy, with the saved session if there is one. */
export async function apiFetch<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!response.ok) {
    const body = (data ?? {}) as { detail?: string; rule?: string };
    throw new ApiRequestError(response.status, body.detail ?? `Request failed (${response.status}).`, body.rule);
  }
  return data as T;
}
