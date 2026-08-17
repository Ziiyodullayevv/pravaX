from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def send_otp_email(self, email: str, otp: str) -> None:
    """OTP kodini emailga async yuboradi. Xato bo'lsa 3 marta qayta urinadi."""
    try:
        send_mail(
            subject='Prava X — Tasdiqlash kodi',
            message=f'Sizning bir martalik kodingiz: {otp}\n\nKod 2 daqiqa ichida amal qiladi.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
    except Exception as exc:
        raise self.retry(exc=exc)
