import random
import uuid
from django.core.cache import cache

OTP_TTL = 120       # 2 daqiqa (email OTP)
OTP_PREFIX = 'otp:'

TG_OTP_TTL = 300    # 5 daqiqa (Telegram OTP)
TG_OTP_PREFIX = 'tg_otp:'

AUTH_SESSION_TTL = 300   # 5 daqiqa
AUTH_SESSION_PREFIX = 'tg_auth:'
TG_MAP_PREFIX = 'tg_map:'


def generate_otp() -> str:
    return str(random.randint(100000, 999999))


def normalize_phone(phone: str) -> str:
    phone = phone.strip().replace(' ', '').replace('-', '')
    if not phone.startswith('+'):
        phone = '+' + phone
    return phone


# ─── Email OTP ────────────────────────────────────────────────────────────────

def set_otp(email: str, otp: str) -> None:
    cache.set(f'{OTP_PREFIX}{email}', otp, timeout=OTP_TTL)


def get_otp(email: str) -> str | None:
    return cache.get(f'{OTP_PREFIX}{email}')


def delete_otp(email: str) -> None:
    cache.delete(f'{OTP_PREFIX}{email}')


# ─── Telegram OTP (eski flow) ─────────────────────────────────────────────────

def set_tg_otp(phone: str, otp: str, telegram_id: int) -> None:
    cache.set(
        f'{TG_OTP_PREFIX}{phone}',
        {'otp': otp, 'telegram_id': telegram_id},
        timeout=TG_OTP_TTL,
    )


def get_tg_otp(phone: str) -> dict | None:
    return cache.get(f'{TG_OTP_PREFIX}{phone}')


def delete_tg_otp(phone: str) -> None:
    cache.delete(f'{TG_OTP_PREFIX}{phone}')


# ─── Telegram Auth Session (yangi deep link flow) ─────────────────────────────

def create_auth_session(redirect_url: str = '') -> str:
    """Yangi auth sessiyasi yaratadi, token qaytaradi."""
    token = uuid.uuid4().hex
    cache.set(
        f'{AUTH_SESSION_PREFIX}{token}',
        {'status': 'pending', 'redirect_url': redirect_url},
        timeout=AUTH_SESSION_TTL,
    )
    return token


def get_auth_session(token: str) -> dict | None:
    return cache.get(f'{AUTH_SESSION_PREFIX}{token}')


def set_auth_session_success(token: str, user_data: dict, access: str, refresh: str) -> None:
    """Sessiyani success holatga o'tkazadi. Eski redirect_url saqlanadi
    (chunki user button bosganda /r/<token>/ shu URL'ga yo'naltiradi)."""
    existing = cache.get(f'{AUTH_SESSION_PREFIX}{token}') or {}
    cache.set(
        f'{AUTH_SESSION_PREFIX}{token}',
        {
            'status':        'success',
            'user':          user_data,
            'access_token':  access,
            'refresh_token': refresh,
            'redirect_url':  existing.get('redirect_url', ''),   # eski qiymatni saqlaymiz
        },
        timeout=AUTH_SESSION_TTL,
    )


def delete_auth_session(token: str) -> None:
    cache.delete(f'{AUTH_SESSION_PREFIX}{token}')


def set_tg_token_map(telegram_id: int, token: str) -> None:
    """Telegram ID → auth token bog'liqligini saqlaydi."""
    cache.set(f'{TG_MAP_PREFIX}{telegram_id}', token, timeout=AUTH_SESSION_TTL)


def get_tg_token_map(telegram_id: int) -> str | None:
    return cache.get(f'{TG_MAP_PREFIX}{telegram_id}')


def delete_tg_token_map(telegram_id: int) -> None:
    cache.delete(f'{TG_MAP_PREFIX}{telegram_id}')
