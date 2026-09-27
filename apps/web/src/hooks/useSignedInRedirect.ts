import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

/**
 * On the login page: if the session is already valid (and allowed), go
 * straight to `to` instead of showing the sign-in buttons. Returns true
 * while that is still being checked, so the page can render nothing.
 */
export function useSignedInRedirect(to: string): boolean {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((r) => {
        if (cancelled) return;
        if (r.ok) navigate(to, { replace: true });
        else setChecking(false);
      })
      .catch(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [navigate, to]);

  return checking;
}
