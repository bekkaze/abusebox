from db.base_class import Base
from sqlalchemy import Column 
from sqlalchemy import Integer, String, DateTime, Boolean

from datetime import datetime 

class User(Base):
  id = Column(Integer, primary_key=True, index=True)
  username= Column(String, nullable=False, unique=True, index=True)
  email = Column(String, nullable=False, unique=True, index=True)
  hashed_password = Column(String, nullable=False)
  is_superuser = Column(Boolean(), default=False)
  is_active = Column(Boolean(), default=False)
  created = Column(DateTime, default=datetime.utcnow)
  updated = Column(DateTime, onupdate=datetime.utcnow)