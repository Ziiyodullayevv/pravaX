from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    EmailOTPRequestView,
    EmailOTPVerifyView,
    TelegramLoginView,
    TelegramCreateSessionView,
    TelegramSessionStatusView,
    TelegramPhoneVerifyView,
    LogoutView,
    MeView,
)

urlpatterns = [
    # Email OTP
    path('email/request/', EmailOTPRequestView.as_view(), name='email-otp-request'),
    path('email/verify/',  EmailOTPVerifyView.as_view(),  name='email-otp-verify'),

    # Telegram — Deep link flow (mobil ilova uchun)
    path('telegram/session/',          TelegramCreateSessionView.as_view(),          name='tg-create-session'),
    path('telegram/session/<str:token>/', TelegramSessionStatusView.as_view(),       name='tg-session-status'),

    # Telegram — OTP flow (eski)
    path('telegram/verify/', TelegramPhoneVerifyView.as_view(), name='telegram-phone-verify'),

    # Telegram — to'g'ridan-to'g'ri (eski)
    path('telegram/', TelegramLoginView.as_view(), name='telegram-login'),

    # JWT refresh & logout
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('logout/',        LogoutView.as_view(),        name='logout'),

    # Profile
    path('me/', MeView.as_view(), name='me'),
]
