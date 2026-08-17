# Prava GO — Backend API

Yo'l harakati qoidalari bo'yicha prava imtihoniga tayyorlanish platformasining Django REST Framework backend'i.

---

## Tech Stack

| Qatlam | Texnologiya |
|--------|-------------|
| Framework | Django 6.x + Django REST Framework |
| Auth | SimpleJWT (Bearer token) |
| Database | PostgreSQL |
| Cache / OTP | Redis |
| Async tasks | Celery (broker: Redis) |
| Task results | django-celery-results (PostgreSQL) |
| API docs | drf-spectacular (Swagger UI + ReDoc) |
| Config | django-environ (`.env` fayl) |

---

## Loyiha tuzilmasi

```
prava_go_2/
├── root/                  # Django project konfiguratsiyasi
│   ├── settings.py        # Barcha sozlamalar (environ orqali)
│   ├── urls.py            # Root URL routing
│   └── celery.py          # Celery app
│
├── users/                 # Autentifikatsiya va foydalanuvchilar
│   ├── models.py          # Custom User modeli
│   ├── serializers.py     # Auth serializers
│   ├── views.py           # Auth API viewlar
│   ├── services.py        # Redis OTP funksiyalari
│   ├── tasks.py           # Celery: email yuborish
│   └── urls.py            # /api/auth/ routing
│
├── quiz/                  # Imtihon va savollar
│   ├── models.py          # Category, Question, Choice, ExamSession, ...
│   ├── serializers.py     # Quiz serializers
│   ├── views.py           # Quiz API viewlar
│   ├── admin.py           # Admin panel konfiguratsiyasi
│   ├── urls.py            # /api/quiz/ routing
│   └── management/
│       └── commands/
│           └── import_questions.py  # JSON dan savollarni import qilish
│
├── savollar/              # Savol JSON fayllari (3 tilda)
│   ├── question_uzl.json  # O'zbek lotin (1223 savol)
│   ├── question_uzk.json  # O'zbek kirill
│   └── question_ru.json   # Rus tili
│
├── images/                # Savol rasmlari
│   └── questions_i/       # i{number}_{idx}.jpg formatida
│
├── .env                   # Maxfiy sozlamalar (gitga kirmaydi)
├── .env.example           # Namuna konfiguratsiya
├── Makefile               # Qulay buyruqlar
└── requirements.txt       # Python paketlari
```

---

## O'rnatish va ishga tushirish

### 1. Virtual muhit

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. `.env` fayl

```bash
cp .env.example .env
# .env faylini o'z ma'lumotlaringiz bilan to'ldiring
```

PostgreSQL o‘rnatilmagan lokal sinov uchun `.env` faylida `DB_ENGINE=sqlite` va
`DB_NAME=./db.sqlite3` dan foydalanish mumkin. Production muhitida
`DB_ENGINE=postgresql` qoldiriladi.

### 3. Docker orqali PostgreSQL va Redis

```bash
# PostgreSQL
docker run -d --name prava_db \
  -e POSTGRES_DB=prava_exam \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 postgres:16

# Redis
docker run -d --name prava_redis \
  -p 6379:6379 redis:7
```

### 4. Migratsiya va superuser

```bash
make migrate
make superuser
```

### 5. Savollarni import qilish

```bash
# Barcha 1223 savolni 3 tilda import qilish
python manage.py import_questions

# Tozalab qaytadan import qilish (mavjud ma'lumotlarni o'chiradi)
python manage.py import_questions --clear
```

### 6. Ishga tushirish

```bash
# Terminal 1 — Django server
make run

# Terminal 2 — Celery worker (email yuborish uchun)
make celery
```

---

## API hujjatlari

Server ishga tushgandan so'ng:

| URL | Tavsif |
|-----|--------|
| `http://localhost:8000/api/docs/` | Swagger UI (interaktiv) |
| `http://localhost:8000/api/redoc/` | ReDoc |
| `http://localhost:8000/api/schema/` | OpenAPI 3.0 YAML |

---

## API Endpointlar

### Autentifikatsiya (`/api/auth/`)

Barcha auth endpointlar ochiq (`AllowAny`). Qolgan barcha endpointlar `Authorization: Bearer <token>` talab qiladi.

---

#### 1. Email orqali OTP yuborish

```
POST /api/auth/email/request/
```

**So'rov:**
```json
{
  "email": "ali@example.com"
}
```

**Javob (200):**
```json
{
  "detail": "OTP yuborildi."
}
```

**Ishlash prinsipi:**
- Redis'da `otp:ali@example.com = "482910"` saqlanadi (120 soniya TTL)
- Celery orqali email yuboriladi (async)

---

#### 2. OTP ni tasdiqlash va JWT olish

```
POST /api/auth/email/verify/
```

**So'rov:**
```json
{
  "email": "ali@example.com",
  "otp": "482910"
}
```

**Javob (200) — yangi foydalanuvchi:**
```json
{
  "user": {
    "id": 1,
    "email": "ali@example.com",
    "first_name": "",
    "role": "user"
  },
  "tokens": {
    "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "created": true
}
```

> `"created": false` bo'lsa — mavjud foydalanuvchi login qilgan.

---

#### 3. Telegram orqali login

```
POST /api/auth/telegram/
```

**So'rov:**
```json
{
  "id": 123456789,
  "first_name": "Ali",
  "last_name": "Valiyev",
  "username": "ali_valiyev",
  "phone_number": "+998901234567",
  "photo_url": "https://t.me/i/userpic/..."
}
```

**Javob (200):**
```json
{
  "user": { "id": 2, "telegram_id": 123456789, "first_name": "Ali", "role": "user" },
  "tokens": { "access": "...", "refresh": "..." },
  "created": false
}
```

---

#### 4. Access tokenni yangilash

```
POST /api/auth/token/refresh/
```

**So'rov:**
```json
{
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Javob (200):**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### 5. O'z profilini ko'rish

```
GET /api/auth/me/
Authorization: Bearer <access_token>
```

**Javob (200):**
```json
{
  "id": 1,
  "email": "ali@example.com",
  "first_name": "Ali",
  "last_name": "Valiyev",
  "role": "user",
  "telegram_id": null
}
```

---

### Quiz (`/api/quiz/`)

Barcha quiz endpointlar `Authorization: Bearer <access_token>` talab qiladi.

---

#### 6. Kategoriyalar ro'yxati

```
GET /api/quiz/categories/
Authorization: Bearer <access_token>
```

**Javob (200):**
```json
[
  {
    "id": 1,
    "name_uzl": "Umumiy qoidalar",
    "name_uzk": "Умумий қоидалар",
    "name_ru": "Общие правила",
    "description": "",
    "order": 1
  },
  {
    "id": 5,
    "name_uzl": "Yo'l belgilari",
    "name_uzk": "Йўл белгилари",
    "name_ru": "Дорожные знаки",
    "description": "",
    "order": 5
  }
]
```

> Jami **42 kategoriya** — O'zbekiston YHQ bo'limlari.

---

#### 7. Savollar ro'yxati (filterlash bilan)

```
GET /api/quiz/questions/
Authorization: Bearer <access_token>
```

**Query parametrlar:**

| Parametr | Tur | Tavsif | Misol |
|----------|-----|--------|-------|
| `category` | int | Kategoriya ID | `?category=5` |
| `difficulty` | string | `easy`, `medium`, `hard` | `?difficulty=easy` |
| `ticket_number` | int | Bilet raqami (1–123) | `?ticket_number=7` |

**Misollar:**

```
# 5-kategoriya savollarini olish
GET /api/quiz/questions/?category=5

# 7-bilet savollarini olish (10 ta savol)
GET /api/quiz/questions/?ticket_number=7

# Oson savollar
GET /api/quiz/questions/?difficulty=easy
```

**Javob (200):**
```json
[
  {
    "id": 71,
    "number": 71,
    "ticket_number": 7,
    "text_uzl": "Haydovchi transport vositasini boshqarayotganda nima qilishi taqiqlanadi?",
    "text_uzk": "Ҳайдовчи транспорт воситасини бошқараётганда нима қилиши тақиқланади?",
    "text_ru": "Что запрещается водителю при управлении транспортным средством?",
    "explanation_uzl": null,
    "explanation_uzk": null,
    "explanation_ru": null,
    "difficulty": "easy",
    "category_name": "Haydovchining vazifalari",
    "category_id": 2,
    "images": [
      { "id": 12, "file": "/media/questions/images/i71_1.jpg", "media_type": "image" }
    ],
    "choices": [
      { "id": 281, "text_uzl": "Telefonda gaplashish", "text_uzk": "...", "text_ru": "...", "order": 1 },
      { "id": 282, "text_uzl": "Xavfsiz tezlikda haydash", "text_uzk": "...", "text_ru": "...", "order": 2 },
      { "id": 283, "text_uzl": "Ko'zgu orqali kuzatish", "text_uzk": "...", "text_ru": "...", "order": 3 }
    ]
  }
]
```

> Imtihon jarayonida `is_correct` ko'rinmaydi — faqat `finish/` dan keyin ochiladi.

---

#### 8. Sessiyalar ro'yxati

```
GET /api/quiz/sessions/
Authorization: Bearer <access_token>
```

**Javob (200):**
```json
[
  {
    "id": 3,
    "status": "completed",
    "total_questions": 20,
    "score": 18,
    "passed": true,
    "started_at": "2026-04-23T10:00:00Z",
    "finished_at": "2026-04-23T10:15:00Z"
  },
  {
    "id": 5,
    "status": "in_progress",
    "total_questions": 10,
    "score": null,
    "passed": null,
    "started_at": "2026-04-23T11:00:00Z",
    "finished_at": null
  }
]
```

---

#### 9. Yangi imtihon sessiyasini boshlash

```
POST /api/quiz/sessions/
Authorization: Bearer <access_token>
```

**So'rov:**
```json
{
  "total_questions": 20,
  "category_id": null
}
```

> `category_id` berilsa — faqat o'sha kategoriyadan tasodifiy savollar olinadi.

**Bilet bo'yicha imtihon boshlash uchun** avval bilet savollarini oling:
```
GET /api/quiz/questions/?ticket_number=7
```
...keyin shu savollar ID laridan foydalaning.

**Javob (201):**
```json
{
  "id": 6,
  "status": "in_progress",
  "total_questions": 20,
  "score": null,
  "passed": null,
  "started_at": "2026-04-23T11:30:00Z",
  "finished_at": null,
  "questions": [
    {
      "id": 101,
      "question": { "id": 55, "number": 55, "text_uzl": "...", "choices": [...], "images": [...] },
      "answered_at": null,
      "selected_choice": null
    }
  ]
}
```

---

#### 10. Sessiya tafsilotini olish

```
GET /api/quiz/sessions/6/
Authorization: Bearer <access_token>
```

**Javob (200):** — Yuqoridagi `POST` javobiga o'xshash, barcha savollar bilan.

---

#### 11. Savolga javob berish

```
POST /api/quiz/sessions/6/answer/
Authorization: Bearer <access_token>
```

**So'rov:**
```json
{
  "session_question_id": 101,
  "choice_id": 281
}
```

**Javob (200):**
```json
{
  "is_correct": false,
  "correct_choice_id": 283,
  "explanation_uzl": "Haydovchi to'g'ri javobni bilishi kerak edi...",
  "explanation_uzk": "Ҳайдовчи тўғри жавобни билиши керак эди...",
  "explanation_ru": "Водитель должен был знать правильный ответ..."
}
```

> Bir savolga **faqat bir marta** javob beriladi. Qayta urinish `400` qaytaradi.

---

#### 12. Imtihonni yakunlash

```
POST /api/quiz/sessions/6/finish/
Authorization: Bearer <access_token>
```

**So'rov:** body kerak emas.

**Javob (200):**
```json
{
  "id": 6,
  "status": "completed",
  "total_questions": 20,
  "score": 18,
  "passed": true,
  "started_at": "2026-04-23T11:30:00Z",
  "finished_at": "2026-04-23T11:45:00Z",
  "questions": [
    {
      "id": 101,
      "question": {
        "id": 55,
        "number": 55,
        "text_uzl": "...",
        "choices": [
          { "id": 281, "text_uzl": "...", "is_correct": false, "order": 1 },
          { "id": 283, "text_uzl": "...", "is_correct": true,  "order": 3 }
        ]
      },
      "answered_at": "2026-04-23T11:32:00Z",
      "selected_choice": 281,
      "is_correct": false
    }
  ]
}
```

> **O'tish mezoni:** `score / total_questions × 100 ≥ 90%`

---

#### 13. Imtihondan chiqish (abandon)

```
POST /api/quiz/sessions/6/abandon/
Authorization: Bearer <access_token>
```

**Javob (200):**
```json
{
  "id": 6,
  "status": "abandoned",
  "total_questions": 20,
  "score": null,
  "passed": null,
  "started_at": "2026-04-23T11:30:00Z",
  "finished_at": "2026-04-23T11:35:00Z"
}
```

---

## Sessiya holat diagrammasi

```
in_progress ──► completed   (POST /finish/)
     │
     └────────► abandoned   (POST /abandon/)
```

---

## Ma'lumotlar modeli

```
Category (42 ta — YHQ bo'limlari)
  name_uzl / name_uzk / name_ru
  └── Question (1223 ta)
        number          — savol raqami (1–1230)
        ticket_number   — bilet raqami (1–123), har birida 10 savol
        text_uzl / text_uzk / text_ru
        explanation_uzl / explanation_uzk / explanation_ru
        difficulty: easy | medium | hard
        ├── Choice (har savolda 3–5 ta variant)
        │     text_uzl / text_uzk / text_ru
        │     is_correct (faqat 1 ta true)
        └── QuestionMedia
              file: /media/questions/images/i{number}_{idx}.jpg

User
  └── ExamSession (status: in_progress | completed | abandoned)
        score, passed (≥90% = true)
        └── SessionQuestion
              order, answered_at, is_correct
              ├── → Question
              └── → Choice (selected_choice)
```

---

## Foydalanuvchi rollari

| Rol | Tavsif |
|-----|--------|
| `user` | Oddiy foydalanuvchi — imtihon topshiradi |
| `support` | Savollar va foydalanuvchilarni ko'radi |
| `admin` | To'liq boshqaruv |

---

## Makefile buyruqlari

```bash
make run              # Django dev server
make celery           # Celery worker
make migrate          # Migratsiyalarni qo'llash
make migrations       # Yangi migratsiya yaratish
make migrations-app app=quiz  # Muayyan app uchun
make superuser        # Superuser yaratish
make shell            # Django shell
make freeze           # requirements.txt yangilash
make schema           # schema.yaml eksport
make check            # Django system check
```

---

## Muhim eslatmalar

- `.env` fayli **hech qachon** git'ga commit qilinmasin — `.gitignore` da mavjud
- Production uchun `DEBUG=False` va kuchli `SECRET_KEY` ishlatilsin
- Celery worker ishlamasa, email OTP yuborilmaydi (server esa ishlayveradi)
- Imtihon jarayonida (`in_progress`) `is_correct` va `explanation` yashiriladi — faqat `finish/` dan keyin ochiladi
- Savollar **3 tilda** saqlangan: `_uzl` (lotin), `_uzk` (kirill), `_ru` (rus)
- `ticket_number` — bilet raqami (1–123), har bir biletda 10 savol mavjud

---

## Deploy to Server (Ubuntu 24.04)

### Server ma'lumotlari

| | |
|---|---|
| IP | 46.101.126.39 |
| OS | Ubuntu 24.04 |
| SSH | `ssh root@46.101.126.39` |

### 1. GitHub'ga push qilish

```bash
git add .
git commit -m "production-ready"
git push origin master
```

### 2. Savollar va rasmlarni serverga ko'chirish

`savollar/` va `images/` papkalari `.gitignore` da — ularni alohida yuklash kerak:

```bash
# Mahalliy kompyuterdan serverga
scp -r ./savollar root@46.101.126.39:/home/prava_go/
scp -r ./images   root@46.101.126.39:/home/prava_go/
```

### 3. Deploy skriptini ishlatish

```bash
# Serverga ulaning
ssh root@46.101.126.39

# deploy.sh ni yuklab oling va ishga tushiring
curl -fsSL https://raw.githubusercontent.com/ibrohim0117/prava-go-real/master/deploy.sh -o deploy.sh
bash deploy.sh
```

Yoki agar savollar va rasmlarni oldin scp bilan ko'chirgan bo'lsangiz:

```bash
ssh root@46.101.126.39
cd /home/prava_go
bash deploy.sh
```

Skript avtomatik bajaradi:
- Server yangilash, paketlar o'rnatish
- 1 GB swap yaratish
- UFW (port 22, 80)
- PostgreSQL: `prava_exam` database, `prava_user` (avtomatik parol)
- Redis, Nginx, Supervisor sozlash
- `git clone`, virtualenv, `pip install`
- `.env` yaratish (SECRET_KEY avtomatik generatsiya)
- `migrate`, `collectstatic`, `createsuperuser`
- `import_questions` — 1223 ta savol 3 tilda
- Gunicorn (2 worker, port 8000)
- Celery worker (concurrency 1)
- Nginx reverse proxy

### 4. Deploy muvaffaqiyatli bo'lgandan keyin tekshiring

| URL | Tavsif |
|-----|--------|
| `http://46.101.126.39/api/docs/` | Swagger UI |
| `http://46.101.126.39/api/redoc/` | ReDoc |
| `http://46.101.126.39/admin/` | Admin panel |

### 5. Loyihani yangilash (keyingi deploylar)

```bash
ssh root@46.101.126.39
cd /home/prava_go

git pull origin master
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

supervisorctl restart prava_go
supervisorctl restart prava_celery
```

### 6. Loglarni kuzatish

```bash
# Gunicorn xatoliklari
tail -f /home/prava_go/logs/gunicorn_error.log

# Celery
tail -f /home/prava_go/logs/celery.log

# Nginx
tail -f /var/log/nginx/error.log

# Barcha xizmatlar holati
supervisorctl status
```

### 7. Foydali buyruqlar

```bash
# Xizmatlarni qayta ishga tushirish
supervisorctl restart prava_go
supervisorctl restart prava_celery

# Savollarni qaytadan import qilish
cd /home/prava_go
source venv/bin/activate
python manage.py import_questions --clear

# Savollar soni tekshirish
python manage.py shell -c "from quiz.models import Question; print(Question.objects.count())"

# Redis tekshirish
redis-cli ping

# PostgreSQL tekshirish
su -c "psql -d prava_exam -c 'SELECT COUNT(*) FROM quiz_question;'" postgres
```
