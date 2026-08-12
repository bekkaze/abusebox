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

function parseUtcDate(value) {
  if (value instanceof Date) return value;
  // SQLite-backed API timestamps are UTC but arrive without an offset.
  // JavaScript otherwise interprets them as browser-local time.
  const normalized = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && !/(Z|[+-]\d{2}:\d{2})$/.test(value)
    ? `${value}Z`
    : value;
  return new Date(normalized);
}

function formatRelative(date) {
  const d = parseUtcDate(date);
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
  const d = parseUtcDate(date);
  if (Number.isNaN(d.getTime())) return null;
  const relative = formatRelative(d);
  const absolute = d.toLocaleString();

  return (
    <span className={className} title={absolute}>
      {relative}
    </span>
  );
}
