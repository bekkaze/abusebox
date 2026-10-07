import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_redoc_html
from sqlalchemy import inspect, text

from app.api.routers import auth_router, blacklist_router, dmarc_router, events_router, hostname_router, settings_router, tools_router
from app.core.config import settings
from app.db.init_data import seed_default_admin
from app.db.session import Base, SessionLocal, engine
from app.services.scheduler import start_scheduler, stop_scheduler

logger = logging.getLogger(__name__)


def _apply_schema_migrations(eng) -> None:
    """Add columns that exist in the models but are missing from the database.

    SQLAlchemy's create_all() creates missing tables but won't alter existing
    ones.  This lightweight migration fills that gap for SQLite deployments
    that don't use Alembic.
    """
    inspector = inspect(eng)
    with eng.begin() as conn:
        for table_name, table in Base.metadata.tables.items():
            if not inspector.has_table(table_name):
                continue
            existing = {col["name"] for col in inspector.get_columns(table_name)}
            for col in table.columns:
                if col.name in existing:
                    continue
                col_type = col.type.compile(dialect=eng.dialect)
                default = ""
                if col.default is not None and col.default.is_scalar:
                    arg = col.default.arg
                    literal = int(arg) if isinstance(arg, bool) else arg
                    default = f" DEFAULT {literal!r}"
                # SQLite can only add a NOT NULL column when it has a default
                # to fill existing rows with; otherwise add it as nullable.
                nullable = " NOT NULL" if not col.nullable and default else ""
                stmt = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}{default}{nullable}"
                logger.info("Schema migration: %s", stmt)
                conn.execute(text(stmt))


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    _apply_schema_migrations(engine)

    db = SessionLocal()
    try:
        seed_default_admin(db)
    finally:
        db.close()

    start_scheduler()

    yield

    stop_scheduler()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="1.2.0",
        debug=settings.app_debug,
        docs_url="/swagger/",
        redoc_url=None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router)
    app.include_router(blacklist_router)
    app.include_router(dmarc_router)
    app.include_router(events_router)
    app.include_router(hostname_router)
    app.include_router(settings_router)
    app.include_router(tools_router)

    @app.get("/redoc/", include_in_schema=False)
    def redoc():
        return get_redoc_html(
            openapi_url=app.openapi_url,
            title=f"{settings.app_name} - ReDoc",
            redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@2.1.5/bundles/redoc.standalone.js",
        )

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}

    return app


app = create_app()
