import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated

from contests.permissions import IsRealUser
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from drf_spectacular.utils import extend_schema, OpenApiResponse, inline_serializer
from rest_framework import serializers as rf_serializers

from .models import User
from .serializers import (
    EmailOTPRequestSerializer,
    EmailOTPVerifySerializer,
    ProfileUpdateSerializer,
    TelegramLoginSerializer,
    TelegramPhoneVerifySerializer,
    UserSerializer,
)
from .services import (
    generate_otp, set_otp, get_otp, delete_otp,
    get_tg_otp, delete_tg_otp, normalize_phone,
    create_auth_session, get_auth_session, delete_auth_session,
)
from .tasks import send_otp_email


def _unique_username(preferred: str = '') -> str:
    """Berilgan username band bo'lsa UUID bilan yangi yaratadi."""
    candidate = preferred.strip() or uuid.uuid4().hex[:16]
    if User.objects.filter(username=candidate).exists():
        candidate = uuid.uuid4().hex[:16]
    return candidate


def _get_tokens(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


class EmailOTPRequestView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(
        tags=['Auth — Email OTP'],
        summary='OTP kod yuborish',
        description='Berilgan emailga 6 xonali OTP kod yuboradi. Kod Redisda 120 soniya saqlanadi.',
        request=EmailOTPRequestSerializer,
        responses={
            200: OpenApiResponse(
                response=inline_serializer(
                    name='OTPRequestSuccess',
                    fields={'detail': rf_serializers.CharField()},
                ),
                description='OTP muvaffaqiyatli yuborildi.',
            ),
        },
    )
    def post(self, request):
        serializer = EmailOTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        otp = generate_otp()
        set_otp(email, otp)

        send_otp_email.delay(email, otp)

        return Response({'detail': 'OTP kod emailga yuborildi.'}, status=status.HTTP_200_OK)


_AuthTokenSerializer = inline_serializer(
    name='AuthTokenResponse',
    fields={
        'user': UserSerializer(),
        'tokens': inline_serializer(
            name='JWTTokenPair',
            fields={
                'access': rf_serializers.CharField(),
                'refresh': rf_serializers.CharField(),
            },
        ),
        'created': rf_serializers.BooleanField(),
    },
)


class EmailOTPVerifyView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(
        tags=['Auth — Email OTP'],
        summary='OTP tasdiqlash va login',
        description='OTP to\'g\'ri bo\'lsa foydalanuvchini yaratadi yoki topadi va JWT tokenlar qaytaradi.',
        request=EmailOTPVerifySerializer,
        responses={
            200: OpenApiResponse(response=_AuthTokenSerializer, description='Muvaffaqiyatli login.'),
            400: OpenApiResponse(description='OTP noto\'g\'ri yoki muddati tugagan.'),
        },
    )
    def post(self, request):
        serializer = EmailOTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        otp_input = serializer.validated_data['otp']

        cached_otp = get_otp(email)

        if cached_otp is None:
            return Response(
                {'detail': 'OTP kod topilmadi yoki muddati tugagan.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if cached_otp != otp_input:
            return Response(
                {'detail': 'OTP kod noto\'g\'ri.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        delete_otp(email)

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': uuid.uuid4().hex[:16],
                'auth_source': User.AuthSource.EMAIL,
            },
        )

        return Response(
            {
                'user': UserSerializer(user).data,
                'tokens': _get_tokens(user),
                'created': created,
            },
            status=status.HTTP_200_OK,
        )


class TelegramLoginView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(
        tags=['Auth — Telegram'],
        summary='Telegram orqali login / register',
        description='React Native\'dan kelgan Telegram ma\'lumotlari asosida foydalanuvchini yaratadi yoki tizimga kiritadi.',
        request=TelegramLoginSerializer,
        responses={
            200: OpenApiResponse(response=_AuthTokenSerializer, description='Muvaffaqiyatli login.'),
        },
    )
    def post(self, request):
        serializer = TelegramLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        telegram_id = data['id']

        user, created = User.objects.get_or_create(
            telegram_id=telegram_id,
            defaults={
                'username': _unique_username(data.get('username', '')),
                'first_name': data.get('first_name', ''),
                'last_name': data.get('last_name', ''),
                'phone_number': data.get('phone_number', ''),
                'photo_url': data.get('photo_url', '') or '',
                'auth_source': User.AuthSource.TELEGRAM,
            },
        )

        if not created:
            updated_fields = []
            for field in ('first_name', 'last_name', 'photo_url'):
                new_val = data.get(field, '')
                if new_val and getattr(user, field) != new_val:
                    setattr(user, field, new_val)
                    updated_fields.append(field)
            if updated_fields:
                user.save(update_fields=updated_fields)

        return Response(
            {
                'user': UserSerializer(user).data,
                'tokens': _get_tokens(user),
                'created': created,
            },
            status=status.HTTP_200_OK,
        )


class TelegramCreateSessionView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(
        tags=['Auth — Telegram'],
        summary='Auth sessiyasi yaratish',
        description=(
            'Mobil ilova uchun: yangi auth sessiyasi yaratadi va Telegram bot URL qaytaradi.\n\n'
            'App shu `bot_url` ni ochadi, user `/start <token>` ishlaydi, kontakt share qiladi '
            'va `GET /telegram/session/<token>/` polling orqali natijani oladi.'
        ),
        request=None,
        responses={
            200: inline_serializer(
                name='TelegramSessionCreate',
                fields={
                    'token':      rf_serializers.CharField(),
                    'bot_url':    rf_serializers.CharField(),
                    'expires_in': rf_serializers.IntegerField(),
                },
            ),
        },
    )
    def post(self, request):
        from django.conf import settings
        redirect_url = request.data.get('redirect_url', '')
        token   = create_auth_session(redirect_url=redirect_url)
        bot_url = f'https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start={token}'
        return Response({'token': token, 'bot_url': bot_url, 'expires_in': 300})


class TelegramSessionStatusView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(
        tags=['Auth — Telegram'],
        summary='Auth sessiya holati (polling)',
        description=(
            'App har 2 sekundda shu endpointni tekshiradi.\n\n'
            '`status: pending` — user hali kontakt bermagan.\n\n'
            '`status: success` — user login bo\'ldi, `access_token` va `refresh_token` keladi.\n\n'
            '`status: expired` — sessiya muddati tugagan.'
        ),
        responses={
            200: inline_serializer(
                name='TelegramSessionStatus',
                fields={
                    'status':        rf_serializers.CharField(),
                    'user':          UserSerializer(required=False),
                    'access_token':  rf_serializers.CharField(required=False),
                    'refresh_token': rf_serializers.CharField(required=False),
                },
            ),
        },
    )
    def get(self, request, token):
        session = get_auth_session(token)

        if session is None:
            return Response({'status': 'expired'})

        if session['status'] == 'success':
            # Sessiyani O'CHIRMAYMIZ — TTL o'zi tozalaydi.
            # Sabab: user botda "Ilovaga qaytish" tugmasini bosishi mumkin
            # (TTL ichida), shunda /r/<token>/ endpoint redirect_url ni topishi kerak.
            return Response({
                'status':        'success',
                'user':          session['user'],
                'access_token':  session['access_token'],
                'refresh_token': session['refresh_token'],
            })

        return Response({'status': 'pending'})


class TelegramPhoneVerifyView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(
        tags=['Auth — Telegram'],
        summary='Telegram OTP tasdiqlash va login',
        description=(
            'Telegram bot orqali yuborilgan OTP kodni tekshiradi va JWT tokenlar qaytaradi.\n\n'
            'Flow: Foydalanuvchi @pravagosuperbot ga /start bosadi → kontaktini ulashadi → '
            'bot OTP kodni yuboradi → shu endpoint orqali login.'
        ),
        request=TelegramPhoneVerifySerializer,
        responses={
            200: OpenApiResponse(response=_AuthTokenSerializer, description='Muvaffaqiyatli login.'),
            400: OpenApiResponse(description='Kod noto\'g\'ri yoki muddati tugagan.'),
        },
    )
    def post(self, request):
        serializer = TelegramPhoneVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone = normalize_phone(serializer.validated_data['phone_number'])
        code = serializer.validated_data['code']

        cached = get_tg_otp(phone)

        if cached is None:
            return Response(
                {'detail': 'Kod topilmadi yoki muddati tugagan. Botda qaytadan urinib ko\'ring.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if cached['otp'] != code:
            return Response(
                {'detail': 'Kod noto\'g\'ri.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        delete_tg_otp(phone)
        telegram_id = cached['telegram_id']

        user, created = User.objects.get_or_create(
            telegram_id=telegram_id,
            defaults={
                'username': _unique_username(),
                'phone_number': phone,
                'auth_source': User.AuthSource.TELEGRAM,
            },
        )

        if not created and user.phone_number != phone:
            user.phone_number = phone
            user.save(update_fields=['phone_number'])

        return Response(
            {
                'user': UserSerializer(user).data,
                'tokens': _get_tokens(user),
                'created': created,
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Auth — Logout'],
        summary='Chiqish (logout)',
        description='Refresh tokenni bekor qiladi. Keyingi token yangilash urinishlari ishlamas.',
        request=inline_serializer(
            name='LogoutRequest',
            fields={'refresh': rf_serializers.CharField()},
        ),
        responses={
            204: OpenApiResponse(description='Muvaffaqiyatli chiqildi.'),
            400: OpenApiResponse(description='Token yaroqsiz yoki allaqachon bekor qilingan.'),
        },
    )
    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'detail': 'refresh token talab qilinadi.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            return Response({'detail': 'Token yaroqsiz yoki muddati tugagan.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class RedirectToAppView(APIView):
    """Telegram bot tugmasi shu yerga ko'rsatadi. 302 redirect → ilova deep link.

    Sabab: Telegram inline button URL'da faqat http(s):// va tg:// ga ruxsat.
    Custom scheme'larni (`pravax://...`) qabul qilmaydi. Shuning uchun bot
    `https://api.pravax.uz/r/<token>` ga ko'rsatadi, biz esa shu yerda
    ilovaning haqiqiy deep link'iga yo'naltiramiz.
    """
    permission_classes = (AllowAny,)
    authentication_classes: list = []

    @extend_schema(
        tags=['Auth — Telegram'],
        summary='Ilovaga qaytarish (302 redirect)',
        description='Bot tugmasi orqali chaqiriladi. Token Redis\'dan o\'qiladi va '
                    'ilova `redirect_url`\'iga yo\'naltiriladi.',
    )
    def get(self, request, token):
        from html import escape
        from django.http import HttpResponse
        from .services import get_auth_session

        session = get_auth_session(token)
        if session is None:
            return HttpResponse(_html_page(
                title='Sessiya tugagan',
                emoji='⏱',
                heading='Sessiya muddati tugagan',
                text='Iltimos, ilovaga qayting va qaytadan urinib ko\'ring.',
            ), status=410)

        redirect_url = session.get('redirect_url', '')
        if not redirect_url:
            return HttpResponse(_html_page(
                title='Login muvaffaqiyatli',
                emoji='✅',
                heading='Login muvaffaqiyatli',
                text='Ilovaga qaytib davom eting.',
            ), status=200)

        # Sodda 3 yo'lli redirect (frontchining ko'rsatmasi):
        #   1) <meta refresh>      — eng katta moslashuvchi (Telegram WebView ham qabul qiladi)
        #   2) window.location     — JS bilan darhol
        #   3) Manual <a> tugma    — agar avtomatik bloklansa, user qo'lda
        # Agar hech biri ishlamasa — user app'ga qo'lda qaytadi, AppState listener handle qiladi.
        safe_url = escape(redirect_url, quote=True)
        html = f'''<!doctype html>
<html lang="uz"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0; url={safe_url}">
<title>Ilovaga qaytarish</title>
<script>window.location.href = "{safe_url}";</script>
<style>
  body {{ font-family:-apple-system,BlinkMacSystemFont,sans-serif;
          text-align:center; padding:40px 20px; background:#f5f5f5; color:#1f2937; }}
  h2   {{ font-size:22px; margin-bottom:16px }}
  .btn {{ display:inline-block; padding:16px 32px; background:#4f46e5;
          color:#fff; text-decoration:none; border-radius:12px;
          font-size:18px; font-weight:600; margin:20px 0; }}
  .btn:active {{ background:#3730a3 }}
  .hint {{ color:#6b7280; font-size:14px; margin-top:24px }}
</style>
</head><body>
<h2>📲 Ilovaga yo'naltirilmoqda...</h2>
<a href="{safe_url}" class="btn">Ilovaga qaytish</a>
<p class="hint">Avtomatik ochilmasa, yuqoridagi tugmani bosing.<br>
Ilova ochmasa — siz allaqachon tizimga kirgansiz, qo'lda qayting.</p>
</body></html>'''
        return HttpResponse(html, status=200)


def _html_page(title: str, emoji: str, heading: str, text: str) -> str:
    return f'''<!doctype html>
<html lang="uz"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<style>
  body {{ font-family:-apple-system,BlinkMacSystemFont,sans-serif;
          text-align:center; padding:60px 20px; background:#f5f5f5; color:#1f2937; }}
  .emoji {{ font-size:64px; margin-bottom:16px }}
  h2     {{ margin-bottom:12px }}
  p      {{ color:#6b7280 }}
</style>
</head><body>
<div class="emoji">{emoji}</div>
<h2>{heading}</h2>
<p>{text}</p>
</body></html>'''


class MeView(APIView):
    permission_classes = (IsRealUser,)

    @extend_schema(
        tags=['Profile'],
        summary='Joriy foydalanuvchi',
        responses={200: UserSerializer},
    )
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    @extend_schema(
        tags=['Profile'],
        summary='Profilni yangilash',
        description='`first_name`, `last_name`, `phone_number`, `photo_url` yangilanadi. Email o\'zgartirilmaydi.',
        request=ProfileUpdateSerializer,
        responses={200: UserSerializer},
    )
    def patch(self, request):
        serializer = ProfileUpdateSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)
