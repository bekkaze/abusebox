"""Where a registered domain starts, for hosts that sit under one.

Two checks need this and they need it for different reasons, so it lives here
rather than inside either of them:

* WHOIS can only ask about a name someone registered, so mail1.example.nl has
  to be looked up as example.nl (issue #39).
* DMARC falls back to the organisational domain when a host publishes no
  record of its own, which RFC 7489 section 6.6.3 defines (issue #40).

SPF deliberately does not use this. A sending host publishes its own SPF
record, and replacing it with the parent's would report a policy that is not
the one in force.
"""

import ipaddress
import logging
from functools import lru_cache

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _public_suffix_list():
    # Built once and reused: parsing the list takes a moment, and the data is
    # bundled with the package, so nothing is fetched at runtime.
    #
    # ICANN rules only. The list's private section records where services let
    # people put a site, such as github.io or pages.dev, which is the right
    # boundary for cookies but not for either use here: .io knows github.io,
    # because someone registered it, and knows nothing at all about
    # foo.github.io. Including that section would ask the wrong question.
    from publicsuffixlist import PublicSuffixList

    return PublicSuffixList(only_icann=True)


def registrable_domain(host: str) -> str | None:
    """The domain actually registered, for a host that belongs to one.

    Where that boundary sits needs the Public Suffix List: taking the last two
    labels would turn mail.example.co.uk into co.uk, which is a public suffix
    and not a registration at all.

    None for anything that is not a name under a registrable domain: an IP
    address, "localhost", or a bare suffix such as "nl". Callers leave those
    alone rather than guessing.
    """
    if not host:
        return None
    try:
        ipaddress.ip_address(host)
        return None
    except ValueError:
        pass
    try:
        return _public_suffix_list().privatesuffix(host) or None
    except Exception:  # pragma: no cover - a malformed name is not worth failing on
        logger.warning("Could not reduce %s to a registrable domain", host, exc_info=True)
        return None
