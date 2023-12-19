from pydantic import BaseModel
from pydantic import Field
from pydantic import EmailStr

class UserCreate(BaseModel):
  username: str 
  email: EmailStr
  password: str 

class ShowUser(BaseModel):
  username: str 
  email: EmailStr
  is_active: bool

  class Config: 
    orm_mode = True 