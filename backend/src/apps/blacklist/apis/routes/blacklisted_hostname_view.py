from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView

from django.shortcuts import get_object_or_404

from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from apps.blacklist.models import BlacklistedHostname
from apps.blacklist.apis.serializers import BlacklistedHostnameSerializer

class BlacklistedHostnameAPIView(APIView):
  @swagger_auto_schema(
    operation_description="Get a list of all blacklisted hostnames",
    responses={
      200: openapi.Response("List of blacklisted hostnames", BlacklistedHostnameSerializer(many=True)),
    },
  )
  def get(self, request): 
    blacklisted_hostnames = BlacklistedHostname.objects.all()
    serializer = BlacklistedHostnameSerializer(BlacklistedHostname, many=True)
    return Response(serializer.data)

  @swagger_auto_schema(
    operation_description="Create a new blacklisted hostname",
    request_body=BlacklistedHostnameSerializer,
    responses={
      201: openapi.Response("New blacklisted hostname created", BlacklistedHostnameSerializer()),
      400: "Bad Request - Invalid input data",
    },
  )
  def post(self, request):
    serializer = BlacklistedHostnameSerializer(data=request.data)
    if serializer.is_valid(): 
      return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

  @swagger_auto_schema(
    operation_description="Update an existing blacklisted hostname",
    request_body=BlacklistedHostnameSerializer,
    manual_parameters=[
      openapi.Parameter(
        name="pk",
        in_=openapi.IN_PATH,
        type=openapi.TYPE_INTEGER,
        description="ID of the blacklisted hostname to be updated",
      ),
    ],
    responses={
      200: openapi.Response("Blacklisted hostname updated", BlacklistedHostnameSerializer()),
      400: "Bad Request - Invalid input data",
      404: "Not Found - Blacklisted hostname not found",
    },
  )
  def put(self, request, pk):
    blacklisted_hostname = get_object_or_404(BlacklistedHostname, pk=pk)
    serializer = BlacklistedHostnameSerializer(blacklisted_hostname, data=request.data)
    if serializer.is_valid():
      serializer.save()
      return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

  @swagger_auto_schema(
    operation_description="Delete a blacklisted hostname",
    manual_parameters=[
      openapi.Parameter(
        name="pk",
        in_=openapi.IN_PATH,
        type=openapi.TYPE_INTEGER,
        description="ID of the blacklisted hostname to be deleted",
      ),
    ],
    responses={
      204: "No Content - Blacklisted hostname deleted",
      404: "Not Found - Blacklisted hostname not found",
    },
  )
  def delete(self, request, pk):
    blacklisted_hostname = get_object_or_404(BlacklistedHostname, pk=pk)
    blacklisted_hostname.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

  