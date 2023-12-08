from fastapi import APIRouter 
from fastapi import Depends 
from fastapi import status 
from fastapi import Response 
from sqlalchemy.orm import Session
from api.utils.blacklist_check_utils import check_dnsbl_providers
import json 

router = APIRouter()

@router.get('/check')
def check_blacklist(hostname: str):
  result = check_dnsbl_providers(hostname)
  serializable_result = json.dumps(result)

  return Response(content=serializable_result, status_code=200, media_type="application/json")