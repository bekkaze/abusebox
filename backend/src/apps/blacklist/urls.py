from django.urls import path 
from apps.blacklist.api.routes.blacklist_route import (
  BlacklistAPIView
)

urlpatterns: list = [
  path('', BlacklistAPIView.as_view(), name='BlacklistAPIView'),
]