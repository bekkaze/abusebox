from rest_framework import serializers 
from apps.hostname.models import Hostname
from apps.hostname.models import CheckHistory

class HostnameSerializer(serializers.ModelSerializer):
  class Meta:
    model = Hostname
    fields = '__all__'

class CheckHistorySerializer(serializers.ModelSerializer):
  class Meta:
    model = CheckHistory
    fields = '__all__'