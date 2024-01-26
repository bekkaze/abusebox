from django.shortcuts import get_object_or_404
from django.core.serializers import serialize
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from apps.hostname.models import Hostname
from apps.hostname.apis.serializers import HostnameSerializer
from apps.blacklist.models import BlacklistedHostname
from apps.hostname.models import CheckHistory
import json 

class HostnameListCreateView(APIView):
  @swagger_auto_schema(
    operation_description="Get a list of all hostnames"
  )
  def get(self, request):
    hostnames = Hostname.objects.filter(user=request.user.id).all()
    response_data: list = []

    for hostname in hostnames:
      try:
        check_history_model = CheckHistory.objects.filter(hostname=hostname.id, status='current').get()
        hostname_data = json.loads(serialize('json', [hostname]))[0]['fields']
        hostname_data['result'] = check_history_model.result
        hostname_data['checked'] = check_history_model.created 
        hostname_data['result']['id'] = check_history_model.id
        hostname_data['id'] = hostname.id
        response_data.append(hostname_data)
      except: 
        hostname_data = json.loads(serialize('json', [hostname]))[0]['fields']
        hostname_data['result'] = None
        hostname_data['checked'] = 'Not checked'
        hostname_data['id'] = hostname.id
        response_data.append(hostname_data)
      
    return Response(response_data, status=status.HTTP_200_OK)


class HostnameAPIView(APIView):
  @swagger_auto_schema(
    operation_description="Get details of a specific hostname",
    responses={200: openapi.Response("Details of the hostname", HostnameSerializer())},
  )
  def get(self, request, pk):
    hostname = get_object_or_404(Hostname, pk=pk)
    serializer = HostnameSerializer(hostname)
    return Response(serializer.data)

  @swagger_auto_schema(
      operation_description="Create a new hostname",
      request_body=HostnameSerializer,
      responses={
          201: openapi.Response("New hostname created", HostnameSerializer()),
          400: "Bad Request - Invalid input data",
      },
      exclude=['user', 'status']  # Exclude 'user' and 'status' from the documentation
  )
  def post(self, request):
      post_data = {
          'hostname': request.data.get('hostname'),
          'hostname_type': request.data.get('hostname_type'),
          'description': request.data.get('description'),
          'is_alert_enabled': request.data.get('is_alert_enabled'),
          'is_monitor_enabled': request.data.get('is_monitor_enabled'),
          'status': 'active',
          'user': request.user.id
      }

      serializer = HostnameSerializer(data=post_data)
      serializer.is_valid(raise_exception=True)  # Raises ValidationError if not valid

      serializer.save()
      return Response(serializer.data, status=status.HTTP_201_CREATED)

  @swagger_auto_schema(
    operation_description="Update an existing hostname",
    request_body=HostnameSerializer,
    responses={
      200: openapi.Response("Hostname updated", HostnameSerializer()),
      400: "Bad Request - Invalid input data",
      404: "Not Found - Hostname not found",
    },
  )
  def put(self, request, pk):
    hostname = get_object_or_404(Hostname, pk=pk)
    serializer = HostnameSerializer(hostname, data=request.data)
    if serializer.is_valid():
      serializer.save()
      return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

  @swagger_auto_schema(
    operation_description="Delete a hostname",
    responses={
      204: "No Content - Hostname deleted",
      404: "Not Found - Hostname not found",
    },
  )
  def delete(self, request, pk):
    hostname = get_object_or_404(Hostname, pk=pk)
    hostname.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
