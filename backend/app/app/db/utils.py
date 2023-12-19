import databases 
from core.config import settings 

async def check_db_connected(): 
  try: 
    if 'postgres' in settings.DB_URL: 
      database = databases.Database(settings.DB_URL)
      if not database.is_connected: 
        await database.connect() 
        await database.execute('SELECT 1')
    print('[+] Database status: connected')
  except Exception as e: 
    print(f'[-] Database status: problem in connection')
    raise e 

async def check_db_disconnected(): 
  try: 
    if 'postgres' in settings.DB_URL: 
      database = databases.Database(settings.DB_URL)
      if database.is_connected:
        await database.disconnect() 
      print(f'[i] Database status: disconnected!')
  except Exception as e: 
    print(f'[-] Database status: something went wrong, can\'t disconnect')
    raise e 