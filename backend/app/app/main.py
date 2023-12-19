from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db.base import Base 
from db.session import engine 
from db.utils import check_db_connected, check_db_disconnected
from core.config import settings
from api.routes.base import api_router

origins = [
  'http://localhost:3000', # React app
  'http://localhost:8000', # FastAPI app
]

def include_router(app):
  app.include_router(api_router)

def create_tables():
  Base.metadata.create_all(bind=engine)

def start_application():
  app = FastAPI(
    title = settings.PROJECT_NAME,
    version = settings.PROJECT_VERSION
  )

  include_router(app)
  create_tables()

  app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
  )

  return app 

app = start_application()

@app.on_event('startup')
async def app_startup():
  await check_db_connected()

@app.on_event('shutdown')
async def app_shutdown():
  await check_db_disconnected()