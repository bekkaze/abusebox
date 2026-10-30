import { useState } from 'react';
import { HiCheck, HiOutlineClipboardDocument } from 'react-icons/hi2';
import { copyToClipboard } from './clipboard';
import { secondaryButtonClass } from './ui';

/** Shared click handler and the short-lived copied / failed state after it. */
function useCopy(text) {
  const [state, setState] = useState('');

  const copy = (e) => {
    e.stopPropagation();
    copyToClipboard(String(text)).then((ok) => {
      setState(ok ? 'copied' : 'failed');
      setTimeout(() => setState(''), ok ? 1500 : 6000);
    });
  };

  return [state, copy];
}

/** Icon-only copy, for field values in tables and detail rows. */
export default function CopyButton({ text, className = '', label = 'Copy to clipboard' }) {
  const [state, copy] = useCopy(text);

  if (!text) return null;

  const title = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label;
  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center justify-center p-1 -m-1 rounded text-ink-2 hover:text-accent transition-colors ${className}`}
      title={title}
      aria-label={title}
    >
      {state === 'copied' ? <HiCheck className="text-s2" aria-hidden="true" /> : <HiOutlineClipboardDocument aria-hidden="true" />}
      <span className="sr-only" aria-live="polite">{state === 'copied' ? 'Copied' : ''}</span>
    </button>
  );
}

/** Copy with a visible label, for report actions next to "Export CSV". */
export function CopyTextButton({ text, label, className = '' }) {
  const [state, copy] = useCopy(text);

  if (!text) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <button type="button" onClick={copy} className={`${secondaryButtonClass} ${className}`}>
        {state === 'copied'
          ? <HiCheck className="text-base text-s2" aria-hidden="true" />
          : <HiOutlineClipboardDocument className="text-base text-ink-2" aria-hidden="true" />}
        {state === 'copied' ? 'Copied' : label}
      </button>
      <span className="sr-only" aria-live="polite">{state === 'copied' ? 'Copied' : ''}</span>
      {state === 'failed' && <span role="status" className="text-xs text-s4">The browser blocked clipboard access.</span>}
    </span>
  );
}
