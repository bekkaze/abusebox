from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from apps.blacklist.utils.blacklist_check_util import check_dnsbl_providers

""" class CreateUserAPI(APIView):
  permission_classes = (permissions.AllowAny, )

  @swagger_auto_schema(request_body=UserSerializer, operation_description='Create user')
  def post(self, request, format='json'):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
      user = serializer.save()  
      if user: 
        json = serializer.data
        return Response(json, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST) """

class QuickCheckBlacklistAPIView(APIView):
  permission_classes = (permissions.AllowAny,)
  @swagger_auto_schema(
    operation_description="Check if a hostname is blacklisted",
    manual_parameters=[
      openapi.Parameter(
        name="hostname",
        in_=openapi.IN_QUERY,
        type=openapi.TYPE_STRING,
        required=True,
        description="The hostname to be checked against the blacklist",
      ),
    ],
    responses={
      200: "OK - Hostname is checked",
      400: "Bad Request - Please provide a valid hostname",
    },
  )
  def get(self, request):
    hostname = request.GET.get('hostname', None)

    if hostname==None: 
      return Response({'status': 'bad request', 'result': {'msg': 'Please provide a Hostname'}}, status=status.HTTP_400_BAD_REQUEST)

    result: dict = check_dnsbl_providers(hostname)

    return Response(result, status=status.HTTP_200_OK)