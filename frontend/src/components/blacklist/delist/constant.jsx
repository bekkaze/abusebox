// Official lookup / removal pages for the blacklists that publish one.
// AbuseBox can't submit these forms for you (most use CAPTCHAs or email
// confirmation); the modal links here and tracks that a request was made.
const REMOVAL_PAGES = {
  'zen.spamhaus.org': 'https://check.spamhaus.org/',
  'cbl.abuseat.org': 'https://check.spamhaus.org/',
  'bl.spamcop.net': 'https://www.spamcop.net/bl.shtml',
  'b.barracudacentral.org': 'https://www.barracudacentral.org/rbl/removal-request',
  'dnsbl-1.uceprotect.net': 'https://www.uceprotect.net/en/rblcheck.php',
  'dnsbl-2.uceprotect.net': 'https://www.uceprotect.net/en/rblcheck.php',
  'dnsbl-3.uceprotect.net': 'https://www.uceprotect.net/en/rblcheck.php',
  'psbl.surriel.com': 'https://psbl.org/',
  'dnsbl.dronebl.org': 'https://dronebl.org/lookup',
  'ix.dnsbl.manitu.net': 'https://www.dnsbl.manitu.net/',
  'dyna.spamrats.com': 'https://www.spamrats.com/removal.php',
  'noptr.spamrats.com': 'https://www.spamrats.com/removal.php',
  'spam.spamrats.com': 'https://www.spamrats.com/removal.php',
  'ubl.lashback.com': 'https://blacklist.lashback.com/',
};

export function removalPageFor(provider) {
  return REMOVAL_PAGES[provider] || `https://duckduckgo.com/?q=${encodeURIComponent(`${provider} blacklist removal`)}`;
}

export function hasOfficialRemovalPage(provider) {
  return provider in REMOVAL_PAGES;
}
