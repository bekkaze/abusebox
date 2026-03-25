from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_redoc_html

from app.api.routers import auth_router, blacklist_router, dmarc_router, hostname_router, tools_router
from app.core.config import settings
from app.db.init_data import seed_default_admin
from app.db.session import Base, SessionLocal, engine
from app.services.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_default_admin(db)
    finally:
        db.close()

    start_scheduler()

    yield

    stop_scheduler()


def create_app() -> FastAPI:
    if not settings.app_debug and settings.app_secret_key == "insecure-dev-secret-key-change-me":
        raise RuntimeError("APP_SECRET_KEY must be set in non-debug environments")

    app = FastAPI(
        title=settings.app_name,
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
    app.include_router(hostname_router)
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
