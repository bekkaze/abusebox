import { Fragment, useState, useEffect, useCallback } from 'react';
import { HiOutlineArrowUpTray, HiOutlineTrash, HiChevronDown, HiChevronRight, HiOutlineDocumentText } from 'react-icons/hi2';
import axios from 'axios';
import CopyButton from '../../components/shared/CopyButton';
import { SkeletonLine } from '../../components/shared/Skeleton';
import {
  Alert, EmptyState, Field, Fields, PageHeader, Section, Spinner,
  inputClass, primaryButtonClass, secondaryButtonClass,
} from '../../components/shared/ui';
import { toast } from 'react-toastify';

const plural = (count, word) => `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;
const day = (iso) => (iso ? iso.slice(0, 10) : '—');

function dateRange(begin, end) {
  if (!begin && !end) return '—';
  if (day(begin) === day(end)) return day(begin);
  return `${day(begin)} – ${day(end)}`;
}

// A message passes DMARC when either DKIM or SPF passes aligned.
const passes = (record) => record.dkim_aligned === 'pass' || record.spf_aligned === 'pass';

function rateTone(rate, warnAt = 50) {
  if (rate >= 90) return 'text-s2';
  if (rate >= warnAt) return 'text-s4';
  return 'text-s5';
}

const thClass = 'px-3 py-2 font-mono text-xs font-normal text-ink-2 border-b border-rule whitespace-nowrap';
const rowClass = 'border-b border-rule last:border-b-0 align-top hover:bg-sunk/60';

export default function DmarcReports() {
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [domain, setDomain] = useState('');
  const [activeDomain, setActiveDomain] = useState('');
  const [expandedReport, setExpandedReport] = useState(null);
  const [reportDetail, setReportDetail] = useState(null);
  const [detailError, setDetailError] = useState(false);

  const fetchReports = useCallback(async (d) => {
    setLoading(true);
    try {
      const query = d ? `?domain=${encodeURIComponent(d)}` : '';
      const [reportsRes, summaryRes] = await Promise.allSettled([
        axios.get(`/api/dmarc/reports/${query}`),
        d ? axios.get(`/api/dmarc/summary/?domain=${encodeURIComponent(d)}`) : Promise.reject('no domain'),
      ]);
      setReports(reportsRes.status === 'fulfilled' ? reportsRes.value.data : []);
      setSummary(summaryRes.status === 'fulfilled' ? summaryRes.value.data : null);
    } catch {
      setReports([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post('/api/dmarc/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Imported ${res.data.total_messages} messages from ${res.data.org_name || res.data.domain}`);
      if (res.data.domain) {
        setActiveDomain(res.data.domain);
        setDomain(res.data.domain);
        fetchReports(res.data.domain);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not upload the report.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this report?')) return;
    try {
      await axios.delete(`/api/dmarc/reports/${id}`);
      toast.success('Report deleted');
      fetchReports(activeDomain);
    } catch {
      toast.error('Could not delete the report.');
    }
  };

  const handleFilter = (event) => {
    event?.preventDefault();
    setActiveDomain(domain.trim().toLowerCase());
    fetchReports(domain.trim().toLowerCase());
  };

  const toggleExpand = async (id) => {
    if (expandedReport === id) {
      setExpandedReport(null);
      setReportDetail(null);
      return;
    }
    setExpandedReport(id);
    setDetailError(false);
    try {
      const res = await axios.get(`/api/dmarc/reports/${id}`);
      setReportDetail(res.data);
    } catch {
      setReportDetail(null);
      setDetailError(true);
    }
  };

  useEffect(() => {
    fetchReports('');
  }, [fetchReports]);

  return (
    <div>
      <PageHeader
        title="DMARC reports"
        description="Upload the aggregate reports mailbox providers send to your rua address to see which senders pass and fail DMARC for your domains."
        actions={(
          <label
            className={`${secondaryButtonClass} cursor-pointer focus-within:ring-2 focus-within:ring-accent/40 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            title="DMARC aggregate report: .xml, .xml.gz or .zip, up to 10 MB"
          >
            {uploading ? <Spinner /> : <HiOutlineArrowUpTray className="text-base text-ink-2" aria-hidden="true" />}
            {uploading ? 'Uploading' : 'Upload report'}
            <input type="file" accept=".xml,.gz,.zip" onChange={handleUpload} className="sr-only" disabled={uploading} />
          </label>
        )}
      />

      <form onSubmit={handleFilter} className="mt-5" noValidate>
        <label htmlFor="dmarc-domain-filter" className="block text-sm font-medium text-ink mb-1.5">Filter by domain</label>
        <div className="flex flex-col sm:flex-row gap-2 max-w-2xl">
          <input
            id="dmarc-domain-filter"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            className={`${inputClass} font-mono`}
          />
          <button type="submit" className={`${primaryButtonClass} sm:min-w-[7.5rem]`}>Filter</button>
        </div>
        <p className="mt-1.5 text-xs text-ink-2">Filter to one domain to see its pass rates and top senders. Leave empty to list every report.</p>
      </form>

      <div className="mt-8 space-y-8">
        {summary && <SummaryPanel data={summary} />}

        <Section
          id="dmarc-reports"
          title={activeDomain
            ? <>Reports for <span className="font-mono font-semibold break-all">{activeDomain}</span></>
            : 'All reports'}
          action={!loading && reports.length > 0 && <span className="text-xs text-ink-2">{plural(reports.length, 'report')}</span>}
        >
          {loading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Loading reports">
              {[...Array(4)].map((_, i) => <SkeletonLine key={i} className="h-9" />)}
            </div>
          ) : reports.length === 0 ? (
            <EmptyState icon={HiOutlineDocumentText} title={activeDomain ? `No reports for ${activeDomain}` : 'No DMARC reports yet'}>
              {activeDomain
                ? 'Check the domain spelling, clear the filter, or upload a report for this domain.'
                : 'Use “Upload report” to import an aggregate report (.xml, .xml.gz or .zip) from a mailbox provider.'}
            </EmptyState>
          ) : (
            <ReportList
              reports={reports}
              expandedReport={expandedReport}
              reportDetail={reportDetail}
              detailError={detailError}
              onToggle={toggleExpand}
              onDelete={handleDelete}
            />
          )}
        </Section>
      </div>
    </div>
  );
}

/* ---------- Report list ---------- */
function ReportList({ reports, expandedReport, reportDetail, detailError, onToggle, onDelete }) {
  return (
    <div className="relative overflow-x-auto rounded-md border border-rule">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-sunk">
          <tr className="text-left">
            <th scope="col" className={thClass}>Reporter</th>
            <th scope="col" className={thClass}>Domain</th>
            <th scope="col" className={thClass}>Date-Range</th>
            <th scope="col" className={thClass}>Policy</th>
            <th scope="col" className={`${thClass} text-right`}>Messages</th>
            <th scope="col" className={`${thClass} text-right`}>Senders</th>
            <th scope="col" className="border-b border-rule"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => {
            const expanded = expandedReport === r.id;
            const detailId = `dmarc-report-${r.id}`;
            return (
              <Fragment key={r.id}>
                <tr className={`${rowClass} cursor-pointer ${expanded ? 'bg-sunk/60' : ''}`} onClick={() => onToggle(r.id)}>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-left font-medium text-ink hover:text-accent"
                      onClick={(e) => { e.stopPropagation(); onToggle(r.id); }}
                      aria-expanded={expanded}
                      aria-controls={expanded ? detailId : undefined}
                    >
                      {expanded
                        ? <HiChevronDown className="shrink-0 text-ink-2" aria-hidden="true" />
                        : <HiChevronRight className="shrink-0 text-ink-2" aria-hidden="true" />}
                      {r.org_name}
                    </button>
                  </td>
                  <td className="px-3 py-2 font-mono text-[13px] text-ink whitespace-nowrap">{r.domain}</td>
                  <td className="px-3 py-2 text-ink whitespace-nowrap tabular-nums">{dateRange(r.date_begin, r.date_end)}</td>
                  <td className="px-3 py-2 font-mono text-[13px] text-ink whitespace-nowrap">p={r.policy_p || 'none'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.total_messages.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.records_count.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDelete(r.id); }}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md text-ink-2 hover:text-s5 hover:bg-s5-soft transition-colors"
                      aria-label={`Delete report from ${r.org_name}`}
                      title="Delete report"
                    >
                      <HiOutlineTrash aria-hidden="true" />
                    </button>
                  </td>
                </tr>
                {expanded && (
                  <tr className="border-b border-rule last:border-b-0">
                    <td id={detailId} colSpan={7} className="px-3 pt-3 pb-4">
                      <ReportDetail detail={reportDetail?.id === r.id ? reportDetail : null} failed={detailError} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReportDetail({ detail, failed }) {
  if (failed) return <Alert tone="error">Could not load this report. Close it and try again.</Alert>;
  if (!detail) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading report">
        {[...Array(3)].map((_, i) => <SkeletonLine key={i} className="h-6" />)}
      </div>
    );
  }
  const records = detail.records || [];
  const passed = records.filter(passes).reduce((sum, r) => sum + r.count, 0);
  const failedCount = records.reduce((sum, r) => sum + r.count, 0) - passed;
  return (
    <div className="space-y-3">
      <Fields>
        <Field name="Report-ID"><span className="font-mono text-[13px] break-all">{detail.report_id}</span></Field>
        {detail.email && <Field name="Reporter-Email"><span className="font-mono text-[13px] break-all">{detail.email}</span></Field>}
        <Field name="DMARC-Pass">
          <span className="tabular-nums"><span className="font-mono text-xs font-semibold text-s2" aria-hidden="true">2.x</span> {plural(passed, 'message')}</span>
        </Field>
        <Field name="DMARC-Fail">
          <span className="tabular-nums">
            <span className={`font-mono text-xs font-semibold ${failedCount ? 'text-s5' : 'text-ink-3'}`} aria-hidden="true">5.x</span> {plural(failedCount, 'message')}
          </span>
        </Field>
      </Fields>
      <RecordTable records={records} />
    </div>
  );
}

/* ---------- Summary ---------- */
function SummaryVerdict({ passRate, total }) {
  const status = passRate >= 90
    ? { code: '2.x', tone: 'text-s2' }
    : passRate >= 70
      ? { code: '4.x', tone: 'text-s4' }
      : { code: '5.x', tone: 'text-s5' };
  return (
    <p role="status" className="flex flex-wrap items-baseline gap-x-2.5">
      <span className={`font-mono text-lg font-semibold ${status.tone}`} aria-hidden="true">{status.code}</span>
      <span className="text-lg font-semibold text-ink">{passRate}% of {plural(total, 'message')} pass DMARC</span>
    </p>
  );
}

function SummaryPanel({ data }) {
  const { pass_rate, total_messages, disposition_breakdown, top_senders, report_count, date_range, policy } = data;

  return (
    <Section id="dmarc-summary" title={<>Summary for <span className="font-mono font-semibold break-all">{data.domain}</span></>}>
      <div className="space-y-5">
        <SummaryVerdict passRate={pass_rate.aligned} total={total_messages} />

        <Fields>
          <Field name="Policy">
            <span className="font-mono text-[13px]">p={policy?.p || 'none'} adkim={policy?.adkim || 'r'} aspf={policy?.aspf || 'r'}</span>
          </Field>
          <Field name="DKIM-Pass"><span className={`font-semibold tabular-nums ${rateTone(pass_rate.dkim, 70)}`}>{pass_rate.dkim}%</span></Field>
          <Field name="SPF-Pass"><span className={`font-semibold tabular-nums ${rateTone(pass_rate.spf, 70)}`}>{pass_rate.spf}%</span></Field>
          <Field name="Disposition">
            {Object.keys(disposition_breakdown || {}).length ? (
              <span className="flex flex-wrap gap-x-4 tabular-nums">
                {Object.entries(disposition_breakdown).map(([key, val]) => (
                  <span key={key}><span className="font-mono text-xs text-ink-2">{key}</span> {val.toLocaleString()}</span>
                ))}
              </span>
            ) : null}
          </Field>
          <Field name="Reports">
            <span className="tabular-nums">{plural(report_count, 'report')}, {dateRange(date_range?.earliest, date_range?.latest)}</span>
          </Field>
        </Fields>

        {top_senders?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-ink mb-2">Top senders</h3>
            <div className="overflow-auto max-h-[40vh] rounded-md border border-rule">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-[1] bg-sunk">
                  <tr className="text-left">
                    <th scope="col" className={`${thClass} w-full`}>Source-IP</th>
                    <th scope="col" className={`${thClass} text-right`}>Messages</th>
                    <th scope="col" className={`${thClass} text-right`}>DKIM</th>
                    <th scope="col" className={`${thClass} text-right`}>SPF</th>
                  </tr>
                </thead>
                <tbody>
                  {top_senders.map((s, i) => (
                    <tr key={i} className={rowClass}>
                      <td className="px-3 py-2 font-mono text-[13px] text-ink whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">{s.ip} <CopyButton text={s.ip} label={`Copy ${s.ip}`} /></span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.count.toLocaleString()}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${rateTone(s.dkim_rate)}`}>{s.dkim_rate}%</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${rateTone(s.spf_rate)}`}>{s.spf_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

/* ---------- Record table ---------- */
const DISPOSITION_TONES = {
  reject: 'bg-s5-soft text-s5',
  quarantine: 'bg-s4-soft text-s4',
};

function AlignResult({ value }) {
  const pass = value === 'pass';
  return <span className={`font-mono text-xs font-semibold ${pass ? 'text-s2' : 'text-s5'}`}>{value || 'none'}</span>;
}

function RecordTable({ records }) {
  if (!records?.length) return <p className="text-sm text-ink-2">No records in this report.</p>;
  return (
    // Sits inside the report list's row, so it draws hairlines only (no second box).
    <div className="overflow-auto max-h-[40vh] border-t border-rule">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 z-[1] bg-sunk">
          <tr className="text-left">
            <th scope="col" className={thClass}>Source-IP</th>
            <th scope="col" className={`${thClass} text-right`}>Count</th>
            <th scope="col" className={thClass}>Disposition</th>
            <th scope="col" className={thClass}>DKIM</th>
            <th scope="col" className={thClass}>SPF</th>
            <th scope="col" className={thClass}>DKIM-Domain</th>
            <th scope="col" className={thClass}>SPF-Domain</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={i} className={rowClass}>
              <td className="px-3 py-2 font-mono text-[13px] text-ink whitespace-nowrap">{r.source_ip}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.count.toLocaleString()}</td>
              <td className="px-3 py-2">
                <span className={`inline-flex rounded px-1.5 py-px font-mono text-xs ${DISPOSITION_TONES[r.disposition] || 'text-ink-2'}`}>
                  {r.disposition}
                </span>
              </td>
              <td className="px-3 py-2"><AlignResult value={r.dkim_aligned} /></td>
              <td className="px-3 py-2"><AlignResult value={r.spf_aligned} /></td>
              <td className="px-3 py-2 font-mono text-xs text-ink-2 break-all">{formatAuthResults(r.dkim_results, r.dkim_domain, r.dkim_result)}</td>
              <td className="px-3 py-2 font-mono text-xs text-ink-2 break-all">{formatAuthResults(r.spf_results, r.spf_domain, r.spf_result)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatAuthResults(results, domain, result) {
  if (results?.length) {
    return results.map((item) => `${item.domain || '—'} (${item.result || 'unknown'})`).join(', ');
  }
  return domain ? `${domain} (${result || 'unknown'})` : '—';
}
