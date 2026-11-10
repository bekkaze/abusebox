from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

_is_sqlite = settings.database_url.startswith("sqlite")

# check_same_thread: the scheduler's worker threads share this engine.
connect_args = {"check_same_thread": False} if _is_sqlite else {}
engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


if _is_sqlite:

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _connection_record):
        """Make SQLite survive concurrent access.

        The scheduler saves check results from a worker thread while the API is
        serving requests on others. In SQLite's default rollback journal a
        writer blocks every reader for the length of its transaction, and a
        reader blocks the writer, so the two collide as soon as a check cycle
        overlaps a page load and one of them loses with "database is locked".

        WAL lets readers carry on through a write, which removes the common
        case. busy_timeout covers the rest: a connection that still finds the
        database locked waits rather than failing immediately, which is what
        the default of 0 does.

        synchronous=NORMAL is the usual pairing with WAL. It gives up durability
        only for the last transactions before an OS-level crash, not for a
        process crash, which is the right trade for check history that is
        re-derivable by running the checks again.
        """
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=10000")
            cursor.execute("PRAGMA synchronous=NORMAL")
            # Off by default in SQLite, and the models declare ON DELETE CASCADE
            # that silently does nothing without it.
            cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
