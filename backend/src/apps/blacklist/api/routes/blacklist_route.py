from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status 

from rest_framework.permissions import IsAuthenticated

import pydnsbl 
import re

from apps.blacklist.api.utils.delist_util import barracudacentral
from apps.blacklist.models import DelistRequests

class BlacklistAPIView(APIView):
  #permission_classes = (IsAuthenticated, )

  def get(self, request, *args, **kwargs) -> Response:
    target: str = request.query_params.get('target')

    if re.match("^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$", target):
      checker = pydnsbl.DNSBLIpChecker()
    elif re.match("^(((([A-Za-z0-9]+){1,63}\.)|(([A-Za-z0-9]+(\-)+[A-Za-z0-9]+){1,63}\.))+){1,255}$", target):
      checker = pydnsbl.DNSBLDomainChecker()
    else: 
      return Response({}, status=status.HTTP_400_BAD_REQUEST)

    result = checker.check(target)

    providers: list = [_.host for _ in result.providers]

    delist_requests: list = {}
    try:
      delist_request_model = DelistRequests.objects.filter(hostname=target).get()
      for k, v in delist_request_model.delist_requests.items():
        delist_requests[k] = v
    except DelistRequests.DoesNotExist:
      print('Does not exist')


    return Response({
        'msg': 'success',
        'result': {
          'detected': result.detected_by,
          'providers': providers,
          'delist_requests': delist_requests
        }
      }
      , status=status.HTTP_200_OK)
  
  def post(self, request, *args, **kwargs) -> Response: 
    target: str = request.data.get('target')
    provider: str = request.data.get('provider')

    delist_requests: dict = {}

    if 'barracudacentral' in provider:
      chck, confirmation_number = barracudacentral(target=target)
      if chck:
        msg: str = f'Request sent, confirmation code: {confirmation_number}'
        delist_requests[provider] = {'status': 'sent', 'confirmation_number': confirmation_number}

    delist_request_model: DelistRequests = DelistRequests(
      hostname=target,
      delist_requests=delist_requests,
      status='processing'
    )
    delist_request_model.save()

    return Response({
      'provider': delist_requests,
      'msg': msg
    }, status=status.HTTP_200_OK)
  