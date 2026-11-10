"""AbuseBox backend.

The version lives here and nowhere else in Python. `pyproject.toml` and
`frontend/package.json` carry their own copies because their formats require
a literal, so `tests/test_version.py` asserts all three agree: 1.3.6 shipped
with `pyproject.toml` still reading 1.3.5 because three files had to be edited
by hand and one was missed.
"""

__version__ = "1.5.0"
