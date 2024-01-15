from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        required=True
    )
    username = serializers.CharField()
    password = serializers.CharField(min_length=8, write_only=True)

    class Meta:
      model = User
      fields = ('username', 'email', 'phone_number', 'password')
      extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
      password = validated_data.pop('password', None)
      instance = self.Meta.model(**validated_data)  # as long as the fields are the same, we can just use this
      if password is not None:
          instance.set_password(password)
      instance.save()
      return instance