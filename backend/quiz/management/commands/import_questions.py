"""
savollar/ papkasidagi 3 ta JSON fayldan savollarni import qiladi.

JSON fayl formati (question_ru.json / question_uzl.json / question_uzk.json):
[
  {
    "id": 1,
    "question": "...",
    "image_q": "i1_1",          # rasm nomi (extensions'siz), bo'sh bo'lishi mumkin
    "correct_ans_alls": "...",   # izoh
    "answers": ["v1", "v2", "v3", "v4"],
    "correct_answer": 4,        # 1-indexed
    "question_category": "1",   # bilet raqami (1–123)
    "topic": 37                 # mavzu raqami (1–42)
  },
  ...
]

Foydalanish:
    python manage.py import_questions
    python manage.py import_questions --clear
    python manage.py import_questions --savollar-dir /boshqa/papka
"""

import json
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand

from quiz.models import Category, Choice, Question, QuestionMedia

SAVOLLAR_DIR = settings.BASE_DIR / 'savollar'
IMAGES_DIRS = [
    settings.BASE_DIR / 'images' / 'questions_i',
    settings.BASE_DIR / 'images',
]

# Mavzu raqami → (uzl, uzk, ru) nomlari
TOPIC_NAMES: dict[int, tuple[str, str, str]] = {
    1:  ('Umumiy qoidalar',                          'Умумий қоидалар',                        'Общие правила'),
    2:  ('Haydovchining vazifalari',                  'Ҳайдовчининг вазифалари',                 'Обязанности водителя'),
    3:  ('Piyodalar va yo\'lovchilar',                'Пиёдалар ва йўловчилар',                  'Пешеходы и пассажиры'),
    4:  ('Maxsus yorug\'lik signallari',              'Махсус ёруғлик сигналлари',               'Специальные световые сигналы'),
    5:  ('Svetofor signallari',                       'Светофор сигналлари',                     'Сигналы светофора'),
    6:  ('Tartibga soluvchi signallari',              'Тартибга солувчи сигналлари',              'Сигналы регулировщика'),
    7:  ('Ogohlantiruvcchi signallar',                'Огоҳлантирувчи сигналлар',                'Предупредительные сигналы'),
    8:  ('Manevrlar',                                 'Маневрлар',                               'Маневрирование'),
    9:  ('Yo\'lda harakatlanish',                     'Йўлда ҳаракатланиш',                     'Движение по дороге'),
    10: ('Tezlik chegaralari',                        'Тезлик чегаралари',                       'Скоростной режим'),
    11: ('Quvib o\'tish va oldinga o\'tish',          'Қувиб ўтиш ва олдинга ўтиш',              'Обгон и опережение'),
    12: ('To\'xtash va to\'xtab turish',              'Тўхташ ва тўхтаб туриш',                  'Остановка и стоянка'),
    13: ('Tartibga solinadigan kesishmalar',          'Тартибга солинадиган кесишмалар',          'Регулируемые перекрёстки'),
    14: ('Tartibga solinmagan kesishmalar (ustunlik)','Тартибга солинмаган кесишмалар (устун)',   'Нерегулируемые перекрёстки (приоритет)'),
    15: ('Tartibga solinmagan kesishmalar (teng)',    'Тартибга солинмаган кесишмалар (тенг)',    'Нерегулируемые перекрёстки (равнозначные)'),
    16: ('Tartibga solinmagan kesishmalar (aralash)', 'Тартибга солинмаган кесишмалар (аралаш)', 'Нерегулируемые перекрёстки (смешанные)'),
    17: ('Tramvay yo\'llari kesishmalari',            'Трамвай йўллари кесишмалари',              'Пересечения с трамвайными путями'),
    18: ('Piyoda o\'tish joylari',                   'Пиёда ўтиш жойлари',                      'Пешеходные переходы'),
    19: ('Temir yo\'l kesishmalari',                  'Темир йўл кесишмалари',                   'Железнодорожные переезды'),
    20: ('Magistral yo\'llar',                        'Магистрал йўллар',                        'Автомагистрали'),
    21: ('Aholi punktlari va maxsus hududlar',        'Аҳоли пунктлари ва махсус ҳудудлар',      'Населённые пункты и особые зоны'),
    22: ('Velosiped va moped haydovchilari',          'Велосипед ва мопед ҳайдовчилари',         'Велосипедисты и мопедисты'),
    23: ('Marshrutli transport vositalari',           'Маршрутли транспорт воситалари',           'Маршрутные транспортные средства'),
    24: ('Qorong\'ida va yomon havoda harakatlanish', 'Қоронғида ва ёмон ҳавода ҳаракатланиш',   'Движение в тёмное время и в плохих условиях'),
    25: ('Yetaklash (buqsirovka)',                    'Йетаклаш (буқсировка)',                    'Буксировка транспортных средств'),
    26: ('O\'quv haydovchilik',                       'Ўқув ҳайдовчилик',                        'Учебная езда'),
    27: ('Yo\'lovchi tashish',                        'Йўловчи ташиш',                           'Перевозка пассажиров'),
    28: ('Yuk tashish',                               'Юк ташиш',                                'Перевозка грузов'),
    29: ('Velosipedchilar qoidalari',                 'Велосипедчилар қоидалари',                 'Правила для велосипедистов'),
    30: ('Hujjatlar va ro\'yxatga olish',             'Ҳужжатлар ва рўйхатга олиш',              'Документы и регистрация'),
    31: ('Ogohlantiruvcchi belgilar',                 'Огоҳлантирувчи белгилар',                  'Предупреждающие знаки'),
    32: ('Ustunlik belgilari',                        'Устунлик белгилари',                       'Знаки приоритета'),
    33: ('Taqiqlovchi belgilar',                      'Тақиқловчи белгилар',                      'Запрещающие знаки'),
    34: ('Majburiy belgilar',                         'Мажбурий белгилар',                        'Предписывающие знаки'),
    35: ('Axborot va ko\'rsatma belgilar',            'Ахборот ва кўрсатма белгилар',             'Информационные знаки'),
    36: ('Servis va maxsus belgilar',                 'Сервис ва махсус белгилар',                 'Знаки сервиса и особые'),
    37: ('Yo\'l chiziqlari va belgili zonalar',       'Йўл чизиқлари ва белгили зоналар',         'Разметка и зоны'),
    38: ('Gorizontal yo\'l chiziqlari',               'Горизонтал йўл чизиқлари',                 'Горизонтальная разметка'),
    39: ('Vertikal yo\'l chiziqlari',                 'Вертикал йўл чизиқлари',                   'Вертикальная разметка'),
    40: ('Transport vositasining texnik holati',      'Транспорт воситасининг техник ҳолати',     'Техническое состояние ТС'),
    41: ('Haydovchilik mahorati va xavfsizlik',       'Ҳайдовчилик маҳорати ва хавфсизлик',      'Мастерство вождения и безопасность'),
    42: ('Birinchi tibbiy yordam',                    'Биринчи тиббий ёрдам',                    'Оказание первой помощи'),
}


def _find_image(image_q: str) -> Path | None:
    """image_q ('i1_1') ga mos .jpg/.png faylni papkalardan izlaydi."""
    for directory in IMAGES_DIRS:
        for ext in ('.jpg', '.png', '.jpeg'):
            candidate = directory / (image_q + ext)
            if candidate.exists():
                return candidate
    return None


def _load_json(path: Path) -> dict:
    """JSON ni id→row lug'atiga yuklaydi."""
    with open(path, encoding='utf-8') as f:
        rows = json.load(f)
    return {row['id']: row for row in rows}


class Command(BaseCommand):
    help = 'savollar/ papkasidagi JSON fayllardan savollarni bazaga import qiladi'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Import oldidan barcha savollar va kategoriyalarni o\'chiradi',
        )
        parser.add_argument(
            '--savollar-dir',
            type=str,
            default=None,
            help=f'JSON fayllar papkasi (default: {SAVOLLAR_DIR})',
        )

    def handle(self, *args, **options):
        savollar_dir = Path(options['savollar_dir']) if options['savollar_dir'] else SAVOLLAR_DIR

        # ── Fayl mavjudligini tekshirish ──────────────────────────────────────
        files = {
            'uzl': savollar_dir / 'question_uzl.json',
            'uzk': savollar_dir / 'question_uzk.json',
            'ru':  savollar_dir / 'question_ru.json',
        }
        for lang, path in files.items():
            if not path.exists():
                self.stderr.write(self.style.ERROR(f'Fayl topilmadi: {path}'))
                return

        # ── Eski ma'lumotlarni tozalash ───────────────────────────────────────
        if options['clear']:
            q_count = Question.objects.count()
            c_count = Category.objects.count()
            Question.objects.all().delete()
            Category.objects.all().delete()
            self.stdout.write(self.style.WARNING(
                f'{q_count} ta savol va {c_count} ta kategoriya o\'chirildi.'
            ))

        # ── JSON yuklash ──────────────────────────────────────────────────────
        self.stdout.write('JSON fayllar yuklanmoqda...')
        data_uzl = _load_json(files['uzl'])
        data_uzk = _load_json(files['uzk'])
        data_ru  = _load_json(files['ru'])

        all_ids = sorted(data_uzl.keys())
        self.stdout.write(f'Jami {len(all_ids)} ta savol topildi.')

        # ── Kategoriyalar (mavzu raqami bo'yicha) ─────────────────────────────
        topic_ids = sorted({data_uzl[i]['topic'] for i in all_ids})
        category_map: dict[int, Category] = {}
        for topic_id in topic_ids:
            names = TOPIC_NAMES.get(topic_id, (f'Mavzu {topic_id}', f'Мавзу {topic_id}', f'Тема {topic_id}'))
            cat, _ = Category.objects.update_or_create(
                order=topic_id,
                defaults={
                    'name_uzl': names[0],
                    'name_uzk': names[1],
                    'name_ru':  names[2],
                },
            )
            category_map[topic_id] = cat

        self.stdout.write(f'{len(category_map)} ta kategoriya tayyor.')

        # ── Savollarni import qilish ──────────────────────────────────────────
        created = updated = img_linked = img_missing = 0

        for q_id in all_ids:
            row_uzl = data_uzl[q_id]
            row_uzk = data_uzk.get(q_id, {})
            row_ru  = data_ru.get(q_id, {})

            topic    = row_uzl['topic']
            ticket   = int(row_uzl['question_category'])
            image_q  = row_uzl.get('image_q', '').strip()
            category = category_map.get(topic)

            question, is_new = Question.objects.update_or_create(
                number=q_id,
                defaults=dict(
                    ticket_number=ticket,
                    category=category,
                    text_uzl=row_uzl.get('question', ''),
                    text_uzk=row_uzk.get('question', ''),
                    text_ru=row_ru.get('question', ''),
                    explanation_uzl=row_uzl.get('correct_ans_alls', ''),
                    explanation_uzk=row_uzk.get('correct_ans_alls', ''),
                    explanation_ru=row_ru.get('correct_ans_alls', ''),
                    difficulty=Question.Difficulty.MEDIUM,
                    is_active=True,
                ),
            )
            if is_new:
                created += 1
            else:
                updated += 1

            # ── Variantlar ────────────────────────────────────────────────────
            question.choices.all().delete()
            answers_uzl = row_uzl.get('answers', [])
            answers_uzk = row_uzk.get('answers', [])
            answers_ru  = row_ru.get('answers', [])
            correct_idx = row_uzl.get('correct_answer', 1) - 1  # 0-indexed

            for order, text_uzl in enumerate(answers_uzl):
                Choice.objects.create(
                    question=question,
                    text_uzl=text_uzl,
                    text_uzk=answers_uzk[order] if order < len(answers_uzk) else '',
                    text_ru=answers_ru[order]  if order < len(answers_ru)  else '',
                    is_correct=(order == correct_idx),
                    order=order,
                )

            # ── Rasm ──────────────────────────────────────────────────────────
            if image_q:
                image_path = _find_image(image_q)
                if image_path:
                    question.media.filter(media_type=QuestionMedia.MediaType.IMAGE).delete()
                    with open(image_path, 'rb') as img_file:
                        media = QuestionMedia(
                            question=question,
                            media_type=QuestionMedia.MediaType.IMAGE,
                            order=0,
                        )
                        media.file.save(image_path.name, File(img_file), save=True)
                    img_linked += 1
                else:
                    img_missing += 1
                    self.stdout.write(
                        self.style.WARNING(f'  Rasm topilmadi: {image_q} (savol #{q_id})')
                    )

        self.stdout.write(self.style.SUCCESS(
            f'\nImport yakunlandi:\n'
            f'  Yangi savollar : {created}\n'
            f'  Yangilangan    : {updated}\n'
            f'  Rasm biriktirildi: {img_linked}\n'
            f'  Rasm topilmadi   : {img_missing}\n'
        ))
