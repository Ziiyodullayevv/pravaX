"""Akademiya admin uchun alohida JWT autentifikatsiya tizimi."""
from datetime import datetime, timedelta, timezone as dt_tz

import jwt
from django.conf import settings
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import AcademyProfile


ACADEMY_TOKEN_LIFETIME_DAYS = 7
ACADEMY_TOKEN_TYPE = 'academy'
AUTH_HEADER_PREFIX = 'Bearer'


def generate_academy_token(academy: AcademyProfile) -> dict:
    """Akademiya admin uchun JWT yaratadi (access + ma'lumot)."""
    now = datetime.now(dt_tz.utc)
    payload = {
        'academy_id': academy.id,
        'username':   academy.username,
        'type':       ACADEMY_TOKEN_TYPE,
        'iat':        int(now.timestamp()),
        'exp':        int((now + timedelta(days=ACADEMY_TOKEN_LIFETIME_DAYS)).timestamp()),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
    return {
        'access':     token,
        'expires_in': ACADEMY_TOKEN_LIFETIME_DAYS * 24 * 3600,
        'token_type': AUTH_HEADER_PREFIX,
    }


class AcademyJWTAuthentication(BaseAuthentication):
    """`Authorization: AcademyBearer <token>` orqali academy admin'ni aniqlaydi."""

    def authenticate(self, request):
        """Academy tokenni dekod qiladi.

        Token academy turida bo'lmasa — None qaytaradi (simplejwt urinib ko'rsin).
        Faqat haqiqatan academy tokeni bo'lib, lekin yaroqsiz bo'lsa AuthenticationFailed.
        """
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith(f'{AUTH_HEADER_PREFIX} '):
            return None

        token = auth_header.split(' ', 1)[1].strip()

        # Avval signaturani tekshirmasdan token turini bilamiz
        try:
            unverified = jwt.decode(token, options={'verify_signature': False, 'verify_exp': False})
        except jwt.InvalidTokenError:
            return None  # Umuman JWT emas

        # Academy tokeni emasmi? simplejwt urinib ko'rsin
        if unverified.get('type') != ACADEMY_TOKEN_TYPE:
            return None

        # Bu academy tokeni — endi xatolarni qaytaramiz
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Academy token muddati tugagan. Qaytadan login qiling.')
        except jwt.InvalidTokenError:
            raise AuthenticationFailed('Academy token yaroqsiz.')

        academy_id = payload.get('academy_id')
        if not academy_id:
            raise AuthenticationFailed('Academy token noto\'g\'ri.')

        try:
            academy = AcademyProfile.objects.get(pk=academy_id)
        except AcademyProfile.DoesNotExist:
            raise AuthenticationFailed('Akademiya topilmadi.')

        if not academy.is_active:
            raise AuthenticationFailed('Akademiya faol emas.')

        return (academy, token)

    def authenticate_header(self, request):
        return AUTH_HEADER_PREFIX


class AcademyJWTScheme(OpenApiAuthenticationExtension):
    """drf-spectacular Swagger UI uchun AcademyJWT auth sxemasini ro'yxatga oladi."""
    target_class = 'contests.auth.AcademyJWTAuthentication'
    name         = 'AcademyJWT'

    def get_security_definition(self, auto_schema):
        return {
            'type':         'http',
            'scheme':       'bearer',
            'bearerFormat': 'JWT',
            'description':  'Academy admin JWT (login orqali olinadi).',
        }
