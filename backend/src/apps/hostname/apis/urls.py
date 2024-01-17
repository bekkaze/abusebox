from django.urls import path
from .routes.hostname_view import HostnameListCreateView, HostnameDetailView
from .routes.check_history_view import CheckHistoryDetailView, CheckHistoryListCreateView

urlpatterns: list = [
  path('detail/', HostnameDetailView.as_view(), name='Hostname detial APIView'),
  path('list/', HostnameListCreateView.as_view(), name='Hostname list API View'),

  path('history/detail/', CheckHistoryDetailView.as_view(), name='Hostname check history detial APIView'),
  path('history/list/', CheckHistoryListCreateView.as_view(), name='Hostname check history list API View')
]