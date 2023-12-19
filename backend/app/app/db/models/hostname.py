from db.base_class import Base 
from sqlalchemy import Column 
from sqlalchemy import Integer, String, Boolean, ForiegnKey, DateTime

from datetime import datetime 

class Hostname(Base):
  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(Integer, ForiegnKey('user.id'))
  hostname_type = Column(String(6), nullable=False)
  hostname = Column(String(30), nullable=False)
  description = Column(String(100), nullable=True)
  is_alert_enabled = Column(Boolean, default=False)
  is_monitor_enabled = Column(Boolean, default=False)
  status = Column(String(10))
  is_blacklisted = Column(Boolean, default=False) 
  created = Column(DateTime, default=datetime.utcnow)
  updated = Column(DateTime, onupdate=datetime.utcnow)