from rest_framework.views import APIView 
from rest_framework.response import Response 
from rest_framework import status 

from apps.abusebox.models import IPAddress
from apps.abusebox.api.utils.serializers import IPAddressSerializer

class IPAddressAPIView(APIView):
  def get(self, request, *args, **kwargs) -> Response:
    ip_id: int = request.query_params.get('ip_id')
    try: 
      ipaddress = IPAddress.objects.get(id=ip_id)
    except IPAddress.DoesNotExist:
      return Response({'msg': 'IPAddress not found'}, status=status.HTTP_404_NOT_FOUND)
  
  def post(self, request, *args, **kwargs) -> Response:
    ip: dict = {
      'ipaddress': request.data['ipaddress'],
      'subnet': request.data['subnet'],
      'description': request.data['description'],
      'blacklists': request.data['blacklists'],
      'userid': request.data['userid'],
      'status': request.data['status'] # GET USER ID FROM LOGIN USER TODO
    }

    serializer = IPAddressSerializer(data=ip)
    if serializer.is_valid():
      serializer.save() 
      return Response(serializer.data, status=status.HTTP_201_CREATED)
    else:
      return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)