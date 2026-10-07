import { useCallback, useEffect, useState } from 'react';
import { HiClock } from 'react-icons/hi';
import { EventList } from '../../components/shared/activity';
import AutoRefresh from '../../components/shared/AutoRefresh';
import { Alert, EmptyState, PageHeader, Spinner, cardClass, secondaryButtonClass } from '../../components/shared/ui';
import { listEvents } from '../../services/events';

const PAGE_SIZE = 50;
const FILTERS = [
  { key: '', label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'warning', label: 'Warnings' },
  { key: 'success', label: 'Resolved' },
  { key: 'info', label: 'Info' },
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
    <section className="space-y-5 max-w-4xl">
      <PageHeader
        eyebrow="Monitor"
        title="Activity"
        description="Every change AbuseBox detected: new listings, removals, outages and certificate or domain expiry warnings."
        actions={<AutoRefresh onRefresh={load} loading={loading} />}
      />

      <div role="group" aria-label="Filter by severity" className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 w-fit">
        {FILTERS.map((filter) => (
          <button
            key={filter.key || 'all'}
            type="button"
            aria-pressed={severity === filter.key}
            onClick={() => setSeverity(filter.key)}
            className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${severity === filter.key ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className={`${cardClass} p-5`}>
        {loading ? (
          <div className="flex justify-center py-10" aria-busy="true"><Spinner className="h-6 w-6 text-cyan-600" /></div>
        ) : events.length === 0 ? (
          <EmptyState icon={HiClock} title={severity ? 'Nothing matches this filter' : 'No activity yet'}>
            Events are recorded when a check finds a change, such as a new listing, a removal, an outage or an expiring certificate.
          </EmptyState>
        ) : (
          <>
            <EventList events={events} />
            {hasMore && (
              <div className="mt-5 text-center">
                <button type="button" onClick={loadMore} disabled={loadingMore} className={secondaryButtonClass}>
                  {loadingMore && <Spinner />} Load older activity
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
