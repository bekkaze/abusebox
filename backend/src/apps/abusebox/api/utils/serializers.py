from rest_framework import serializers
from apps.abusebox.models import IPAddress

class IPAddressSerializer(serializers.ModelSerializer):
  class Meta: 
    model = IPAddress
    fields = (
      'ipaddress',
      'subnet',
      'description',
      'userid',
      'blacklists',
      'status'
    )