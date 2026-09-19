const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message = (data && (data.detail || data.message)) || `Error ${res.status}`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return data;
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: any) => request(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: (path: string, body?: any) => request(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  patch: (path: string, body?: any) => request(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  del: (path: string) => request(path, { method: "DELETE" }),
};
