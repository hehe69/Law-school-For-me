"use client";

// Small fetch helpers for the browser side. Every call throws on a non-2xx answer with the server's message.

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `${init.method ?? "GET"} ${url} failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // keep the default message
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(url: string) => call<T>(url, { method: "GET" }),
  post: <T>(url: string, body: unknown) => call<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) => call<T>(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  delete: <T>(url: string) => call<T>(url, { method: "DELETE" }),
  upload: <T>(url: string, form: FormData) => call<T>(url, { method: "POST", body: form }),
};
