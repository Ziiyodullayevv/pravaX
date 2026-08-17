import secrets
import string
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from quiz.models import Category, Choice, Question


def _gen_key(length=8):
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def _gen_invite_code():
    year = timezone.now().year
    suffix = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    return f'PRAVA-{year}-{suffix}'


class AcademyProfile(models.Model):
    """Akademiya admin profili — User modelidan mustaqil, o'z username/password'iga ega."""
    username    = models.CharField(max_length=64, unique=True, verbose_name='Username')
    password    = models.CharField(max_length=128, verbose_name='Parol (hash)')
    fullname    = models.CharField(max_length=200, verbose_name='F.I.Sh')
    email       = models.EmailField(blank=True, verbose_name='Email')

    name        = models.CharField(max_length=200, verbose_name='Akademiya nomi')
    phone       = models.CharField(max_length=20, blank=True, verbose_name='Telefon')
    invite_code = models.CharField(max_length=20, unique=True, blank=True, verbose_name='Taklif kodi')
    balance     = models.DecimalField(
        max_digits=12, decimal_places=2,
        default=Decimal('0'),
        verbose_name='Balans (so\'m)',
    )
    is_active   = models.BooleanField(default=True)
    last_login  = models.DateTimeField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name        = 'Akademiya profili'
        verbose_name_plural = 'Akademiya profillari'

    # ─── Password ─────────────────────────────────────────────────────────────
    def set_password(self, raw_password: str):
        from django.contrib.auth.hashers import make_password
        self.password = make_password(raw_password)

    def check_password(self, raw_password: str) -> bool:
        from django.contrib.auth.hashers import check_password
        return check_password(raw_password, self.password)

    # ─── DRF auth compatibility ───────────────────────────────────────────────
    @property
    def is_authenticated(self) -> bool:
        return True

    @property
    def is_anonymous(self) -> bool:
        return False

    @property
    def is_academy(self) -> bool:
        return True

    # User-likeligi uchun (request.user kontekstida xato bo'lmasin)
    @property
    def is_superuser(self) -> bool:
        return False

    @property
    def is_staff(self) -> bool:
        return False

    def save(self, *args, **kwargs):
        if not self.invite_code:
            self.invite_code = self._unique_invite_code()
        super().save(*args, **kwargs)

    @staticmethod
    def _unique_invite_code():
        code = _gen_invite_code()
        while AcademyProfile.objects.filter(invite_code=code).exists():
            code = _gen_invite_code()
        return code

    def __str__(self):
        return f'{self.name} ({self.username})'


class AcademyMembership(models.Model):
    """Pro foydalanuvchi invite_code orqali academyga qo'shiladi.

    Bir user faqat bitta akademiyada a'zo bo'la oladi (`user` OneToOneField).
    Sabab: revenue share (30%) aniq bitta akademiyaga ajratilishi kerak.
    """
    user      = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='academy_membership',
    )
    academy   = models.ForeignKey(
        AcademyProfile,
        on_delete=models.CASCADE,
        related_name='members',
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering            = ['-joined_at']
        verbose_name        = 'Akademiya a\'zosi'
        verbose_name_plural = 'Akademiya a\'zolari'

    @property
    def is_active(self):
        sub = getattr(self.user, 'subscription', None)
        return sub is not None and sub.is_pro

    def __str__(self):
        return f'{self.user} → {self.academy.name}'


class AcademyIncomeRecord(models.Model):
    """Academy balansiga tushadigan har bir to'lov yozuvi."""
    academy    = models.ForeignKey(
        AcademyProfile,
        on_delete=models.CASCADE,
        related_name='income_records',
    )
    user       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='academy_payments',
    )
    plan       = models.CharField(max_length=15, verbose_name='Plan')
    amount_som = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Summa (so\'m)')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering            = ['-created_at']
        verbose_name        = 'Daromad yozuvi'
        verbose_name_plural = 'Daromad yozuvlari'

    def __str__(self):
        return f'{self.academy.name} +{self.amount_som} so\'m ({self.plan})'


class Contest(models.Model):
    class Type(models.TextChoices):
        GLOBAL  = 'global',  'Global'
        ACADEMY = 'academy', 'Akademiya'

    class Recurrence(models.TextChoices):
        NONE   = 'none',   'Bir martalik'
        DAILY  = 'daily',  'Kunlik'
        WEEKLY = 'weekly', 'Haftalik'

    class Status(models.TextChoices):
        UPCOMING = 'upcoming', 'Kutilmoqda'
        ACTIVE   = 'active',   'Faol'
        FINISHED = 'finished', 'Tugagan'

    class QuestionSource(models.TextChoices):
        CUSTOM   = 'custom',   'Qo\'lda tanlangan'
        CATEGORY = 'category', 'Kategoriya asosida'

    title          = models.CharField(max_length=200)
    description    = models.TextField(blank=True)
    contest_type   = models.CharField(max_length=10, choices=Type.choices, default=Type.GLOBAL)
    recurrence     = models.CharField(max_length=10, choices=Recurrence.choices, default=Recurrence.NONE)
    status         = models.CharField(max_length=10, choices=Status.choices, default=Status.UPCOMING)

    start_time     = models.DateTimeField()
    end_time       = models.DateTimeField()

    entry_token    = models.PositiveIntegerField(default=0)
    question_count = models.PositiveIntegerField(default=20)
    time_limit     = models.PositiveIntegerField(default=20)

    question_source  = models.CharField(max_length=10, choices=QuestionSource.choices, default=QuestionSource.CATEGORY)
    categories       = models.ManyToManyField(Category, blank=True)
    questions        = models.ManyToManyField(Question, blank=True)

    academy_profile  = models.ForeignKey(
        AcademyProfile,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='contests',
    )
    access_key       = models.CharField(max_length=8, unique=True, null=True, blank=True, verbose_name='Kirish kaliti')

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_contests',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering            = ['-start_time']
        verbose_name        = 'Contest'
        verbose_name_plural = 'Contestlar'

    def save(self, *args, **kwargs):
        if self.contest_type == self.Type.ACADEMY and not self.access_key:
            self.access_key = self._unique_access_key()
        super().save(*args, **kwargs)

    @staticmethod
    def _unique_access_key():
        key = _gen_key()
        while Contest.objects.filter(access_key=key).exists():
            key = _gen_key()
        return key

    def __str__(self):
        return self.title


class ContestParticipant(models.Model):
    contest     = models.ForeignKey(Contest, on_delete=models.CASCADE, related_name='participants')
    user        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='contest_entries')
    joined_at   = models.DateTimeField(auto_now_add=True)
    token_spent = models.PositiveIntegerField(default=0)

    correct_count  = models.PositiveIntegerField(default=0)
    wrong_count    = models.PositiveIntegerField(default=0)
    finished_at    = models.DateTimeField(null=True, blank=True)
    duration_secs  = models.PositiveIntegerField(null=True, blank=True)
    is_submitted   = models.BooleanField(default=False)
    rank           = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        unique_together     = ['contest', 'user']
        ordering            = ['rank', '-correct_count']
        verbose_name        = 'Qatnashuvchi'
        verbose_name_plural = 'Qatnashuvchilar'

    def __str__(self):
        return f'{self.user} — {self.contest}'


class ContestAnswer(models.Model):
    participant     = models.ForeignKey(ContestParticipant, on_delete=models.CASCADE, related_name='answers')
    question        = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_choice = models.ForeignKey(Choice, on_delete=models.SET_NULL, null=True, blank=True)
    is_correct      = models.BooleanField(null=True, blank=True)
    answered_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together     = ['participant', 'question']
        verbose_name        = 'Javob'
        verbose_name_plural = 'Javoblar'

    def __str__(self):
        return f'{self.participant} — savol #{self.question_id}'
