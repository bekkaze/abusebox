from django.urls import path
from .blacklist_check_view import CheckBlacklistAPIView


urlpatterns: list = [
  path('quick-check/', CheckBlacklistAPIView.as_view(), name='quick blacklist check'),
]