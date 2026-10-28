import { useEffect, useState } from 'react';
import { getResolverHealth } from '../../services/blacklist/checkService';
import { Alert, linkClass } from './ui';

const HELP_URL = 'https://github.com/bekkaze/abusebox#blacklists-that-show-no-answer';

/** Says so when blacklist lookups can't be trusted because the DNS resolver is refused. */
export default function ResolverWarning({ className = '' }) {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getResolverHealth()
      .then((data) => !cancelled && setHealth(data))
      .catch(() => { /* the check itself failing says nothing about the resolver */ });
    return () => { cancelled = true; };
  }, []);

  if (health?.ok !== false) return null;
  return (
    <Alert tone="warning" className={className}>
      <strong className="font-semibold">Spamhaus isn&apos;t answering this server&apos;s DNS resolver</strong>, so blacklist
      results can show &ldquo;No answer&rdquo; instead of listed or clear. Spamhaus refuses public resolvers such as
      Google and Cloudflare, and DNS rebinding protection (dnsmasq, pfSense) drops blacklist answers.{' '}
      <a href={HELP_URL} target="_blank" rel="noreferrer" className={linkClass}>How to fix it</a>
    </Alert>
  );
}
