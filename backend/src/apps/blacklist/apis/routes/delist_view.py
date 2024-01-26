from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from apps.hostname.models import CheckHistory, Hostname
from apps.blacklist.utils.delist_util import barracudacentral
from apps.users.models import User

lang = input("What's the programming language you want to learn? ")

match lang:
    case "JavaScript":
        print("You can become a web developer.")
    case "Python":
        print("You can become a Data Scientist")
    case "PHP":
        print("You can become a backend developer")
    case "Solidity":
        print("You can become a Blockchain developer")
    case "Java":
        print("You can become a mobile app developer")
    case _:
        print("The language doesn't matter, what matters is solving problems.")


class DelistAPIView(APIView):
  @swagger_auto_schema(
      operation_description="Post delisting data",
      request_body=openapi.Schema(
          type=openapi.TYPE_OBJECT,
          properties={
              'provider': openapi.Schema(type=openapi.TYPE_STRING, description="Provider"),
              'delist_required_data': openapi.Schema(type=openapi.TYPE_OBJECT, description="Delist required data")
          },
          required=["provider", "delist_required_data"]
      ),
      responses={
          200: openapi.Response('Successful operation'),
          400: openapi.Response('Bad Request'),
          500: openapi.Response('Internal Server Error')
      },
      tags=['Delist API View']
  )
  def post(self, request):
    provider: str = request.data['provider']
    delist_required_data: dict = request.data['delist_required_data']
    check_history_model = CheckHistory.objects.filter(id=delist_required_data['id']).get()
    hostname_model = Hostname.objects.filter(id=check_history_model.hostname.id).get()
    user_model = User.objects.filter(id=hostname_model.user.id).get()

    match provider:
      case 'b.barracudacentral.org': #'spam.dnsbl.sorbs.net':#
        chck, result = barracudacentral(
          check_history_model.hostname,
          user_model.phone_number,
          user_model.email,
          delist_required_data['comment']
        )

        check_history_model_result: dict = check_history_model.result
        for history_detected_provider in check_history_model_result['detected_on']:
          if history_detected_provider['provider'] == provider: # 'spam.dnsbl.sorbs.net':
            history_detected_provider['status'] = 'closed'
            history_detected_provider['response'] = result
        
        check_history_model.result = check_history_model_result
        check_history_model.save()

    return Response(check_history_model_result, status=status.HTTP_200_OK)