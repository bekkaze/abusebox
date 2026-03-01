import React, { useState } from 'react';
import Typed from 'react-typed';
import { HiSparkles, HiStatusOnline, HiLightningBolt } from 'react-icons/hi';
import { checkBlacklist } from '../../services/blacklist/checkService';
import ResultTableQuick from '../blacklist/ResultTableQuick';

const Hero = () => {
  const [hostname, setHostname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [checkedTarget, setCheckedTarget] = useState('');

  const handleCheck = async () => {
    if (!hostname.trim()) return;
    const value = hostname.trim();
    setLoading(true);
    setError('');
    try {
      const result = await checkBlacklist(value);
      setReport(result);
      setCheckedTarget(value);
    } catch (err) {
      setReport(null);
      setError(err.message || 'Failed to check blacklist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className='text-white'>
      <div className='max-w-6xl mx-auto px-4 py-16 lg:py-24'>
        <div className='grid lg:grid-cols-2 gap-10 items-center'>
          <div>
            <div className='inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-300/10 px-4 py-1.5 text-xs font-semibold text-emerald-200'>
              <HiSparkles /> Open-source DNSBL monitoring
            </div>
            <h1 className='mt-6 text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight'>
              Detect blacklist risk before it impacts your
              <span className='block text-cyan-300'>
                <Typed
                  strings={['mail delivery', 'domain reputation', 'public services']}
                  typeSpeed={80}
                  backSpeed={40}
                  loop
                />
              </span>
            </h1>
            <p className='mt-6 text-slate-300 text-base md:text-lg max-w-xl'>
              AbuseBox continuously checks DNSBL providers and gives operators a clear, actionable view of blacklist status.
            </p>

            <div className='mt-8 flex flex-col sm:flex-row gap-3'>
              <input
                className='w-full rounded-xl bg-white/95 text-slate-900 px-4 py-3.5 outline-none ring-2 ring-transparent focus:ring-cyan-400'
                type='text'
                placeholder='example.com or 8.8.8.8'
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
              />
              <button
                className='rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 font-semibold px-6 py-3.5 hover:opacity-90 disabled:opacity-50 transition-opacity'
                onClick={handleCheck}
                disabled={!hostname.trim() || loading}
              >
                {loading ? 'Checking...' : 'Run Quick Check'}
              </button>
            </div>
            {error ? <p className='mt-3 text-sm text-rose-300'>{error}</p> : null}
          </div>

          <div className='rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md p-6 shadow-2xl shadow-black/30'>
            <h2 className='text-lg font-semibold text-slate-100'>Why teams choose AbuseBox</h2>
            <div className='mt-6 space-y-4'>
              <div className='flex gap-3'>
                <div className='h-9 w-9 rounded-lg bg-cyan-500/20 text-cyan-300 grid place-items-center'><HiStatusOnline /></div>
                <div>
                  <p className='font-medium'>Realtime provider coverage</p>
                  <p className='text-sm text-slate-400'>Checks across dozens of DNSBL sources in one pass.</p>
                </div>
              </div>
              <div className='flex gap-3'>
                <div className='h-9 w-9 rounded-lg bg-emerald-500/20 text-emerald-300 grid place-items-center'><HiLightningBolt /></div>
                <div>
                  <p className='font-medium'>Fast triage workflow</p>
                  <p className='text-sm text-slate-400'>Clear status summaries and provider-level detection details.</p>
                </div>
              </div>
              <div className='rounded-xl border border-slate-700 bg-slate-950/60 p-4'>
                <p className='text-xs text-slate-400'>Tip</p>
                <p className='mt-1 text-sm text-slate-200'>Use <span className='text-cyan-300 font-semibold'>admin / password123</span> to access the dashboard quickly in local environments.</p>
              </div>
            </div>
          </div>
        </div>

        {report ? (
          <div className='mt-10 rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-md p-5'>
            <h3 className='text-lg font-semibold text-slate-100'>Blacklist Report: <span className='text-cyan-300'>{checkedTarget}</span></h3>
            <div className='mt-4 overflow-hidden rounded-xl border border-slate-700 bg-slate-950/60'>
              <ResultTableQuick data={report} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default Hero;
