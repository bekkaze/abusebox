from pathlib import Path 
from dotenv import load_dotenv 
from os import getenv 

env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path)

class Settings: 
  PROJECT_NAME: str = 'Abusebox'
  PROJECT_VERSION: str = '0.1.0'

  # PARSE 
  DB_URL: str = getenv('DB_URL')

  SECRET_KEY: str = getenv('SECRET_KEY')
  ALGORITHM: str = getenv('ALGORITHM')
  ACCESS_TOKEN_EXPIRE_MINUTES: int = int(getenv('ACCESS_TOKEN_EXPIRE_MINUTES'))

settings = Settings()