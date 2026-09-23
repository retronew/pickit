import { useEffect, useState } from "react";
import { useAuditLog, EMPTY_FILTERS, type AuditFilters } from "#hooks/useAuditLog";
import { AuditFiltersBar, type Facet } from "#components/audit/AuditFiltersBar";
import { AuditEntryRow } from "#components/audit/AuditEntryRow";
import { AuditToolbar } from "#components/audit/AuditToolbar";
import { AuditRetention } from "#components/audit/AuditRetention";
import { Confirm } from "#components/Confirm";
import { PageLoading } from "#components/PageLoading";
import { Button } from "#components/ui/button";
import { Spinner } from "#components/ui/spinner";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "#components/ui/empty";
import { api } from "#lib/api";
import { m } from "#lib/i18n";

const LIVE_KEY = "pickit-audit-live";

function readLive(): boolean {
  try {
    return localStorage.getItem(LIVE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function AuditPage() {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_FILTERS);
  const [live, setLive] = useState(readLive);
  const [facets, setFacets] = useState<{ actions: Facet[]; actors: Facet[] }>({
    actions: [],
    actors: [],
  });
  const log = useAuditLog(filters, live);

  function changeLive(next: boolean) {
    setLive(next);
    try {
      localStorage.setItem(LIVE_KEY, next ? "1" : "0");
    } catch {
      // Not remembered; still applies now.
    }
  }

  // Facet counts follow the list: reloaded whenever it refreshes.
  useEffect(() => {
    api<{ actions: Facet[]; actors: Facet[] }>("/api/audit/facets")
      .then(setFacets)
      .catch(() => {});
  }, [log.loadedAt]);

  const filtered = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-heading font-semibold text-lg">{m.audit_title()}</h1>
          <p className="text-muted-foreground text-xs">
            {m.audit_description()}
          </p>
        </div>
        <AuditToolbar
          live={live}
          onLiveChange={changeLive}
          onRefresh={log.reload}
          refreshing={log.loading}
          updatedAt={log.updatedAt}
        />
      </div>

      <AuditRetention reloadKey={log.loadedAt} />

      <AuditFiltersBar
        filters={filters}
        onChange={setFilters}
        actions={facets.actions}
        actors={facets.actors}
      />

      {log.error && <p className="text-destructive text-sm">{m.load_failed({ error: log.error })}</p>}

      {log.loading && log.entries.length === 0 ? (
        <PageLoading />
      ) : log.entries.length === 0 ? (
        <Empty className="animate-fade-in">
          <EmptyHeader>
            <EmptyTitle>{filtered ? m.audit_empty_filtered() : m.audit_empty()}</EmptyTitle>
            <EmptyDescription>
              {filtered ? m.audit_empty_filtered_hint() : m.audit_empty_hint()}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <ul className="overflow-hidden rounded-xl border">
            {log.entries.map((e) => (
              <AuditEntryRow key={e.id} entry={e} fresh={log.freshIds.has(e.id)} />
            ))}
          </ul>
          {log.hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={log.loadMore} disabled={log.loadingMore}>
                {log.loadingMore && <Spinner />}
                {m.load_more()}
              </Button>
            </div>
          )}
        </>
      )}
      <Confirm />
    </div>
  );
}
