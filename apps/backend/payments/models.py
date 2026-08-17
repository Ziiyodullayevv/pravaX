import secrets
import string

from django.conf import settings
from django.db import models


def _gen_payload_token(length=12):
    alphabet = string.ascii_uppercase + string.digits
    return 'PAY_' + ''.join(secrets.choice(alphabet) for _ in range(length))


class PaymentAdmin(models.Model):
    """To'lovlarni tasdiqlovchi adminlar (admin bot orqali)."""
    telegram_id = models.BigIntegerField(unique=True, verbose_name='Telegram ID')
    name        = models.CharField(max_length=200, verbose_name='Ism')
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name        = 'To\'lov admini'
        verbose_name_plural = 'To\'lov adminlari'
        ordering            = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.telegram_id})'


class Payment(models.Model):
    class Status(models.TextChoices):
        INITIATED = 'initiated', 'Yaratildi'
        AWAITING  = 'awaiting',  'Fayl kutilmoqda'
        PENDING   = 'pending',   'Tasdiqlash kutilmoqda'
        APPROVED  = 'approved',  'Tasdiqlandi'
        REJECTED  = 'rejected',  'Bekor qilindi'

    class Plan(models.TextChoices):
        MONTHLY = 'pro_monthly', 'Pro Monthly'
        YEARLY  = 'pro_yearly',  'Pro Yearly'

    user        = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='payments',
    )
    plan        = models.CharField(max_length=15, choices=Plan.choices)
    amount_som  = models.DecimalField(max_digits=10, decimal_places=2)
    status      = models.CharField(max_length=15, choices=Status.choices, default=Status.INITIATED)

    payload_token = models.CharField(max_length=24, unique=True, blank=True)
    user_chat_id  = models.BigIntegerField(null=True, blank=True)

    file             = models.FileField(upload_to='payments/%Y/%m/', null=True, blank=True)
    file_telegram_id = models.CharField(max_length=255, blank=True)
    file_kind        = models.CharField(max_length=20, blank=True, help_text='photo / document')

    processed_by     = models.ForeignKey(
        PaymentAdmin,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='processed_payments',
    )
    processed_at     = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering            = ['-created_at']
        verbose_name        = 'To\'lov'
        verbose_name_plural = 'To\'lovlar'
        indexes             = [
            models.Index(fields=['status']),
            models.Index(fields=['user', '-created_at']),
        ]

    def save(self, *args, **kwargs):
        if not self.payload_token:
            self.payload_token = self._unique_token()
        super().save(*args, **kwargs)

    @staticmethod
    def _unique_token():
        token = _gen_payload_token()
        while Payment.objects.filter(payload_token=token).exists():
            token = _gen_payload_token()
        return token

    def __str__(self):
        return f'#{self.id} {self.user} — {self.plan} — {self.status}'
