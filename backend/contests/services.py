import random
from datetime import timedelta

from django.db import transaction
from django.db.models import F, Window
from django.db.models.functions import Rank

from .models import Contest, ContestAnswer, ContestParticipant
from quiz.models import Question


def add_fake_participants(contest: Contest, min_count: int = 50, max_count: int = 100) -> int:
    """Contest reytingiga 50–100 ta soxta qatnashuvchi qo'shadi.

    Soxta foydalanuvchilar (`User.is_fake=True`) o'zbekcha ismlarda yaratilgan bo'ladi.
    Ularning natijalari:
      - correct_count: random, lekin maks 18 yoki contest savol soni - 2
      - duration_secs: 60s dan time_limit*60 gacha (random)
      - is_submitted=True

    Idempotent: agar contest'da allaqachon soxta qatnashuvchilar bo'lsa, qaytarib qo'shmaydi.
    Returns: yaratilgan ContestParticipant'lar soni.
    """
    from users.models import User

    if ContestParticipant.objects.filter(contest=contest, user__is_fake=True).exists():
        return 0  # idempotent

    n = random.randint(min_count, max_count)
    fake_users = list(User.objects.filter(is_fake=True).order_by('?')[:n])
    if not fake_users:
        return 0

    q_total      = max(1, contest.question_count)
    max_correct  = min(18, q_total - 2) if q_total >= 4 else q_total - 1
    min_correct  = max(0, int(q_total * 0.2))   # eng kam: 20% to'g'ri
    duration_max = max(60, contest.time_limit * 60)

    participants = []
    for u in fake_users:
        correct = random.randint(min_correct, max_correct)
        wrong   = q_total - correct
        dur     = random.randint(60, duration_max)
        joined  = contest.start_time
        finished = joined + timedelta(seconds=dur)

        participants.append(ContestParticipant(
            contest=       contest,
            user=          u,
            joined_at=     joined,
            token_spent=   0,
            correct_count= correct,
            wrong_count=   wrong,
            duration_secs= dur,
            finished_at=   finished,
            is_submitted=  True,
        ))

    ContestParticipant.objects.bulk_create(participants, batch_size=100, ignore_conflicts=True)
    return len(participants)


def get_contest_questions(contest: Contest) -> list:
    """Contest uchun savollar ro'yxatini qaytaradi.

    - `CUSTOM` → admin qo'lda tanlagan savollar
    - `CATEGORY` + categories tanlangan → shu kategoriyalardan random
    - `CATEGORY` + categories bo'sh → barcha aktiv savollardan random (avtomatik global contestlar)
    """
    if contest.question_source == Contest.QuestionSource.CUSTOM:
        ids = list(contest.questions.filter(is_active=True).values_list('id', flat=True))
    else:
        cat_ids = list(contest.categories.values_list('id', flat=True))
        qs = Question.objects.filter(is_active=True)
        if cat_ids:
            qs = qs.filter(category_id__in=cat_ids)
        ids = list(qs.values_list('id', flat=True))

    count = min(contest.question_count, len(ids))
    return random.sample(ids, count) if len(ids) > count else ids


def compute_ranking(contest_id: int):
    return (
        ContestParticipant.objects
        .filter(contest_id=contest_id, is_submitted=True)
        .select_related('user')
        .select_related('user__academy_membership__academy')
        .annotate(
            computed_rank=Window(
                expression=Rank(),
                order_by=[
                    F('correct_count').desc(),
                    F('wrong_count').asc(),
                    F('duration_secs').asc(),
                ],
            )
        )
        .order_by('computed_rank')
    )


@transaction.atomic
def finalize_contest(contest: Contest) -> None:
    contest = Contest.objects.select_for_update().get(pk=contest.pk)
    if contest.status == Contest.Status.FINISHED:
        return  # idempotent

    participants = list(compute_ranking(contest.id))
    for p in participants:
        p.rank = p.computed_rank
    if participants:
        ContestParticipant.objects.bulk_update(participants, ['rank'])

    from tokens.services import TokenService
    TokenService.apply_contest_prizes(contest)

    contest.status = Contest.Status.FINISHED
    contest.save(update_fields=['status'])
