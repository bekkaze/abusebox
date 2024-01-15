from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager

# Create your models here.

class UserManager(BaseUserManager):
  def create_user(self, username, password=None, **extra_fields):
    if not username:
      raise ValueError('The Username field must be set')
    
    user = self.model(username=username, **extra_fields)
    user.set_password(password)
    user.save(using=self._db)
    return user

  def create_superuser(self, username, password=None, **extra_fields):
    extra_fields.setdefault('is_staff', True)
    extra_fields.setdefault('is_superuser', True)
    
    if extra_fields.get('is_staff') is not True:
      raise ValueError('Superuser must have is_staff=True')
    
    if extra_fields.get('is_superuser') is not True:
      raise ValueError('Superuser must have is_superuser=True')
    
    return self.create_user(username, password, **extra_fields)

class User(AbstractBaseUser):
  username = models.CharField(max_length=255, unique=True)
  email = models.EmailField(unique=True)
  phone_number = models.CharField(max_length=8)

  is_active = models.BooleanField(default=True)
  is_staff = models.BooleanField(default=False)
  is_superuser = models.BooleanField(default=False)
  
  USERNAME_FIELD = 'username'
  REQUIRED_FIELDS = ['email', 'phone_number',]
  
  objects = UserManager()
  
  def __str__(self):
    return f'{self.first_name} {self.last_name}'

  def has_module_perms(self, app_label):
    return True
  def has_perm(self, perm, obj=None):
    return True