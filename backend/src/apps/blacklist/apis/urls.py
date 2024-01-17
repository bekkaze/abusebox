from django.urls import path
from .routes.blacklist_check_view import QuickCheckBlacklistAPIView
from .routes.blacklisted_hostname_view import BlacklistedHostnameAPIView


urlpatterns: list = [
  path('quick-check/', QuickCheckBlacklistAPIView.as_view(), name='quick blacklist check'),
  path('blacklisted-hostname/', BlacklistedHostnameAPIView.as_view(), name='BlacklistedHostname API View')
]