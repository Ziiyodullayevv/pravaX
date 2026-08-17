from datetime import time, timedelta

from celery import shared_task
from django.utils import timezone

from .models import Contest
from .services import add_fake_participants, finalize_contest


# ─── Avtomatik Global Contest sozlamalari ────────────────────────────────────
DAILY_CONTEST = {
    'title':          'Kunlik konkurs',
    'description':    'Har kuni 20:30 da boshlanadi. 15 ta savol, 20 daqiqa.',
    'start_hour':     20,
    'start_minute':   30,
    'duration_min':   20,
    'question_count': 15,
    'entry_token':    5,
}

WEEKLY_CONTEST = {
    'title':          'Haftalik konkurs',
    'description':    'Har yakshanba 21:00 da boshlanadi. 30 ta savol, 20 daqiqa.',
    'start_hour':     21,
    'start_minute':   0,
    'duration_min':   20,
    'question_count': 30,
    'entry_token':    10,
    'weekday':        6,   # 0=Mon, 6=Sun (Python convention)
}


def _make_contest(today, cfg, recurrence: str) -> Contest | None:
    """Belgilangan kun uchun contest yaratadi (idempotent)."""
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(
        timezone.datetime.combine(today, time(cfg['start_hour'], cfg['start_minute'])),
        tz,
    )
    end = start + timedelta(minutes=cfg['duration_min'])

    # Bugungi contest mavjudmi tekshiramiz (start_time = aynan shu daqiqa)
    if Contest.objects.filter(
        contest_type=Contest.Type.GLOBAL,
        recurrence=recurrence,
        start_time=start,
    ).exists():
        return None

    contest = Contest.objects.create(
        title=          cfg['title'],
        description=    cfg['description'],
        contest_type=   Contest.Type.GLOBAL,
        recurrence=     recurrence,
        status=         Contest.Status.UPCOMING,
        start_time=     start,
        end_time=       end,
        entry_token=    cfg['entry_token'],
        question_count= cfg['question_count'],
        time_limit=     cfg['duration_min'],
        question_source=Contest.QuestionSource.CATEGORY,  # categories bo'sh → barcha savollardan
    )
    # Reyting bo'sh ko'rinmasligi uchun 50–100 ta soxta qatnashuvchi qo'shamiz
    add_fake_participants(contest)
    return contest


@shared_task
def create_scheduled_global_contests():
    """Har kuni 00:01 da bugungi kunlik (har kuni) va haftalik (yakshanba) contestlarni yaratadi."""
    today = timezone.localtime().date()
    created = []

    daily = _make_contest(today, DAILY_CONTEST, Contest.Recurrence.DAILY)
    if daily:
        created.append(f'daily#{daily.id}')

    if today.weekday() == WEEKLY_CONTEST['weekday']:
        weekly = _make_contest(today, WEEKLY_CONTEST, Contest.Recurrence.WEEKLY)
        if weekly:
            created.append(f'weekly#{weekly.id}')

    return created or 'nothing-to-create'


@shared_task
def cleanup_expired_academy_memberships():
    """Obuna muddati tugagan userlarning akademiya a'zoligini bekor qiladi.

    Pro user bir oylik obuna doirasida 1 akademiyaga ulangan bo'ladi.
    Obuna tugashi bilan a'zolik avtomatik bekor qilinadi.
    Yangi akademiyaga ulanish uchun obunani yangilashi kerak.
    """
    from django.db.models import Q

    from .models import AcademyMembership

    now = timezone.now()

    # Quyidagi userlar akademiyada qola olmaydi:
    # - subscription yo'q (User'lar uchun yangi yaratilgan)
    # - subscription.plan = free
    # - subscription.expires_at o'tib ketgan (None ham, o'tgan ham)
    qs = AcademyMembership.objects.filter(
        Q(user__subscription__isnull=True)
        | Q(user__subscription__plan='free')
        | Q(user__subscription__expires_at__isnull=True)
        | Q(user__subscription__expires_at__lte=now)
    )

    deleted_count, _ = qs.delete()
    return f'Cleaned {deleted_count} expired memberships'


@shared_task
def transition_contests():
    now = timezone.now()

    Contest.objects.filter(
        status=Contest.Status.UPCOMING,
        start_time__lte=now,
    ).update(status=Contest.Status.ACTIVE)

    to_finish = list(
        Contest.objects.filter(
            status=Contest.Status.ACTIVE,
            end_time__lte=now,
        ).values_list('id', flat=True)
    )
    for contest_id in to_finish:
        finalize_contest_task.delay(contest_id)


@shared_task
def finalize_contest_task(contest_id: int):
    try:
        contest = Contest.objects.get(pk=contest_id)
    except Contest.DoesNotExist:
        return
    finalize_contest(contest)
