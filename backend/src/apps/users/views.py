from django.shortcuts import render
from django.views.generic.edit import CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy
from django.contrib.auth.mixins import LoginRequiredMixin
from .models import User

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_yasg.utils import swagger_auto_schema
from .serializers import UserSerializer

# Create your views here.

# FOR DJANGO ADMIN
class CreateUser(LoginRequiredMixin, CreateView):
  model = User
  fields = ['username', 'email', 'phone_number', 'password']
  template_name = 'create_user.html'
  success_url = reverse_lazy('user_list')

class UpdateUser(LoginRequiredMixin, UpdateView):
  model = User
  fields = ['username', 'email', 'phone_number', 'password']
  template_name = 'update_user.html'
  success_url = reverse_lazy('user_list')

class DeleteUser(LoginRequiredMixin, DeleteView):
  model = User
  template_name = 'delete_user.html'
  success_url = reverse_lazy('user_list')

def user_list(request):
  users = User.objects.all()
  return render(request, 'user_list.html', {'users': users})

# FOR API
class CreateUserAPI(APIView):
  permission_classes = (permissions.AllowAny, )

  @swagger_auto_schema(request_body=UserSerializer, operation_description='Create user')
  def post(self, request, format='json'):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
      user = serializer.save()  
      if user: 
        json = serializer.data
        return Response(json, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)