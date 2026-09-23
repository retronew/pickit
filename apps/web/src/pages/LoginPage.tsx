import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "#components/ui/card";
import { Field, FieldLabel } from "#components/ui/field";
import { Input } from "#components/ui/input";
import { Button } from "#components/ui/button";

export function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      navigate("/");
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(
        data.error && data.error !== "wrong password"
          ? data.error
          : "密码不对，再试一次",
      );
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">PickIt</CardTitle>
          <CardDescription>输入密码，进入你的收藏库</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="password" className="sr-only">
                密码
              </FieldLabel>
              <Input
                id="password"
                size="lg"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                autoFocus
              />
            </Field>
            {error && <p className="text-destructive-foreground text-sm">{error}</p>}
            <Button
              type="submit"
              size="lg"
              disabled={loading || !password}
              className="w-full"
            >
              {loading ? "登录中…" : "登录"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
