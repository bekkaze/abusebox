from db.base_class import Base 
from sqlalchemy import Column 
from sqlalchemy import Integer, String, Boolean, ForeignKey, DateTime, JSON

from datetime import datetime 

class Check_history(Base):
  id = Column(Integer, primary_key=True, index=True)
  hostname_id = Column(Integer, ForeignKey('hostname.id'))
  result = Column(JSON, nullable=True)
  status = Column(String(9))
  created = Column(DateTime, default=datetime.utcnow)
  updated = Column(DateTime, onupdate=datetime.utcnow)
  