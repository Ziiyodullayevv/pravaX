import django.db.models.deletion
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


def generate_invite_codes(apps, schema_editor):
    import secrets
    import string
    from django.utils import timezone

    AcademyProfile = apps.get_model('contests', 'AcademyProfile')
    used = set()

    def _gen():
        year = timezone.now().year
        suffix = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
        return f'PRAVA-{year}-{suffix}'

    for profile in AcademyProfile.objects.filter(invite_code__isnull=True):
        code = _gen()
        while code in used or AcademyProfile.objects.filter(invite_code=code).exists():
            code = _gen()
        profile.invite_code = code
        profile.save(update_fields=['invite_code'])
        used.add(code)


class Migration(migrations.Migration):

    dependencies = [
        ('contests', '0002_contest_access_key_contest_recurrence_academyprofile_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Add new fields to AcademyProfile
        migrations.AddField(
            model_name='academyprofile',
            name='phone',
            field=models.CharField(blank=True, max_length=20, verbose_name='Telefon'),
        ),
        migrations.AddField(
            model_name='academyprofile',
            name='balance',
            field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=12, verbose_name="Balans (so'm)"),
        ),
        migrations.AddField(
            model_name='academyprofile',
            name='invite_code',
            field=models.CharField(max_length=20, null=True, verbose_name='Taklif kodi'),
        ),

        # 2. Populate invite_code for existing rows
        migrations.RunPython(generate_invite_codes, migrations.RunPython.noop),

        # 3. Make invite_code unique and not null
        migrations.AlterField(
            model_name='academyprofile',
            name='invite_code',
            field=models.CharField(max_length=20, unique=True, verbose_name='Taklif kodi'),
        ),

        # 4. Remove master_key
        migrations.RemoveField(
            model_name='academyprofile',
            name='master_key',
        ),

        # 5. Create AcademyMembership
        migrations.CreateModel(
            name='AcademyMembership',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('joined_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='academy_memberships',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('academy', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='members',
                    to='contests.academyprofile',
                )),
            ],
            options={
                'verbose_name': "Akademiya a'zosi",
                'verbose_name_plural': "Akademiya a'zolari",
                'ordering': ['-joined_at'],
                'unique_together': {('user', 'academy')},
            },
        ),

        # 6. Create AcademyIncomeRecord
        migrations.CreateModel(
            name='AcademyIncomeRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('plan', models.CharField(max_length=15, verbose_name='Plan')),
                ('amount_som', models.DecimalField(decimal_places=2, max_digits=10, verbose_name="Summa (so'm)")),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('academy', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='income_records',
                    to='contests.academyprofile',
                )),
                ('user', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='academy_payments',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Daromad yozuvi',
                'verbose_name_plural': 'Daromad yozuvlari',
                'ordering': ['-created_at'],
            },
        ),
    ]
