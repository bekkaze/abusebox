from db.models.check_history import Check_history
from schemas.check_history import Check_historyCreate
from sqlalchemy.orm import Session 

# CREATE 
def create_new_check_history(check_history: Check_historyCreate, db: Session) -> Check_history:
  check_history_model: Check_history = Check_history(
    hostname_id =  check_history.hostname_id,
    result=check_history.result,
    status='lastcheck',
  )

  db.add(check_history_model)
  db.commit()
  db.refresh(check_history_model)
  
  return check_history_model

# GET 
def get_check_history_by_id(check_history_id: int, db: Session) -> Check_history: 
  return db.query(Check_history).filter(Check_history.id==check_history_id).first()