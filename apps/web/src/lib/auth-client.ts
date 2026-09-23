import { createAuthClient } from "better-auth/react";

// Same origin as the API: /api/auth/* is served by the Worker (proxied by Vite in dev).
export const authClient = createAuthClient({ baseURL: window.location.origin });
