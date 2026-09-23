/** Version, commit and deploy time injected at build time (vite.config.ts). */
export function BuildInfo() {
  const commit = __APP_COMMIT__.slice(0, 7);
  const builtAt = new Date(__APP_BUILD_TIME__).toLocaleString("zh-CN", {
    hour12: false,
  });
  return (
    <p className="text-center text-xs text-muted-foreground tabular-nums">
      v{__APP_VERSION__}
      {commit && (
        <>
          {" · "}
          {__APP_REPO_URL__ ? (
            <a
              href={`${__APP_REPO_URL__}/commit/${__APP_COMMIT__}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono underline-offset-4 hover:text-foreground hover:underline"
            >
              {commit}
            </a>
          ) : (
            <span className="font-mono">{commit}</span>
          )}
        </>
      )}
      {" · "}
      <time dateTime={__APP_BUILD_TIME__}>部署于 {builtAt}</time>
    </p>
  );
}
