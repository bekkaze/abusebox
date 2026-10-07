"""Shared test setup.

Settings are read at import time, so point the app at a throwaway database and
secret file before any ``app`` module is imported.
"""

import os
import tempfile

_TMP = tempfile.mkdtemp(prefix="abusebox-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(_TMP, 'test.db')}"
os.environ["SECRET_KEY_FILE"] = os.path.join(_TMP, ".secret_key")
os.environ["SCHEDULER_ENABLED"] = "false"
os.environ.pop("APP_SECRET_KEY", None)

import pytest  # noqa: E402


def pytest_configure(config):
    config.addinivalue_line("markers", "network: needs live DNS/Internet access (deselect with -m 'not network')")


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient

    from app.api.routers import auth as auth_routes
    from app.api.routers import blacklist as blacklist_routes
    from app.db.session import Base, engine
    from app.main import app

    # Fresh database and rate-limit state for every test.
    Base.metadata.drop_all(bind=engine)
    auth_routes._login_attempts.clear()
    auth_routes._login_locked_until.clear()
    blacklist_routes._public_check_requests.clear()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def admin_headers(client):
    response = client.post("/user/login/", json={"username": "admin", "password": "password123"})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access']}"}
