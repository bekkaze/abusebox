"""Schema migrations: fresh installs and databases created by 1.x releases."""

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text

from app.db.migrate import run_migrations
from app.db.session import Base


def _schema_drift(engine):
    """Differences between the migrated database and the models; must be none."""
    with engine.connect() as conn:
        return compare_metadata(MigrationContext.configure(conn), Base.metadata)


def _version(engine):
    with engine.connect() as conn:
        return conn.execute(text("SELECT version_num FROM alembic_version")).scalar()


def test_fresh_database_is_created_at_head(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'fresh.db'}")
    run_migrations(engine)
    tables = set(inspect(engine).get_table_names())
    assert {"users", "hostnames", "check_histories", "asset_events", "app_settings"} <= tables
    assert "blacklisted_hostnames" not in tables
    assert _version(engine) == "0003"
    assert _schema_drift(engine) == []


def test_pre_1_3_database_is_upgraded_without_losing_data(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    # A database as an older 1.x release left it: no Alembic history, the
    # unused blacklisted_hostnames table, and a column added in a later 1.x.
    with engine.begin() as conn:
        conn.exec_driver_sql(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, username VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL,"
            " phone_number VARCHAR(20) NOT NULL, hashed_password VARCHAR(255) NOT NULL, is_active BOOLEAN NOT NULL,"
            " is_staff BOOLEAN NOT NULL, is_superuser BOOLEAN NOT NULL)"
        )
        conn.exec_driver_sql("CREATE TABLE blacklisted_hostnames (id INTEGER PRIMARY KEY, hostname VARCHAR(255))")
        conn.exec_driver_sql(
            "INSERT INTO users VALUES (1, 'admin', 'admin@example.com', '1', 'hash', 1, 1, 1)"
        )

    run_migrations(engine)

    inspector = inspect(engine)
    assert "token_version" in {col["name"] for col in inspector.get_columns("users")}
    assert "hostnames" in inspector.get_table_names()
    assert "blacklisted_hostnames" not in inspector.get_table_names()
    assert _version(engine) == "0003"
    with engine.connect() as conn:
        assert conn.execute(text("SELECT username, token_version FROM users")).one() == ("admin", 0)

    run_migrations(engine)  # a second start is a no-op
    assert _version(engine) == "0003"
