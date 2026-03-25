import React, { useState, useEffect, useCallback } from 'react';
import { HiUpload, HiTrash, HiChevronDown, HiChevronUp } from 'react-icons/hi';
import axios from 'axios';
import CopyButton from '../../components/shared/CopyButton';
import TimeAgo from '../../components/shared/TimeAgo';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function DmarcReports() {
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [domain, setDomain] = useState('');
  const [activeDomain, setActiveDomain] = useState('');
  const [expandedReport, setExpandedReport] = useState(null);
  const [reportDetail, setReportDetail] = useState(null);

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
      toast.error(err.response?.data?.detail || 'Failed to upload report.');
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
      toast.error('Failed to delete report.');
    }
  };

  const handleFilter = () => {
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
    try {
      const res = await axios.get(`/api/dmarc/reports/${id}`);
      setReportDetail(res.data);
    } catch {
      setReportDetail(null);
    }
  };

  useEffect(() => {
    fetchReports('');
  }, [fetchReports]);

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
        <p className="text-sm text-slate-500 dark:text-slate-400">Email Security</p>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">DMARC Aggregate Reports</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Upload DMARC aggregate XML reports to see what's actually passing and failing across all senders.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
            placeholder="Filter by domain (e.g. example.com)"
            className="flex-1 p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none dark:bg-slate-700 dark:text-white"
          />
          <button onClick={handleFilter} className="bg-cyan-600 hover:bg-cyan-700 text-white py-2.5 px-5 rounded-lg transition-colors font-medium">
            Filter
          </button>
          <label className={`inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-5 rounded-lg transition-colors font-medium cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <HiUpload />
            {uploading ? 'Uploading...' : 'Upload Report'}
            <input type="file" accept=".xml,.gz,.zip" onChange={handleUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Summary */}
      {summary && <SummaryPanel data={summary} />}

      {/* Reports list */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center">
            <HiUpload className="text-4xl text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">No DMARC reports yet. Upload an aggregate report XML to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {reports.map((r) => (
              <div key={r.id}>
                <div
                  className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                  onClick={() => toggleExpand(r.id)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{r.org_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {r.domain} &middot; {r.total_messages} messages &middot; {r.records_count} senders
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${r.policy_p === 'reject' ? 'bg-emerald-100 text-emerald-800' : r.policy_p === 'quarantine' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                      p={r.policy_p || 'none'}
                    </span>
                    <TimeAgo date={r.date_begin} className="text-xs text-slate-400" />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                    >
                      <HiTrash />
                    </button>
                    {expandedReport === r.id ? <HiChevronUp className="text-slate-400" /> : <HiChevronDown className="text-slate-400" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedReport === r.id && reportDetail && (
                  <div className="px-5 pb-5">
                    <RecordTable records={reportDetail.records} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ToastContainer position="top-center" autoClose={3000} />
    </section>
  );
}

/* ---------- Summary ---------- */
function SummaryPanel({ data }) {
  const { pass_rate, total_messages, disposition_breakdown, top_senders, report_count, date_range, policy } = data;
  const alignedColor = pass_rate.aligned >= 90 ? 'text-emerald-600' : pass_rate.aligned >= 70 ? 'text-amber-600' : 'text-rose-600';

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Total Messages" value={total_messages.toLocaleString()} tone="sky" />
        <StatCard label="DKIM Pass" value={`${pass_rate.dkim}%`} tone={pass_rate.dkim >= 90 ? 'emerald' : 'amber'} />
        <StatCard label="SPF Pass" value={`${pass_rate.spf}%`} tone={pass_rate.spf >= 90 ? 'emerald' : 'amber'} />
        <StatCard label="Aligned" value={`${pass_rate.aligned}%`} tone={pass_rate.aligned >= 90 ? 'emerald' : pass_rate.aligned >= 70 ? 'amber' : 'rose'} />
      </div>

      {/* Policy + disposition */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-2">Current Policy</p>
          <div className="flex gap-3">
            <span className="bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-700 dark:text-slate-300">p={policy?.p || 'none'}</span>
            <span className="bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-700 dark:text-slate-300">adkim={policy?.adkim || 'r'}</span>
            <span className="bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-700 dark:text-slate-300">aspf={policy?.aspf || 'r'}</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">{report_count} report{report_count !== 1 ? 's' : ''} &middot; {date_range?.earliest?.slice(0, 10)} to {date_range?.latest?.slice(0, 10)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-2">Disposition</p>
          <div className="flex gap-3">
            {Object.entries(disposition_breakdown || {}).map(([key, val]) => (
              <div key={key} className="text-center">
                <p className="text-lg font-bold text-slate-800 dark:text-white">{val.toLocaleString()}</p>
                <p className="text-[10px] uppercase text-slate-500">{key}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top senders */}
      {top_senders?.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Top Senders</p>
          </div>
          <div className="overflow-auto max-h-[40vh]">
            <table className="w-full text-sm text-slate-700 dark:text-slate-300 border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0">
                <tr className="text-left">
                  <th className="px-4 py-2.5 text-xs uppercase text-slate-500 dark:text-slate-400">Source IP</th>
                  <th className="px-4 py-2.5 text-xs uppercase text-slate-500 dark:text-slate-400">Messages</th>
                  <th className="px-4 py-2.5 text-xs uppercase text-slate-500 dark:text-slate-400">DKIM</th>
                  <th className="px-4 py-2.5 text-xs uppercase text-slate-500 dark:text-slate-400">SPF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
                {top_senders.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-2 font-mono text-sm flex items-center gap-2">{s.ip} <CopyButton text={s.ip} /></td>
                    <td className="px-4 py-2">{s.count.toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={s.dkim_rate >= 90 ? 'text-emerald-600' : s.dkim_rate >= 50 ? 'text-amber-600' : 'text-rose-600'}>{s.dkim_rate}%</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={s.spf_rate >= 90 ? 'text-emerald-600' : s.spf_rate >= 50 ? 'text-amber-600' : 'text-rose-600'}>{s.spf_rate}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Record Table ---------- */
function RecordTable({ records }) {
  if (!records?.length) return <p className="text-sm text-slate-500">No records in this report.</p>;
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
      <div className="overflow-auto max-h-[40vh]">
        <table className="w-full text-sm text-slate-700 dark:text-slate-300 border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0">
            <tr className="text-left">
              <th className="px-3 py-2 text-xs uppercase text-slate-500 dark:text-slate-400">Source IP</th>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 dark:text-slate-400">Count</th>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 dark:text-slate-400">Disposition</th>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 dark:text-slate-400">DKIM</th>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 dark:text-slate-400">SPF</th>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 dark:text-slate-400">DKIM Domain</th>
              <th className="px-3 py-2 text-xs uppercase text-slate-500 dark:text-slate-400">SPF Domain</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
            {records.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/50">
                <td className="px-3 py-2 font-mono">{r.source_ip}</td>
                <td className="px-3 py-2">{r.count}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${r.disposition === 'reject' ? 'bg-rose-100 text-rose-800' : r.disposition === 'quarantine' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                    {r.disposition}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={r.dkim_aligned === 'pass' ? 'text-emerald-600' : 'text-rose-600'}>{r.dkim_aligned}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={r.spf_aligned === 'pass' ? 'text-emerald-600' : 'text-rose-600'}>{r.spf_aligned}</span>
                </td>
                <td className="px-3 py-2 text-xs">{r.dkim_domain || '—'}</td>
                <td className="px-3 py-2 text-xs">{r.spf_domain || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const tones = {
    sky: 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    rose: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300',
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.sky}`}>
      <p className="text-[11px] uppercase tracking-wide font-medium opacity-70">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}
