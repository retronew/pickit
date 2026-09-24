// Minimal in-memory R2Bucket for tests: put / get / list / delete.

interface Stored {
  body: string;
  uploaded: Date;
  customMetadata: Record<string, string>;
}

export function createMemoryR2() {
  const objects = new Map<string, Stored>();

  const meta = (key: string, o: Stored) => ({
    key,
    size: new TextEncoder().encode(o.body).length,
    uploaded: o.uploaded,
    customMetadata: o.customMetadata,
  });

  const bucket = {
    async put(key: string, value: string | Uint8Array, opts?: { customMetadata?: Record<string, string> }) {
      const body = typeof value === "string" ? value : new TextDecoder().decode(value);
      const o = { body, uploaded: new Date(), customMetadata: opts?.customMetadata ?? {} };
      objects.set(key, o);
      return meta(key, o);
    },
    async get(key: string) {
      const o = objects.get(key);
      if (!o) return null;
      return {
        ...meta(key, o),
        body: new Response(o.body).body,
        text: async () => o.body,
        json: async () => JSON.parse(o.body),
      };
    },
    async list({ prefix = "" }: { prefix?: string } = {}) {
      const list = [...objects].filter(([k]) => k.startsWith(prefix)).map(([k, o]) => meta(k, o));
      return { objects: list, truncated: false };
    },
    async delete(keys: string | string[]) {
      for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
    },
  };

  return {
    bucket: bucket as unknown as R2Bucket,
    objects,
    /** Backdates an object, e.g. to test retention. */
    age(key: string, ms: number) {
      const o = objects.get(key);
      if (o) o.uploaded = new Date(o.uploaded.getTime() - ms);
    },
  };
}
