from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .constants import (
    BONUSES, CONTEST_PRIZES, CONTEST_TOP10_PRIZE,
    EXAM_MAX_MISTAKES, PLAN_CONFIG, REFUND_THRESHOLD,
)
from .models import TokenTransaction, TokenWallet, UserSubscription

ACADEMY_REVENUE_SHARE = Decimal('0.30')


class InsufficientBalanceError(Exception):
    pass


@transaction.atomic
def credit_academy_revenue(academy, user, plan_key: str) -> 'AcademyIncomeRecord | None':
    """Akademiya balansiga shu user'ning Pro to'lovidan 30% qo'shadi.

    Tekshiruv:
      - Plan haqiqatda Pro (free emas)
      - Plan price > 0
      - Academy aktiv (is_active=True)

    Returns AcademyIncomeRecord yoki None.
    """
    from contests.models import AcademyIncomeRecord

    config = PLAN_CONFIG.get(plan_key)
    if not config or plan_key == 'free':
        return None

    price = Decimal(config.get('price', 0))
    if price <= 0:
        return None

    if not academy.is_active:
        return None

    share = (price * ACADEMY_REVENUE_SHARE).quantize(Decimal('0.01'))
    academy.balance = (academy.balance or Decimal('0')) + share
    academy.save(update_fields=['balance'])
    return AcademyIncomeRecord.objects.create(
        academy=academy,
        user=user,
        plan=plan_key,
        amount_som=share,
    )


class SubscriptionService:

    @staticmethod
    def get_or_create(user) -> UserSubscription:
        sub, created = UserSubscription.objects.get_or_create(user=user)
        if created:
            # 1) Ro'yxatdan o'tish bonusi (welcome_bonus, bir martalik)
            welcome = PLAN_CONFIG['free'].get('welcome_bonus', 0)
            if welcome:
                TokenService.credit(user, welcome, TokenTransaction.Reason.SUBSCRIPTION)
            # 2) Birinchi oylik grant (200 tok)
            SubscriptionService.grant_monthly_tokens(user, sub)
        return sub

    @staticmethod
    @transaction.atomic
    def subscribe(user, plan_key: str) -> UserSubscription:
        """Foydalanuvchini pro planga o'tkazadi va welcome bonus beradi."""
        config = PLAN_CONFIG.get(plan_key)
        if not config:
            raise ValueError(f'Noto\'g\'ri plan: {plan_key}')

        sub, _ = UserSubscription.objects.select_for_update().get_or_create(user=user)
        sub.plan = plan_key

        duration = config['duration_days']
        if duration:
            now = timezone.now()
            # Joriy obuna tugamagan bo'lsa ustiga qo'shish
            base = max(sub.expires_at, now) if sub.expires_at and sub.expires_at > now else now
            sub.expires_at = base + timedelta(days=duration)
        else:
            sub.expires_at = None

        sub.save(update_fields=['plan', 'expires_at', 'updated_at'])

        welcome = config['welcome_bonus']
        if welcome:
            TokenService.credit(user, welcome, TokenTransaction.Reason.SUBSCRIPTION)

        # User.status ni yangilash
        from users.models import User
        is_pro = plan_key != 'free'
        User.objects.filter(pk=user.pk).update(
            status='premium' if is_pro else 'standard'
        )

        # Academy revenue share: 30% to each academy the user is a member of
        # (faqat agar user ALLAQACHON akademiya a'zosi bo'lsa — odatda renewal holati)
        if is_pro:
            from contests.models import AcademyMembership
            membership = AcademyMembership.objects.filter(user=user).select_related('academy').first()
            if membership and membership.academy.is_active:
                credit_academy_revenue(membership.academy, user, plan_key)

        return sub

    @staticmethod
    @transaction.atomic
    def claim_daily_bonus(user) -> int:
        """Kunlik bonus oladi. Bugun allaqachon olingan bo'lsa 0 qaytaradi."""
        sub = SubscriptionService.get_or_create(user)
        today = timezone.now().date()

        if sub.last_daily_bonus_at == today:
            return 0

        config = PLAN_CONFIG.get(sub.plan if sub.is_pro or sub.plan == 'free' else 'free')
        bonus = config['daily_bonus']

        sub.last_daily_bonus_at = today
        sub.save(update_fields=['last_daily_bonus_at', 'updated_at'])

        TokenService.credit(user, bonus, TokenTransaction.Reason.DAILY_BONUS)
        return bonus

    @staticmethod
    @transaction.atomic
    def grant_monthly_tokens(user, sub: UserSubscription = None) -> int:
        """Oylik token grant. Shu oy allaqachon berilgan bo'lsa 0 qaytaradi."""
        if sub is None:
            sub = SubscriptionService.get_or_create(user)

        today = timezone.now().date()
        if sub.last_monthly_grant_at and sub.last_monthly_grant_at.month == today.month \
                and sub.last_monthly_grant_at.year == today.year:
            return 0

        plan_key = sub.plan if (sub.plan == 'free' or sub.is_pro) else 'free'
        amount = PLAN_CONFIG[plan_key]['monthly_tokens']

        sub.last_monthly_grant_at = today
        sub.save(update_fields=['last_monthly_grant_at', 'updated_at'])

        TokenService.credit(user, amount, TokenTransaction.Reason.MONTHLY_GRANT)
        return amount


class TokenService:

    @staticmethod
    def get_or_create_wallet(user) -> TokenWallet:
        wallet, _ = TokenWallet.objects.get_or_create(user=user)
        return wallet

    @staticmethod
    def get_balance(user) -> int:
        wallet = TokenWallet.objects.filter(user=user).first()
        return wallet.balance if wallet else 0

    @staticmethod
    @transaction.atomic
    def spend(user, amount: int, reason: str, session_id=None, contest_id=None) -> TokenTransaction:
        wallet, _ = TokenWallet.objects.select_for_update().get_or_create(user=user)
        if wallet.balance < amount:
            raise InsufficientBalanceError(
                f'Balansda yetarli token yo\'q. Kerak: {amount}, mavjud: {wallet.balance}.'
            )
        wallet.balance -= amount
        wallet.save(update_fields=['balance', 'updated_at'])
        return TokenTransaction.objects.create(
            wallet=wallet, amount=-amount, balance_after=wallet.balance,
            reason=reason, session_id=session_id, contest_id=contest_id,
        )

    @staticmethod
    @transaction.atomic
    def credit(user, amount: int, reason: str, session_id=None, contest_id=None) -> TokenTransaction:
        wallet, _ = TokenWallet.objects.select_for_update().get_or_create(user=user)
        wallet.balance += amount
        wallet.save(update_fields=['balance', 'updated_at'])
        return TokenTransaction.objects.create(
            wallet=wallet, amount=amount, balance_after=wallet.balance,
            reason=reason, session_id=session_id, contest_id=contest_id,
        )

    @staticmethod
    def apply_session_result(session) -> None:
        """ExamSession yakunlanganda natijaga qarab token refund/bonus beradi."""
        from quiz.models import ExamSession

        mode       = session.mode
        cost       = session.tokens_spent
        user       = session.user
        percentage = session.percentage
        mistakes   = session.total_questions - session.score

        SPEND  = {
            ExamSession.Mode.CATEGORY: TokenTransaction.Reason.CATEGORY_REFUND,
            ExamSession.Mode.MIXED:    TokenTransaction.Reason.MIXED_REFUND,
            ExamSession.Mode.MARATHON: TokenTransaction.Reason.MARATHON_REFUND,
            ExamSession.Mode.TEST:     TokenTransaction.Reason.EXAM_REFUND,
            ExamSession.Mode.PRACTICE: TokenTransaction.Reason.PRACTICE_REFUND,
        }
        BONUS_R = {
            ExamSession.Mode.CATEGORY: TokenTransaction.Reason.CATEGORY_BONUS,
            ExamSession.Mode.MIXED:    TokenTransaction.Reason.MIXED_BONUS,
            ExamSession.Mode.MARATHON: TokenTransaction.Reason.MARATHON_BONUS,
            ExamSession.Mode.TEST:     TokenTransaction.Reason.EXAM_BONUS,
            ExamSession.Mode.PRACTICE: TokenTransaction.Reason.PRACTICE_BONUS,
        }

        if mode == ExamSession.Mode.TEST:
            # Sinov exam: 2 ta xatodan ko'p bo'lsa o'tmadi
            if mistakes <= EXAM_MAX_MISTAKES:
                if cost:
                    TokenService.credit(user, cost, SPEND[mode], session_id=session.id)
                bonus = BONUSES.get(mode, 0)
                if bonus:
                    TokenService.credit(user, bonus, BONUS_R[mode], session_id=session.id)
            # o'tmasa token qaytarilmaydi

        elif mode in (ExamSession.Mode.CATEGORY, ExamSession.Mode.MIXED,
                      ExamSession.Mode.MARATHON, ExamSession.Mode.PRACTICE):
            if percentage >= REFUND_THRESHOLD:
                if cost:
                    TokenService.credit(user, cost, SPEND[mode], session_id=session.id)
                bonus = BONUSES.get(mode, 0)
                if bonus and mode in BONUS_R:
                    TokenService.credit(user, bonus, BONUS_R[mode], session_id=session.id)

    @staticmethod
    def apply_contest_prizes(contest) -> None:
        from contests.models import ContestParticipant
        participants = (
            ContestParticipant.objects
            .filter(contest=contest, rank__isnull=False, rank__lte=10)
            .select_related('user')
        )
        for p in participants:
            prize = CONTEST_PRIZES.get(p.rank, CONTEST_TOP10_PRIZE)
            TokenService.credit(
                p.user, prize,
                TokenTransaction.Reason.CONTEST_PRIZE,
                contest_id=contest.id,
            )
