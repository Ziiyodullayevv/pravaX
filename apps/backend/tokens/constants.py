import math

# ─── Subscription plan konfiguratsiyasi ──────────────────────────────────────
PLAN_CONFIG = {
    'free': {
        'price':          0,
        'monthly_tokens': 200,
        'welcome_bonus':  700,    # ro'yxatdan o'tganda bir martalik bonus
        'daily_bonus':    10,
        'duration_days':  None,   # muddatsiz (bepul)
    },
    'pro_monthly': {
        'price':          24_900,
        'monthly_tokens': 0,        # to'lov qilganda darhol welcome_bonus orqali beriladi
        'welcome_bonus':  4_000,    # subscribe (yoki renewal) → +4000 tok
        'daily_bonus':    20,
        'duration_days':  30,
    },
    'pro_yearly': {
        'price':          99_900,
        'monthly_tokens': 0,        # to'lov qilganda darhol welcome_bonus orqali beriladi
        'welcome_bonus':  40_300,   # subscribe (yoki renewal) → +40300 tok
        'daily_bonus':    20,
        'duration_days':  365,
    },
}

# ─── Test narxlari ────────────────────────────────────────────────────────────
CATEGORY_COST_PER_10 = 8       # har 10 savolga 8 token
MIXED_COST           = 10      # aralash test (10 savol)
MARATHON_COSTS       = {50: 40, 100: 70, 150: 90}
EXAM_COST            = 60      # sinov exam (20 savol)
PRACTICE_COST        = 3       # eski practice (backward compat)

# ─── Contest kirish narxi ─────────────────────────────────────────────────────
CONTEST_GLOBAL_DAILY_COST   = 30
CONTEST_GLOBAL_WEEKLY_COST  = 60

# ─── Natija chegaralari ───────────────────────────────────────────────────────
REFUND_THRESHOLD  = 80    # % dan yuqori bo'lsa token qaytariladi
EXAM_MAX_MISTAKES = 2     # sinov exam: 2 xatodan ko'p bo'lsa o'tmadi

# ─── Bonuslar (test o'tganda) ─────────────────────────────────────────────────
BONUSES = {
    'category': 3,
    'mixed':    3,
    'marathon': 8,
    'test':     15,   # sinov exam
    'practice': 1,
}

# ─── Contest sovrini ──────────────────────────────────────────────────────────
CONTEST_PRIZES     = {1: 200, 2: 150, 3: 100}
CONTEST_TOP10_PRIZE = 30


def category_cost(question_count: int) -> int:
    """Kategoriya sessiyasi narxi: har 10 savol uchun 8 token."""
    return math.ceil(max(1, question_count) / 10) * CATEGORY_COST_PER_10
