import React, { useState } from 'react';
import { HiClipboardCopy, HiCheck } from 'react-icons/hi';

export default function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false);

  if (!text) return null;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(String(text)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors ${className}`}
      title="Copy to clipboard"
    >
      {copied ? <HiCheck className="text-emerald-500" /> : <HiClipboardCopy />}
    </button>
  );
}
