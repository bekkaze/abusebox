import { listingFor, providerStatus, sortProviders } from './providerStatus';

// Built in the browser from the result already on screen, like the CSV export,
// so copying a report never re-runs the (slow) check.
const stamp = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return 'unknown';
  // 2026-10-26 14:02 UTC: unambiguous for a ticket or an email abroad.
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
};

const meaning = (entry) => (entry?.categories || []).filter((item) => item !== 'unknown').join('; ');

/** A blacklist result as plain text, in the header style the UI uses, to paste
    into a ticket or an email to a blacklist operator. */
export function blacklistReportText(data, { target, checked } = {}) {
  const providers = sortProviders(data);
  const failed = data?.failed_providers || [];
  const listed = data?.detected_on || [];
  const answered = providers.length - failed.length;

  const lines = [
    `Target: ${target || data?.hostname || 'unknown'}`,
    `Checked: ${stamp(checked)}`,
    listed.length
      ? `Status: 5.x Listed on ${listed.length} of ${providers.length} blacklists`
      : `Status: 2.x Not listed on any of the ${answered} blacklists that answered`,
  ];

  // Listed first and most serious first, in the same order as the table.
  providers.forEach((provider) => {
    const status = providerStatus(data, provider);
    if (status !== 'listed' && status !== 'requested') return;
    const entry = listingFor(data, provider);
    const parts = [provider];
    if (entry?.severity) parts.push(`(${entry.severity})`);
    if (meaning(entry)) parts.push(meaning(entry));
    if (status === 'requested') parts.push('[removal requested]');
    lines.push(`Listed-On: ${parts.join(' ')}`);
  });

  failed.forEach((provider) => lines.push(`No-Answer: ${provider}`));

  if (data?.is_inconclusive) {
    lines.push('Note: Too many blacklists did not answer to trust a clean result.');
  }

  return `${lines.join('\n')}\n`;
}
