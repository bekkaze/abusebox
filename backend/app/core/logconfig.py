"""Logging setup.

Named `logconfig` rather than `logging` so nothing inside this package can
shadow the standard library module by accident.

Until this existed every module called `logging.getLogger(__name__)` and nothing
ever configured a handler, so application logs fell back to whatever uvicorn had
set up and `logger.info` from the scheduler and the check services was dropped
entirely. An operator debugging a stalled scheduler saw nothing.

Output is plain text by default, because the first reader is a person running
`docker compose logs`. JSON is available for installs that ship logs somewhere
that parses them.
"""

import json
import logging
import os
import sys
from datetime import UTC, datetime

_LEVELS = {"CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging() -> None:
    """Attach one handler to the root logger. Safe to call more than once."""
    level_name = os.getenv("LOG_LEVEL", "INFO").strip().upper()
    if level_name not in _LEVELS:
        level_name = "INFO"
    level = getattr(logging, level_name)

    if os.getenv("LOG_FORMAT", "text").strip().lower() == "json":
        formatter: logging.Formatter = JsonFormatter()
    else:
        formatter = logging.Formatter(
            "%(asctime)s %(levelname)-8s %(name)s: %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        )

    root = logging.getLogger()
    for existing in list(root.handlers):
        if getattr(existing, "_abusebox", False):
            root.removeHandler(existing)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    handler._abusebox = True  # type: ignore[attr-defined]
    root.addHandler(handler)
    root.setLevel(level)

    # uvicorn installs its own handlers; let its records reach ours instead of
    # being printed twice in a different format.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers.clear()
        uvicorn_logger.propagate = True
