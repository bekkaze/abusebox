from core.hashing import Hasher
from db.models.users import User 
from schemas.users import UserCreate
from sqlalchemy.orm import Session 

# CREATE 
def create_new_user(user: UserCreate, db: Session) -> User: 
  user: User = User(
    username = user.username,
    email = user.email, 
    hashed_password = Hasher.get_password_hash(user.password),
    is_active = True, 
    is_superuser = False 
  )

  db.add(user)
  db.commit()
  db.refresh(user)

  return user 

# GET 
def get_user_by_email(email: str, db: Session):
  return db.query(User).filter(User.email==email).first() 