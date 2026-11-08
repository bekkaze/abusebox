"""Keeping a value that came from outside from forging a line in the log.

A hostname or a WHOIS server name arrives from a form, an API call or a
registry referral, and ends up interpolated into log output. A carriage return
or newline in one would let it close the real entry and open what reads as
another authentic one, so they are escaped rather than written through. The
length cap is for the same reason: a log line is only useful if it can be
read.
"""

_MAX_LOGGED_LENGTH = 200


def for_log(value: object) -> str:
    """*value* as a single line, safe to interpolate into a log message."""
    text = str(value)
    if len(text) > _MAX_LOGGED_LENGTH:
        text = text[:_MAX_LOGGED_LENGTH] + "..."
    return text.replace("\\", "\\\\").replace("\r", "\\r").replace("\n", "\\n").replace("\t", "\\t")
