import { supabase } from "./supabaseClient";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8787";

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function errorMessage(body: any, status: number): string {
  const err = body?.error;
  if (typeof err === "string") return err;
  if (err?.message) return String(err.message);
  // zod's safeParse().error.flatten() shape: { formErrors: string[], fieldErrors: Record<string, string[]> }
  if (err?.fieldErrors || err?.formErrors) {
    const fieldMessages = Object.values(err.fieldErrors ?? {}).flat();
    const messages = [...(err.formErrors ?? []), ...fieldMessages];
    if (messages.length) return messages.join(", ");
  }
  return `Request failed (${status})`;
}

async function handle(res: Response) {
  if (res.status === 204) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(body, res.status));
  return body;
}

export async function apiGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: await authHeaders() });
  return handle(res);
}

export async function apiSend(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handle(res);
}

export async function apiUpload(path: string, formData: FormData) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: await authHeaders(),
    body: formData,
  });
  return handle(res);
}
