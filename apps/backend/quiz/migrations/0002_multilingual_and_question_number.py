from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0001_initial'),
    ]

    operations = [
        # ── Category ──────────────────────────────────────────────────────────
        migrations.RenameField('Category', 'name', 'name_uzl'),
        migrations.AddField(
            model_name='Category',
            name='name_uzk',
            field=models.CharField(blank=True, max_length=200, verbose_name='Nomi (UZK)'),
        ),
        migrations.AddField(
            model_name='Category',
            name='name_ru',
            field=models.CharField(blank=True, max_length=200, verbose_name='Nomi (RU)'),
        ),
        migrations.AlterField(
            model_name='Category',
            name='name_uzl',
            field=models.CharField(max_length=200, verbose_name='Nomi (UZL)'),
        ),

        # ── Question ──────────────────────────────────────────────────────────
        migrations.AddField(
            model_name='Question',
            name='number',
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                unique=True,
                verbose_name='Savol raqami',
                help_text='Rasm nomidagi raqam bilan mos keladi (masalan: i{number}_*.jpg)',
            ),
        ),
        migrations.RenameField('Question', 'text', 'text_uzl'),
        migrations.AlterField(
            model_name='Question',
            name='text_uzl',
            field=models.TextField(verbose_name='Matn (UZL)'),
        ),
        migrations.AddField(
            model_name='Question',
            name='text_uzk',
            field=models.TextField(blank=True, verbose_name='Matn (UZK)'),
        ),
        migrations.AddField(
            model_name='Question',
            name='text_ru',
            field=models.TextField(blank=True, verbose_name='Matn (RU)'),
        ),
        migrations.RenameField('Question', 'explanation', 'explanation_uzl'),
        migrations.AlterField(
            model_name='Question',
            name='explanation_uzl',
            field=models.TextField(blank=True, verbose_name='Izoh (UZL)'),
        ),
        migrations.AddField(
            model_name='Question',
            name='explanation_uzk',
            field=models.TextField(blank=True, verbose_name='Izoh (UZK)'),
        ),
        migrations.AddField(
            model_name='Question',
            name='explanation_ru',
            field=models.TextField(blank=True, verbose_name='Izoh (RU)'),
        ),
        migrations.AlterModelOptions(
            name='Question',
            options={
                'ordering': ['number', '-created_at'],
                'verbose_name': 'Savol',
                'verbose_name_plural': 'Savollar',
            },
        ),

        # ── Choice ────────────────────────────────────────────────────────────
        migrations.RenameField('Choice', 'text', 'text_uzl'),
        migrations.AlterField(
            model_name='Choice',
            name='text_uzl',
            field=models.CharField(max_length=500, verbose_name='Variant (UZL)'),
        ),
        migrations.AddField(
            model_name='Choice',
            name='text_uzk',
            field=models.CharField(blank=True, max_length=500, verbose_name='Variant (UZK)'),
        ),
        migrations.AddField(
            model_name='Choice',
            name='text_ru',
            field=models.CharField(blank=True, max_length=500, verbose_name='Variant (RU)'),
        ),

        # ── QuestionMedia ─────────────────────────────────────────────────────
        migrations.AlterField(
            model_name='QuestionMedia',
            name='file',
            field=models.FileField(upload_to='questions/images/'),
        ),
    ]
