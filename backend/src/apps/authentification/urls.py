from django.urls import path
from .views import (
  LogoutView
)

urlpatterns: list = [
  path('logout/', LogoutView.as_view(), name='logoutAPIView')
]