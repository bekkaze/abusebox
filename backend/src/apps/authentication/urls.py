from django.urls import path
from rest_framework_simplejwt import views as jwt_views
from .views import ObtainWithUserData, TestProtectedAPI

urlpatterns = [
  path('login/', ObtainWithUserData.as_view(), name='token_obtain_pair'), 
  path('token/refresh/', jwt_views.TokenRefreshView.as_view(), name='token_refresh'),
  path('test/', TestProtectedAPI.as_view(), name='test'),
]
