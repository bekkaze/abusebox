from django.db import models
from django.db.models import JSONField
from datetime import datetime

# Create your models here.

class DelistRequests(models.Model):
  id = models.AutoField(primary_key=True)
  hostname = models.CharField(max_length=30)
  delist_requests = models.JSONField(blank=True, null=True)
  status = models.CharField(max_length=12)
  created = models.DateTimeField(default=datetime.utcnow)
  updated = models.DateTimeField(auto_now=True)