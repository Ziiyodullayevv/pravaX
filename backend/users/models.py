import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):

    class Role(models.TextChoices):
        USER = 'user', 'User'
        ADMIN = 'admin', 'Admin'
        SUPPORT = 'support', 'Support'

    class Status(models.TextChoices):
        STANDARD = 'standard', 'Standard'
        PREMIUM = 'premium', 'Premium'

    class AuthSource(models.TextChoices):
        EMAIL = 'email', 'Email'
        TELEGRAM = 'telegram', 'Telegram'

    email = models.EmailField(unique=True, null=True, blank=True)

    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.USER,
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.STANDARD,
    )
    auth_source = models.CharField(
        max_length=10,
        choices=AuthSource.choices,
        default=AuthSource.EMAIL,
    )

    telegram_id = models.BigIntegerField(unique=True, null=True, blank=True)
    phone_number = models.CharField(max_length=20, null=True, blank=True)
    photo_url = models.URLField(max_length=500, null=True, blank=True)

    # Reytingda qatnashuvchi soxta foydalanuvchilar (avtomatik kontestlar uchun)
    is_fake = models.BooleanField(default=False, db_index=True, verbose_name='Soxta foydalanuvchi')

    def save(self, *args, **kwargs):
        if not self.username:
            self.username = str(uuid.uuid4()).replace('-', '')[:16]
        # Bo'sh string email ni NULL ga aylantirish (unique constraint uchun)
        if self.email == '':
            self.email = None
        super().save(*args, **kwargs)

    @property
    def is_premium(self) -> bool:
        return self.status == self.Status.PREMIUM

    def __str__(self):
        return self.email or self.username
