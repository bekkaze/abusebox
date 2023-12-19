from db.models.hostname import Hostname 
from schemas.hostname import HostnameBase
from sqlalchemy.orm import Session 

# CREATE 
def create_new_hostname(hostname: HostnameBase, db: Session) -> Hostname:
  hostname_model: Hostname = Hostname(
    user_id = hostname.user_id,
    hostname_type = hostname.hostname_type,
    hostname = hostname.hostname,
    description = hostname.description,
    is_alert_enabled = hostname.is_alert_enabled,
    is_monitor_enabled = hostname.is_monitor_enabled,
    status = 'open',
    is_blacklisted = hostname.is_blacklisted
  )

  db.add(hostname_model)
  db.commit()
  db.refresh(hostname_model)

  return hostname_model

# GET 
def get_hostname_by_id(hostname_id: int, db: Session) -> Hostname: 
  return db.query(Hostname).filter(Hostname.id==hostname_id).first()