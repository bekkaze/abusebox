from django.urls import path 

from apps.abusebox.api.routes.ipaddress import (
  IPAddressAPIView
)

urlpatterns: list = [
  path('ipaddress/', IPAddressAPIView.as_view(), name='IpAddresssAPIView')
]