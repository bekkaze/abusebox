from pydantic import BaseModel 
from pydantic import Field 
from typing import Optional 

class HostnameBase(BaseModel):
  user_id: int 
  hostname_type: Optional[str] = Field(max_length=6) 
  hostname: Optional[str] = Field(max_length=30)
  description: Optional[str] = Field(max_length=100)
  is_alert_enabled: bool 
  is_monitor_enabled: bool 
  status: Optional[str] = Field(max_length=10)
  is_blacklisted: bool 

class ShowHostname(HostnameBase):
  class Config:
    orm_mode: bool = True