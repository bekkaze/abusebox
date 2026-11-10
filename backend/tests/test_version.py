"""The version is stated in three files that cannot import each other.

1.3.6 shipped with `pyproject.toml` still reading 1.3.5, because bumping a
release means editing three files by hand and one was missed. This asserts
they agree, so the next miss fails CI instead of reaching a release.
"""

import json
import pathlib
import re

from app import __version__

_BACKEND = pathlib.Path(__file__).resolve().parents[1]
_REPO = _BACKEND.parent


def test_pyproject_matches_package_version():
    text = (_BACKEND / "pyproject.toml").read_text(encoding="utf-8")
    match = re.search(r'^version\s*=\s*"([^"]+)"', text, re.MULTILINE)
    assert match, "no version in pyproject.toml"
    assert match.group(1) == __version__


def test_frontend_package_json_matches_package_version():
    package_json = _REPO / "frontend" / "package.json"
    if not package_json.exists():  # backend published on its own
        return
    assert json.loads(package_json.read_text(encoding="utf-8"))["version"] == __version__
