from django.apps import AppConfig


class UsersConfig(AppConfig):
    name = 'users'

    def ready(self):
        # Signal'larni ro'yxatga olish (User yaratilganda welcome bonus)
        from . import signals  # noqa: F401
