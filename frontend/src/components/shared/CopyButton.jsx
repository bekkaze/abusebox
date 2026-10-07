import { useState } from 'react';
import { HiClipboardCopy, HiCheck } from 'react-icons/hi';

export default function CopyButton({ text, className = '', label = 'Copy to clipboard' }) {
  const [copied, setCopied] = useState(false);

  if (!text) return null;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(String(text)).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => setCopied(false),
    );
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center justify-center p-1 -m-1 rounded text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors ${className}`}
      title={copied ? 'Copied' : label}
      aria-label={copied ? 'Copied' : label}
    >
      {copied ? <HiCheck className="text-emerald-500" aria-hidden="true" /> : <HiClipboardCopy aria-hidden="true" />}
      <span className="sr-only" aria-live="polite">{copied ? 'Copied' : ''}</span>
    </button>
  );
}
