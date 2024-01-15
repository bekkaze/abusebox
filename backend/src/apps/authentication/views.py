from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from .serializers import MyTokenObtainPairSerializer

class ObtainWithUserData(TokenObtainPairView):
  permission_classes = (permissions.AllowAny,)
  serializer_class = MyTokenObtainPairSerializer

class TestProtectedAPI(APIView):
  def get(self, request):
    return Response(data={'hello': 'world'}, status=status.HTTP_200_OK)