# djsr/authentication/serializers.py
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):

  @classmethod
  def get_token(cls, user):
    token = super(MyTokenObtainPairSerializer, cls).get_token(user)

    token['test'] = 'test'
    return token