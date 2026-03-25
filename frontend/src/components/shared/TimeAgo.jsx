import React from 'react';

const UNITS = [
  { label: 'year', seconds: 31536000 },
  { label: 'month', seconds: 2592000 },
  { label: 'week', seconds: 604800 },
  { label: 'day', seconds: 86400 },
  { label: 'hour', seconds: 3600 },
  { label: 'minute', seconds: 60 },
  { label: 'second', seconds: 1 },
];

function formatRelative(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  for (const unit of UNITS) {
    const count = Math.floor(seconds / unit.seconds);
    if (count >= 1) return `${count} ${unit.label}${count > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

export default function TimeAgo({ date, className = '' }) {
  if (!date || date === 'Not checked') return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const relative = formatRelative(d);
  const absolute = d.toLocaleString();

  return (
    <span className={className} title={absolute}>
      {relative}
    </span>
  );
}
