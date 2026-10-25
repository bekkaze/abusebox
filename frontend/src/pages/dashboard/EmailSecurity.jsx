import { useId, useState } from 'react';
import { HiOutlineEnvelope } from 'react-icons/hi2';
import { checkEmailSecurity } from '../../services/tools';
import { SeverityBadge, SeverityCode } from '../../components/shared/activity';
import { SkeletonLine } from '../../components/shared/Skeleton';
import {
  EmptyState, Field, Fields, PageHeader, Section, Spinner, inputClass, primaryButtonClass,
} from '../../components/shared/ui';

// Grade letter -> reply class: A/B delivered, C/D deferred, E/F rejected.
const GRADE_CLASS = {
  A: { code: '2.x', tone: 'text-s2' },
  B: { code: '2.x', tone: 'text-s2' },
  C: { code: '4.x', tone: 'text-s4' },
  D: { code: '4.x', tone: 'text-s4' },
  E: { code: '5.x', tone: 'text-s5' },
  F: { code: '5.x', tone: 'text-s5' },
};

const ENFORCING_POLICIES = ['quarantine', 'reject'];

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Per-mechanism outcome: its tag, and the findings listed under it. */
function assessSpf(spf = {}) {
  if (!spf.found) {
    return { status: { severity: 'critical', label: 'Missing' }, findings: [{ severity: 'critical', text: spf.details || 'No SPF record found.' }] };
  }
  const findings = (spf.warnings || []).map((text) => ({ severity: 'warning', text }));
  if (spf.valid && findings.length === 0) {
    findings.push({ severity: 'ok', text: `One SPF record, ending in ${spf.mechanism_all}.` });
  }
  return { status: spf.valid ? { severity: 'ok', label: 'Pass' } : { severity: 'warning', label: 'Weak' }, findings };
}

function assessDkim(dkim = {}) {
  if (!dkim.found) {
    return { status: { severity: 'warning', label: 'Not found' }, findings: [{ severity: 'warning', text: dkim.details || 'No DKIM selectors found.' }] };
  }
  const count = dkim.selectors_found?.length || 0;
  return {
    status: { severity: 'ok', label: 'Pass' },
    findings: [{ severity: 'ok', text: `DKIM key published for ${plural(count, 'selector')}.` }],
  };
}

function assessDmarc(dmarc = {}) {
  if (!dmarc.found) {
    return { status: { severity: 'critical', label: 'Missing' }, findings: [{ severity: 'critical', text: dmarc.details || 'No DMARC record found.' }] };
  }
  const enforced = ENFORCING_POLICIES.includes(dmarc.policy);
  const findings = (dmarc.warnings || []).map((text) => ({ severity: 'warning', text }));
  if (enforced && findings.length === 0) {
    findings.push({ severity: 'ok', text: `Policy p=${dmarc.policy} is enforced.` });
  }
  return { status: enforced ? { severity: 'ok', label: 'Pass' } : { severity: 'warning', label: 'Not enforced' }, findings };
}

function GradeVerdict({ data, failing }) {
  const grade = GRADE_CLASS[data.grade] || GRADE_CLASS.F;
  return (
    <div role="status" className="space-y-1.5">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`font-mono text-lg font-semibold ${grade.tone}`} aria-hidden="true">{grade.code}</span>
        <span className={`text-5xl leading-none font-semibold tracking-tight ${grade.tone}`} aria-hidden="true">{data.grade}</span>
        <span className="text-lg font-semibold text-ink">
          <span className="sr-only">Grade {data.grade}: </span>
          {data.score} of {data.max_score} protections in place
        </span>
      </p>
      <p className="text-sm text-ink-2">
        {failing.length ? <>Needs work: {failing.join(', ')}.</> : 'SPF, DKIM and an enforcing DMARC policy are all published.'}
      </p>
    </div>
  );
}

function RecordBlock({ children, label }) {
  return (
    <pre aria-label={label} className="bg-sunk rounded-md p-3 text-xs font-mono text-ink overflow-auto whitespace-pre-wrap break-all">{children}</pre>
  );
}

function Findings({ items }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.text} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2 text-sm">
          <SeverityCode severity={item.severity} className="pt-px" />
          <span className="text-ink">{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

function MechanismSection({ id, title, assessment, children }) {
  return (
    <Section id={id} title={title} action={<SeverityBadge severity={assessment.status.severity} label={assessment.status.label} />}>
      <div className="space-y-3">
        {children}
        <Findings items={assessment.findings} />
      </div>
    </Section>
  );
}

const mono = (value) => (value ? <span className="font-mono text-[13px] break-all">{value}</span> : null);

function EmailReport({ data }) {
  const spf = assessSpf(data.spf);
  const dkim = assessDkim(data.dkim);
  const dmarc = assessDmarc(data.dmarc);
  const failing = [['SPF', spf], ['DKIM', dkim], ['DMARC', dmarc]]
    .filter(([, item]) => item.status.severity !== 'ok')
    .map(([name]) => name);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-ink border-b border-rule pb-2 mb-3">
          Report for <span className="font-mono break-all">{data.domain}</span>
        </h2>
        <GradeVerdict data={data} failing={failing} />
      </div>

      <MechanismSection id="email-spf" title="SPF" assessment={spf}>
        {data.spf?.record && <RecordBlock label="SPF record">{data.spf.record}</RecordBlock>}
        {data.spf?.found && (
          <Fields>
            <Field name="All-Mechanism">{mono(data.spf.mechanism_all)}</Field>
            {data.spf.redirect && <Field name="Redirect">{mono(data.spf.redirect)}</Field>}
          </Fields>
        )}
      </MechanismSection>

      <MechanismSection id="email-dkim" title="DKIM" assessment={dkim}>
        {data.dkim?.selectors_found?.map((selector) => (
          <div key={selector.selector} className="space-y-2">
            <Fields>
              <Field name="Selector">{mono(selector.selector)}</Field>
              {selector.cname && <Field name="CNAME">{mono(selector.cname)}</Field>}
            </Fields>
            {selector.record && <RecordBlock label={`DKIM record for selector ${selector.selector}`}>{selector.record}</RecordBlock>}
          </div>
        ))}
        {data.dkim?.selectors_checked?.length > 0 && (
          <Fields>
            <Field name="Selectors-Checked">{mono(data.dkim.selectors_checked.join(', '))}</Field>
          </Fields>
        )}
      </MechanismSection>

      <MechanismSection id="email-dmarc" title="DMARC" assessment={dmarc}>
        {data.dmarc?.record && <RecordBlock label="DMARC record">{data.dmarc.record}</RecordBlock>}
        {data.dmarc?.found && (
          <Fields>
            <Field name="Policy">{mono(data.dmarc.policy)}</Field>
            {data.dmarc.subdomain_policy && <Field name="Subdomain-Policy">{mono(data.dmarc.subdomain_policy)}</Field>}
            <Field name="Percentage"><span className="tabular-nums">{data.dmarc.percentage}%</span></Field>
            <Field name="Aggregate-Reports">{mono(data.dmarc.rua)}</Field>
            {data.dmarc.ruf && <Field name="Failure-Reports">{mono(data.dmarc.ruf)}</Field>}
          </Fields>
        )}
      </MechanismSection>
    </div>
  );
}

export default function EmailSecurity() {
  const [hostname, setHostname] = useState('');
  const [dkimSelectors, setDkimSelectors] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const formId = useId();

  const handleCheck = async () => {
    if (!hostname.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const result = await checkEmailSecurity(hostname.trim(), dkimSelectors);
      setData(result);
    } catch (err) {
      setError(err.message || 'Email security check failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!loading) handleCheck();
  };

  return (
    <div>
      <PageHeader
        title="SPF / DKIM / DMARC"
        description="Grades a domain's email authentication records from A to F and says what to fix."
      />

      <form onSubmit={handleSubmit} className="mt-5 max-w-3xl" noValidate>
        <div className="grid gap-x-2 gap-y-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <div>
            <label htmlFor="email-security-domain" className="block text-sm font-medium text-ink mb-1.5">Domain</label>
            <input
              id="email-security-domain"
              type="text"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck="false"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="example.com"
              className={`${inputClass} font-mono`}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${formId}-error` : undefined}
            />
          </div>
          <div>
            <label htmlFor="email-security-selectors" className="block text-sm font-medium text-ink mb-1.5">
              DKIM selectors <span className="font-normal text-ink-2">(optional, comma-separated)</span>
            </label>
            <input
              id="email-security-selectors"
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck="false"
              value={dkimSelectors}
              onChange={(e) => setDkimSelectors(e.target.value)}
              placeholder="s1, selector2026"
              className={`${inputClass} font-mono`}
              aria-describedby={`${formId}-hint`}
            />
          </div>
          <button type="submit" className={`${primaryButtonClass} sm:min-w-[7.5rem]`} disabled={loading || !hostname.trim()}>
            {loading && <Spinner />}
            {loading ? 'Checking' : 'Check'}
          </button>
        </div>
        <p id={`${formId}-hint`} className="mt-1.5 text-xs text-ink-2">
          Leave selectors empty to try common names (default, google, selector1, selector2, k1 and others).
        </p>
        {error && <p id={`${formId}-error`} role="alert" className="mt-2 text-sm text-s5">{error}</p>}
      </form>

      <div className="mt-8">
        {data ? (
          <EmailReport data={data} />
        ) : loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Checking email security">
            <SkeletonLine className="h-10 w-80 max-w-full" />
            <SkeletonLine className="h-4 w-56" />
            <div className="pt-5 space-y-2">{[...Array(3)].map((_, i) => <SkeletonLine key={i} className="h-16" />)}</div>
          </div>
        ) : (
          <EmptyState icon={HiOutlineEnvelope} title="No check yet">
            Enter a domain above to grade its SPF, DKIM and DMARC records.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
