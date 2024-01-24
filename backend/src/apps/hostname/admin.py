from django.contrib import admin
from .models import Hostname, CheckHistory

# Register your models here.

admin.site.register(Hostname)
admin.site.register(CheckHistory)