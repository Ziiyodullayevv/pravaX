from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class UserSubscription(models.Model):
    class Plan(models.TextChoices):
        FREE        = 'free',        'Free'
        PRO_MONTHLY = 'pro_monthly', 'Pro Monthly'
        PRO_YEARLY  = 'pro_yearly',  'Pro Yearly'

    user                  = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='subscription'
    )
    plan                  = models.CharField(max_length=15, choices=Plan.choices, default=Plan.FREE)
    expires_at            = models.DateTimeField(null=True, blank=True)   # None = Free (muddatsiz)
    last_daily_bonus_at   = models.DateField(null=True, blank=True)
    last_monthly_grant_at = models.DateField(null=True, blank=True)
    created_at            = models.DateTimeField(auto_now_add=True)
    updated_at            = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = 'Obuna'
        verbose_name_plural = 'Obunalar'

    @property
    def is_pro(self) -> bool:
        if self.plan == self.Plan.FREE:
            return False
        if self.expires_at is None:
            return False
        return self.expires_at > timezone.now()

    def __str__(self):
        return f'{self.user} — {self.plan}'


class TokenWallet(models.Model):
    user       = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='wallet'
    )
    balance    = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = 'Hamyon'
        verbose_name_plural = 'Hamyonlar'

    def __str__(self):
        return f'{self.user} — {self.balance} token'


class TokenTransaction(models.Model):
    class Reason(models.TextChoices):
        INITIAL_GRANT    = 'initial_grant',    'Boshlang\'ich token'
        DAILY_BONUS      = 'daily_bonus',      'Kunlik bonus'
        MONTHLY_GRANT    = 'monthly_grant',    'Oylik token'
        SUBSCRIPTION     = 'subscription',     'Obuna bonusi'
        CATEGORY_SPEND   = 'category_spend',   'Mavzuli test (sarflash)'
        CATEGORY_REFUND  = 'category_refund',  'Mavzuli test (qaytarish)'
        CATEGORY_BONUS   = 'category_bonus',   'Mavzuli test (bonus)'
        MIXED_SPEND      = 'mixed_spend',      'Aralash test (sarflash)'
        MIXED_REFUND     = 'mixed_refund',     'Aralash test (qaytarish)'
        MIXED_BONUS      = 'mixed_bonus',      'Aralash test (bonus)'
        MARATHON_SPEND   = 'marathon_spend',   'Marafon (sarflash)'
        MARATHON_REFUND  = 'marathon_refund',  'Marafon (qaytarish)'
        MARATHON_BONUS   = 'marathon_bonus',   'Marafon (bonus)'
        EXAM_SPEND       = 'exam_spend',       'Sinov exam (sarflash)'
        EXAM_REFUND      = 'exam_refund',      'Sinov exam (qaytarish)'
        EXAM_BONUS       = 'exam_bonus',       'Sinov exam (bonus)'
        PRACTICE_SPEND   = 'practice_spend',   'Mashq (sarflash)'
        PRACTICE_REFUND  = 'practice_refund',  'Mashq (qaytarish)'
        PRACTICE_BONUS   = 'practice_bonus',   'Mashq (bonus)'
        CONTEST_ENTRY    = 'contest_entry',    'Contest (kirish)'
        CONTEST_PRIZE    = 'contest_prize',    'Contest (sovrin)'
        ADMIN_ADJUST     = 'admin_adjust',     'Admin tomonidan'

    wallet        = models.ForeignKey(TokenWallet, on_delete=models.CASCADE, related_name='transactions')
    amount        = models.IntegerField()
    balance_after = models.PositiveIntegerField()
    reason        = models.CharField(max_length=30, choices=Reason.choices)
    session_id    = models.PositiveIntegerField(null=True, blank=True)
    contest_id    = models.PositiveIntegerField(null=True, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering            = ['-created_at']
        verbose_name        = 'Tranzaksiya'
        verbose_name_plural = 'Tranzaksiyalar'

    def __str__(self):
        sign = '+' if self.amount > 0 else ''
        return f'{self.wallet.user} {sign}{self.amount} ({self.reason})'
