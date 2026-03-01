from django.db import models
from apps.users.models import User
# Create your models here.

class Hostname(models.Model):
  user = models.ForeignKey(User, on_delete=models.CASCADE)
  hostname_type = models.CharField(max_length=6, null=False)
  hostname = models.CharField(max_length=30, null=False)
  description = models.CharField(max_length=100, null=True)
  is_alert_enabled = models.BooleanField(default=False)
  is_monitor_enabled = models.BooleanField(default=False)
  status = models.CharField(max_length=10)
  is_blacklisted = models.BooleanField(default=False)
  created = models.DateTimeField(auto_now_add=True)
  updated = models.DateTimeField(auto_now=True)

  class Meta:
    ordering = ["-created"]
    indexes = [
      models.Index(fields=["user", "created"]),
      models.Index(fields=["hostname"]),
      models.Index(fields=["status"]),
    ]
    constraints = [
      models.UniqueConstraint(fields=["user", "hostname"], name="unique_hostname_per_user"),
    ]

  def __str__(self):
    return f"{self.hostname_type}:{self.hostname}"

class CheckHistory(models.Model):
  hostname = models.ForeignKey(Hostname, on_delete=models.CASCADE)
  result = models.JSONField(null=True)
  status = models.CharField(max_length=9)
  created = models.DateTimeField(auto_now_add=True)
  updated = models.DateTimeField(auto_now=True)

  class Meta:
    ordering = ["-created"]
    indexes = [
      models.Index(fields=["hostname", "status"]),
      models.Index(fields=["created"]),
    ]

  def __str__(self):
    return f"{self.hostname_id}:{self.status}"
