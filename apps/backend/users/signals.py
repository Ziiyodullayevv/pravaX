"""User yaratilganda bonus tokenlar va subscription avtomatik beriladi."""
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import User


@receiver(post_save, sender=User, dispatch_uid='users.grant_signup_bonus')
def grant_signup_bonus(sender, instance, created, **kwargs):
    """Yangi User yaratilganda:
    - UserSubscription (Free) yaratiladi
    - Welcome bonus (700 tok) beriladi
    - Birinchi oylik grant (200 tok) beriladi

    Soxta foydalanuvchilar (`is_fake=True`) bonus olmaydi.
    """
    if not created or instance.is_fake:
        return

    # Circular import oldini olish uchun lazy import
    from tokens.services import SubscriptionService
    SubscriptionService.get_or_create(instance)
