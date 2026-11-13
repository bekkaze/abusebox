import { Alert, linkClass } from './ui';

const HELP_URL = 'https://github.com/bekkaze/abusebox/blob/main/docs/troubleshooting.md#mail-servers-that-show-no-answer';

/**
 * Says so when no host answered on port 25 at all, which points at this
 * network rather than at every server being down. Hosts that are not mail
 * servers normally refuse the connection, so one refusal or one greeting is
 * enough to show outbound port 25 works and keep this quiet.
 */
export default function MailEgressWarning({ assets, className = '' }) {
  const states = (assets || [])
    .map((asset) => asset.health?.mail?.smtp)
    .filter((state) => state && state !== 'not_checked');
  if (states.length < 2 || !states.every((state) => state === 'no_answer')) return null;
  return (
    <Alert tone="warning" className={className}>
      <strong className="font-semibold">None of the {states.length} hosts with the mail-server check answered on port 25.</strong>{' '}
      That usually means outbound port 25 is blocked where AbuseBox runs, which is the default on AWS, Google Cloud,
      Azure and DigitalOcean, rather than that every server is down. Reverse DNS checks are unaffected.{' '}
      <a href={HELP_URL} target="_blank" rel="noreferrer" className={linkClass}>What to do</a>
    </Alert>
  );
}
