import logging
import re
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_redoc_html

from app.api.routers import auth_router, blacklist_router, dmarc_router, events_router, hostname_router, settings_router, tools_router
from app.core.config import settings
from app.db.init_data import seed_default_admin
from app.db.migrate import run_migrations
from app.db.session import SessionLocal, engine
from app.services.scheduler import start_scheduler, stop_scheduler

logger = logging.getLogger(__name__)

_FORWARDED_PREFIX = re.compile(r"/[A-Za-z0-9_-]+")


class ForwardedPrefixMiddleware:
    """Honour X-Forwarded-Prefix from the bundled proxy, which serves the API at /api.

    Only the API docs use it: their links and "Try it out" requests then go
    through the proxy. Routing is unchanged, since the proxy strips the prefix.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            for name, value in scope["headers"]:
                if name == b"x-forwarded-prefix":
                    prefix = value.decode("latin-1").rstrip("/")
                    if _FORWARDED_PREFIX.fullmatch(prefix):
                        scope = dict(scope, root_path=prefix)
                    break
        await self.app(scope, receive, send)


@asynccontextmanager
async def lifespan(_: FastAPI):
    run_migrations(engine)

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
        version="1.3.3",
        debug=settings.app_debug,
        docs_url=None if settings.disable_api_docs else "/swagger/",
        openapi_url=None if settings.disable_api_docs else "/openapi.json",
        redoc_url=None,
        lifespan=lifespan,
    )

    app.add_middleware(ForwardedPrefixMiddleware)
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

    if not settings.disable_api_docs:
        @app.get("/redoc/", include_in_schema=False)
        def redoc(request: Request):
            return get_redoc_html(
                openapi_url=request.scope.get("root_path", "") + app.openapi_url,
                title=f"{settings.app_name} - ReDoc",
                redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@2.1.5/bundles/redoc.standalone.js",
            )

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}

    return app


app = create_app()
