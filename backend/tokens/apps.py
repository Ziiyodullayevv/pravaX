from django.apps import AppConfig


class TokensConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tokens'
    verbose_name = 'Tokenlar'

    def ready(self):
        from django.contrib.auth import get_user_model
        from django.db.models.signals import post_save

        def create_wallet(sender, instance, created, **kwargs):
            if created:
                from tokens.services import TokenService
                TokenService.get_or_create_wallet(instance)

        User = get_user_model()
        post_save.connect(create_wallet, sender=User, weak=False)
