import { toastManager } from "#components/ui/toast";
import { m } from "#lib/i18n";

/** A failed API call; `message` is ready to show to the user. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/**
 * fetch + JSON with errors thrown as ApiError, so callers can't forget to
 * check `res.ok` (a failed save used to look exactly like a successful one).
 */
export async function api<T = unknown>(
  url: string,
  init: { method?: string; json?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? (init.json === undefined ? "GET" : "POST"),
      headers: init.json === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.json === undefined ? undefined : JSON.stringify(init.json),
    });
  } catch {
    throw new ApiError(m.error_network(), 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data?.error === "string" ? data.error : m.error_status({ status: res.status });
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return m.error_generic();
}

interface ToastOptions {
  description?: string;
  /** Repeated toasts with the same id update in place instead of stacking. */
  id?: string;
  action?: { label: string; onClick: () => void };
}

export function toastSuccess(title: string, { description, id, action }: ToastOptions = {}) {
  toastManager.add({
    title,
    description,
    id,
    type: "success",
    actionProps: action ? { children: action.label, onClick: action.onClick } : undefined,
  });
}

/** A spinner toast for work in progress; update it by reusing the id. */
export function toastLoading(title: string, { id }: Pick<ToastOptions, "id"> = {}) {
  toastManager.add({ title, id, type: "loading", timeout: 0 });
}

export function toastError(title: string, err?: unknown, { id }: Pick<ToastOptions, "id"> = {}) {
  toastManager.add({
    title,
    description: err === undefined ? undefined : errorMessage(err),
    id,
    type: "error",
  });
}

/** Copies text and reports the result with a toast. */
export async function copyText(text: string, title: string = m.copy_done()) {
  try {
    await navigator.clipboard.writeText(text);
    toastSuccess(title, { id: "copy" });
    return true;
  } catch {
    toastError(m.copy_failed(), new Error(m.copy_no_permission()), { id: "copy" });
    return false;
  }
}
