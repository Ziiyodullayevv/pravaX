"""AcademyProfile ni User'dan ajratish: alohida username/password auth."""
from django.db import migrations, models


def delete_existing_academy_profiles(apps, schema_editor):
    """Eski AcademyProfile yozuvlari user FK bilan bog'liq edi.
    Yangi schema bilan mos kelmagani uchun ularni o'chirib tashlaymiz.
    Cascade orqali AcademyMembership va AcademyIncomeRecord ham o'chadi.
    Contest.academy_profile SET_NULL bo'lgani uchun contestlar saqlanadi.
    """
    AcademyProfile = apps.get_model('contests', 'AcademyProfile')
    AcademyProfile.objects.all().delete()


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ('contests', '0003_academy_membership_income'),
    ]

    operations = [
        # 1) Mavjud yozuvlarni tozalash (user FK olib tashlashdan oldin)
        migrations.RunPython(delete_existing_academy_profiles, migrations.RunPython.noop),

        # 2) Eski user FK ni olib tashlash
        migrations.RemoveField(
            model_name='academyprofile',
            name='user',
        ),

        # 3) Yangi auth maydonlari
        migrations.AddField(
            model_name='academyprofile',
            name='username',
            field=models.CharField(max_length=64, unique=True, verbose_name='Login'),
        ),
        migrations.AddField(
            model_name='academyprofile',
            name='password',
            field=models.CharField(max_length=128, verbose_name='Parol (hash)'),
        ),
        migrations.AddField(
            model_name='academyprofile',
            name='fullname',
            field=models.CharField(max_length=200, verbose_name='F.I.Sh'),
        ),
        migrations.AddField(
            model_name='academyprofile',
            name='email',
            field=models.EmailField(blank=True, max_length=254, verbose_name='Email'),
        ),
        migrations.AddField(
            model_name='academyprofile',
            name='last_login',
            field=models.DateTimeField(blank=True, null=True),
        ),

        # 4) invite_code ni blank=True qilish (auto-generation save() da)
        migrations.AlterField(
            model_name='academyprofile',
            name='invite_code',
            field=models.CharField(blank=True, max_length=20, unique=True, verbose_name='Taklif kodi'),
        ),
    ]
