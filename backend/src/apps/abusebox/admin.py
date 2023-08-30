from django.contrib import admin

from .models import IPAddress
from .models import UserProfile

# Register your models here.

admin.site.register(IPAddress)
admin.site.register(UserProfile)