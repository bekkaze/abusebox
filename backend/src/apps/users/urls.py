from django.urls import path
from .views import CreateUserAPI

urlpatterns = [
  path('create/', CreateUserAPI.as_view(), name="create_user"),
]