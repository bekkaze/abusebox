import { useCallback, useEffect, useState } from 'react';
import { HiOutlineClock } from 'react-icons/hi2';
import { EventList } from '../../components/shared/activity';
import AutoRefresh from '../../components/shared/AutoRefresh';
import { SkeletonLine } from '../../components/shared/Skeleton';
import { Alert, EmptyState, PageHeader, Spinner, secondaryButtonClass } from '../../components/shared/ui';
import { listEvents } from '../../services/events';

const PAGE_SIZE = 50;
// Each filter carries the reply class its events are drawn with.
const FILTERS = [
  { key: '', label: 'All' },
  { key: 'critical', label: 'Critical', code: '5.x', tone: 'text-s5' },
  { key: 'warning', label: 'Warnings', code: '4.x', tone: 'text-s4' },
  { key: 'success', label: 'Resolved', code: '2.x', tone: 'text-s2' },
  { key: 'info', label: 'Info', code: '3.x', tone: 'text-info' },
];

export default function Activity() {
  const [severity, setSeverity] = useState('');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const page = await listEvents({ limit: PAGE_SIZE, severity: severity || undefined });
      setEvents(page);
      setHasMore(page.length === PAGE_SIZE);
    } catch {
      setError('Could not load activity. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [severity]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await listEvents({ limit: PAGE_SIZE, severity: severity || undefined, beforeId: events[events.length - 1]?.id });
      setEvents((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch {
      setError('Could not load older activity.');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section>
      <PageHeader
        title="Activity"
        description="Every change AbuseBox detected: new listings, removals, outages and certificate or domain expiry warnings."
        actions={<AutoRefresh onRefresh={load} loading={loading} />}
      />

      <div className="mt-4 max-w-4xl">
        <div role="group" aria-label="Filter by severity" className="flex flex-wrap gap-1">
          {FILTERS.map((filter) => {
            const selected = severity === filter.key;
            return (
              <button
                key={filter.key || 'all'}
                type="button"
                aria-pressed={selected}
                onClick={() => setSeverity(filter.key)}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm transition-colors ${
                  selected
                    ? 'bg-accent-soft text-accent font-semibold ring-1 ring-inset ring-accent/30'
                    : 'text-ink-2 font-medium hover:text-ink hover:bg-sunk'
                }`}
              >
                {filter.code && (
                  <span className={`font-mono text-2xs font-semibold ${selected ? '' : filter.tone}`} aria-hidden="true">{filter.code}</span>
                )}
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && <Alert tone="error" className="mt-4">{error}</Alert>}

      <div className="mt-5 pt-5 border-t border-rule">
        {loading ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading activity">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <SkeletonLine className="h-3 w-48" />
                <SkeletonLine className="h-4 w-80 max-w-full" />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={HiOutlineClock}
            title={severity ? 'Nothing matches this filter' : 'No activity yet'}
            action={severity && (
              <button type="button" onClick={() => setSeverity('')} className={secondaryButtonClass}>Show all activity</button>
            )}
          >
            Events are recorded when a check finds a change, such as a new listing, a removal, an outage or an expiring certificate.
          </EmptyState>
        ) : (
          <>
            <EventList events={events} />
            <div className="mt-6 pt-4 border-t border-rule flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-ink-2">
                {hasMore ? `Showing the latest ${events.length}.` : `That is everything: ${events.length} event${events.length === 1 ? '' : 's'}.`}
              </p>
              {hasMore && (
                <button type="button" onClick={loadMore} disabled={loadingMore} className={secondaryButtonClass}>
                  {loadingMore && <Spinner />} Load older activity
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
