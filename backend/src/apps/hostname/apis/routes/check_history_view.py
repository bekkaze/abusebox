from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from apps.hostname.models import CheckHistory
from apps.hostname.apis.serializers import CheckHistorySerializer

class CheckHistoryListCreateView(APIView):
  @swagger_auto_schema(
    operation_description="Get a list of all check histories",
    responses={200: openapi.Response("List of check histories", CheckHistorySerializer(many=True))},
  )
  def get(self, request):
    check_histories = CheckHistory.objects.all()
    serializer = CheckHistorySerializer(check_histories, many=True)
    return Response(serializer.data)

  @swagger_auto_schema(
    operation_description="Create a new check history",
    request_body=CheckHistorySerializer,
    responses={
      201: openapi.Response("New check history created", CheckHistorySerializer()),
      400: "Bad Request - Invalid input data",
    },
  )
  def post(self, request):
    serializer = CheckHistorySerializer(data=request.data)
    if serializer.is_valid():
      serializer.save()
      return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class CheckHistoryDetailView(APIView):
  @swagger_auto_schema(
    operation_description="Get details of a specific check history",
    responses={200: openapi.Response("Details of the check history", CheckHistorySerializer())},
  )
  def get(self, request, pk):
    check_history = get_object_or_404(CheckHistory, pk=pk)
    serializer = CheckHistorySerializer(check_history)
    return Response(serializer.data)

  @swagger_auto_schema(
    operation_description="Update an existing check history",
    request_body=CheckHistorySerializer,
    responses={
      200: openapi.Response("Check history updated", CheckHistorySerializer()),
      400: "Bad Request - Invalid input data",
      404: "Not Found - Check history not found",
    },
  )
  def put(self, request, pk):
    check_history = get_object_or_404(CheckHistory, pk=pk)
    serializer = CheckHistorySerializer(check_history, data=request.data)
    if serializer.is_valid():
      serializer.save()
      return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

  @swagger_auto_schema(
    operation_description="Delete a check history",
    responses={
      204: "No Content - Check history deleted",
      404: "Not Found - Check history not found",
    },
  )
  def delete(self, request, pk):
    check_history = get_object_or_404(CheckHistory, pk=pk)
    check_history.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
