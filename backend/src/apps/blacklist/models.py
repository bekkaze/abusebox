from django.db import models

# Create your models here.
class BlacklistedHostname(models.Model):
  hostname = models.CharField(max_length=30, null=False)
  reason = models.CharField(max_length=100, null=True)
  is_active = models.BooleanField(default=True)
  created = models.DateTimeField(auto_now_add=True)
  updated = models.DateTimeField(auto_now=True)