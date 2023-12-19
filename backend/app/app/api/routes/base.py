from fastapi import APIRouter

from api.routes.v1 import route_login
from api.routes.v1 import route_users
from api.routes.v1 import route_blacklist

api_router: APIRouter = APIRouter()

# APIs 
api_router.include_router(route_users.router, prefix='/v1/users', tags=['users'])
api_router.include_router(route_login.router, prefix='/v1/login', tags=['login'])
api_router.include_router(route_blacklist.router, prefix='/v1/blacklist', tags=['blacklist'])