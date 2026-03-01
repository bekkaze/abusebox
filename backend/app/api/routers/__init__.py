from app.api.routers.auth import router as auth_router
from app.api.routers.blacklist import router as blacklist_router
from app.api.routers.hostname import router as hostname_router

__all__ = ["auth_router", "blacklist_router", "hostname_router"]
