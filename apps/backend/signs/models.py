from django.db import models


class SignSection(models.Model):
    name_uzl  = models.CharField(max_length=200, verbose_name='Nomi (UZL)')
    name_uzk  = models.CharField(max_length=200, blank=True, verbose_name='Nomi (UZK)')
    name_ru   = models.CharField(max_length=200, blank=True, verbose_name='Nomi (RU)')
    order     = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']
        verbose_name = 'Yo\'l belgisi bo\'limi'
        verbose_name_plural = 'Yo\'l belgisi bo\'limlari'

    def __str__(self):
        return self.name_uzl


class Sign(models.Model):
    section     = models.ForeignKey(SignSection, on_delete=models.CASCADE, related_name='signs')
    number      = models.CharField(max_length=20, verbose_name='Raqami', help_text='Masalan: 1.1, 2.5')
    name_uzl    = models.CharField(max_length=300, verbose_name='Nomi (UZL)')
    name_uzk    = models.CharField(max_length=300, blank=True, verbose_name='Nomi (UZK)')
    name_ru     = models.CharField(max_length=300, blank=True, verbose_name='Nomi (RU)')
    image       = models.ImageField(upload_to='signs/', verbose_name='Rasm')
    description_uzl = models.TextField(blank=True, verbose_name='Qisqa tavsif (UZL)')
    description_uzk = models.TextField(blank=True, verbose_name='Qisqa tavsif (UZK)')
    description_ru  = models.TextField(blank=True, verbose_name='Qisqa tavsif (RU)')
    extra_uzl   = models.TextField(blank=True, verbose_name='Qo\'shimcha ma\'lumot (UZL)')
    extra_uzk   = models.TextField(blank=True, verbose_name='Qo\'shimcha ma\'lumot (UZK)')
    extra_ru    = models.TextField(blank=True, verbose_name='Qo\'shimcha ma\'lumot (RU)')
    order       = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'number']
        verbose_name = 'Yo\'l belgisi'
        verbose_name_plural = 'Yo\'l belgilari'

    def __str__(self):
        return f'{self.number} — {self.name_uzl[:60]}'
