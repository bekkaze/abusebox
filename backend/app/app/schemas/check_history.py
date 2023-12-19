from pydantic import BaseModel 
from pydantic import Field 
from typing import Optional, Dict

class Check_historyBase(BaseModel):
  hostname_id: int 
  result: Dict 
  status: Optional[str]

class Check_historyCreate(Check_historyBase):
  is_quick_check: bool

class ShowCheck_history(Check_historyBase):
  class Config:
    orm_mode = True 