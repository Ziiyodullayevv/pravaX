"""300 ta soxta foydalanuvchi yaratadi (avtomatik kontestlar reytingi uchun).

Foydalanish:
    python manage.py seed_fake_users
    python manage.py seed_fake_users --count 500
"""
import random
import uuid

from django.core.management.base import BaseCommand
from django.db import transaction

from contests.fake_data import UZBEK_FIRST_NAMES, UZBEK_LAST_NAMES
from users.models import User


class Command(BaseCommand):
    help = 'O\'zbekcha ismli soxta foydalanuvchilar yaratadi (is_fake=True).'

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=300, help='Yaratilishi kerak bo\'lgan soxta userlar soni')

    @transaction.atomic
    def handle(self, *args, count, **options):
        existing = User.objects.filter(is_fake=True).count()
        if existing >= count:
            self.stdout.write(self.style.WARNING(
                f'Allaqachon {existing} ta soxta user mavjud. Yaratish kerak emas.'
            ))
            return

        to_create = count - existing
        users = []
        for _ in range(to_create):
            first = random.choice(UZBEK_FIRST_NAMES)
            last  = random.choice(UZBEK_LAST_NAMES)
            users.append(User(
                username=    f'fake_{uuid.uuid4().hex[:12]}',
                first_name=  first,
                last_name=   last,
                is_fake=     True,
                is_active=   False,  # login qila olmasin
                auth_source= User.AuthSource.EMAIL,
            ))

        User.objects.bulk_create(users, batch_size=100)
        total = User.objects.filter(is_fake=True).count()
        self.stdout.write(self.style.SUCCESS(
            f'✅ {to_create} ta yangi soxta user yaratildi. Jami: {total}'
        ))
