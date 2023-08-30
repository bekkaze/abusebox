from django.db import models
from django.db.models import JSONField
from django.contrib.auth.models import User
from datetime import datetime

class IPAddress(models.Model):
  id = models.AutoField(primary_key=True)
  ipaddress = models.CharField(max_length=15, unique=True)
  subnet = models.CharField(max_length=2)
  description = models.CharField(max_length=100, blank=True, null=True)
  userid = models.ForeignKey(User, on_delete=models.CASCADE)
  blacklists = models.JSONField(blank=True, null=True)
  status = models.CharField(max_length=12)
  created = models.DateTimeField(default=datetime.utcnow)
  updated = models.DateTimeField(auto_now=True)

class UserProfile(models.Model):
  id = models.AutoField(primary_key=True)
  userid = models.ForeignKey(User, on_delete=models.CASCADE)
  license = JSONField()
  created = models.DateTimeField(default=datetime.utcnow)
  updated = models.DateTimeField(auto_now=True)

  def __str__(self):
    return f'{self.userid}: {self.license}'