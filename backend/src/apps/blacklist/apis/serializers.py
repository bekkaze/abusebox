from rest_framework import serializers
from apps.blacklist.models import BlacklistedHostname

class BlacklistedHostnameSerializer(serializers.ModelSerializer):
  class Meta:
    model = BlacklistedHostname
    fields = ['id', 'hostname', 'reason', 'is_active', 'created', 'updated']
