from django.urls import path
from .routes.hostname_view import HostnameListCreateView, HostnameAPIView
from .routes.check_history_view import CheckHistoryDetailView, CheckHistoryListCreateView

urlpatterns: list = [
  path('', HostnameAPIView.as_view(), name='Hostname APIView'),
  path('<int:pk>', HostnameAPIView.as_view(), name='Hostname API View'),
  path('list/', HostnameListCreateView.as_view(), name='Hostname list API View'),

  path('history/detail/', CheckHistoryDetailView.as_view(), name='Hostname check history detial APIView'),
  path('history/list/', CheckHistoryListCreateView.as_view(), name='Hostname check history list API View')
]