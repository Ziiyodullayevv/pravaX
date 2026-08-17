# Prava GO — Deploy hujjatnomasi

Loyiha qanday serverga joylashtirilgan, qanday yangilanadi, qaysi xizmatlar ishlaydi va muammolar yuzaga kelganda nima qilish kerakligi haqida to'liq qo'llanma.

> **Server:** `46.101.126.39` (DigitalOcean Droplet, Ubuntu 24.04)
> **Domain:** `https://api.pravax.uz`
> **Repo:** `https://github.com/ibrohim0117/prava-go-real`

---

## Mundarija

1. [Arxitektura — qisqacha tushuntirish](#1-arxitektura--qisqacha-tushuntirish)
2. [Texnologiyalar](#2-texnologiyalar)
3. [Server tuzilishi](#3-server-tuzilishi)
4. [Supervisor jarayonlari (6 ta)](#4-supervisor-jarayonlari-6-ta)
5. [Domain va HTTPS sozlash](#5-domain-va-https-sozlash)
6. [Har kungi deploy](#6-har-kungi-deploy-jarayoni)
7. [Qaysi jarayonni restart qilish kerak?](#7-qaysi-jarayonni-restart-qilish-kerak)
8. [Eng ko'p ishlatiladigan komandalar](#8-eng-kop-ishlatiladigan-komandalar)
9. [Troubleshooting](#9-troubleshooting)
10. [Backup va xavfsizlik](#10-backup-va-xavfsizlik)

---

## 1. Arxitektura — qisqacha tushuntirish

```
┌─────────────────┐     HTTPS      ┌─────────────────────────────────────┐
│  User Telefon   │ ─────────────> │  46.101.126.39 (api.pravax.uz)      │
│  Brauzer        │                │                                     │
│  Mobil ilova    │                │  Nginx (443/80)                     │
└─────────────────┘                │     ↓ proxy_pass                    │
                                   │  Gunicorn (127.0.0.1:8000)          │
                                   │     ↓                               │
                                   │  Django REST API                    │
                                   │     ↓        ↑                      │
                                   │  PostgreSQL  Redis                  │
                                   │              ↑                      │
                                   │  Celery Worker + Beat               │
                                   │  Telegram Bot Pollers (3 ta)        │
                                   └─────────────────────────────────────┘
```

**Sodda tushuntirish:** User HTTPS so'rov yuboradi → Nginx qabul qiladi → Gunicorn'ga uzatadi → Django javob beradi → JSON qaytadi.

Yon jarayonlar (Celery, botlar) doimo orqada ishlaydi.

---

## 2. Texnologiyalar

| Komponent | Vazifasi | Versiya |
|---|---|---|
| **Ubuntu 24.04** | Server OS | LTS |
| **Nginx** | Web server, reverse proxy, SSL termination | 1.24 |
| **Gunicorn** | Django WSGI server | 23.0 |
| **Django** | REST API framework | 6.0 |
| **PostgreSQL** | Asosiy ma'lumotlar bazasi | 16 |
| **Redis** | Cache + Celery broker | 7.4 |
| **Celery** | Asinxron + scheduled tasks | 5.6 |
| **Supervisor** | Jarayonlar boshqaruvi | 4.2 |
| **Certbot** | Bepul SSL (Let's Encrypt) | 2.9 |
| **UFW** | Firewall | latest |

---

## 3. Server tuzilishi

```
/home/prava_go/                            ← loyiha katalogi (git repo)
├── .env                                   ← maxfiy o'zgaruvchilar (gitda yo'q)
├── manage.py
├── venv/                                  ← Python virtual environment
├── requirements.txt
├── root/
│   ├── settings.py
│   ├── celery.py
│   ├── wsgi.py                            ← Gunicorn shu nuqtadan boshlanadi
│   └── urls.py
├── users/, quiz/, tokens/, contests/, payments/, signs/
├── media/                                 ← yuklangan fayllar
│   ├── payments/                          ← to'lov chek rasmlari
│   ├── questions/                         ← savol rasmlari
│   └── signs/                             ← yo'l belgilari (429 ta)
└── staticfiles/                           ← collectstatic natijasi

/var/log/                                  ← har bir jarayon loglari
├── prava_go.out.log         prava_go.err.log
├── prava_celery.out.log     prava_celery.err.log
├── prava_celerybeat.log
├── prava_tgbot.out.log
├── payment_bot_user.out.log payment_bot_user.err.log
└── payment_bot_admin.out.log payment_bot_admin.err.log

/etc/nginx/sites-available/prava_go        ← Nginx config (HTTP+HTTPS)
/etc/supervisor/conf.d/                    ← 6 ta supervisor config
/etc/letsencrypt/live/api.pravax.uz/       ← SSL sertifikat
```

---

## 4. Supervisor jarayonlari (6 ta)

`sudo supervisorctl status` natijasi:

```
payment_bot_admin    RUNNING   pid 12345  ← admin to'lov tasdiqlovchi bot
payment_bot_user     RUNNING   pid 12346  ← foydalanuvchi to'lov yuboradigan bot
prava_celery         RUNNING   pid 12347  ← Celery worker (background tasks)
prava_celerybeat     RUNNING   pid 12348  ← Celery scheduler (vaqtli tasks)
prava_go             RUNNING   pid 12349  ← Django (gunicorn)
prava_tgbot          RUNNING   pid 12350  ← login Telegram bot
```

### Har biri nima qiladi?

#### `prava_go` — Django REST API
```
Komanda: gunicorn root.wsgi:application --bind 127.0.0.1:8000 --workers 3
```
HTTP so'rovlarni qabul qiladi va javob beradi. Hamma `/api/...` endpointlari shu yerda.

#### `prava_celery` — fon tasklari
```
Komanda: celery -A root worker -l info
```
Email yuborish, og'ir hisoblash, contestlarni yakunlash kabi sekin operatsiyalar.

#### `prava_celerybeat` — vaqtli tasklar (scheduler)
```
Komanda: celery -A root beat -l info
```
| Task | Qachon |
|---|---|
| `transition_contests` | har 60 sekundda |
| `create_scheduled_global_contests` | har kuni 00:01 |
| `cleanup_expired_academy_memberships` | har kuni 01:00 |

#### `prava_tgbot` — login bot
```
Komanda: python manage.py run_tg_bot
```
`@pravaX_bot` — foydalanuvchi telefon orqali login qiladi. Polling rejimida.

#### `payment_bot_user` — to'lov bot (user tomon)
```
Komanda: python payment_bot_polling.py --bot user
```
`@pravaXAdminBot` — foydalanuvchi to'lov chekini yuboradi.

#### `payment_bot_admin` — to'lov bot (admin tomon)
```
Komanda: python payment_bot_polling.py --bot admin
```
`@PravaXPayBot` — adminlar tasdiqlash/bekor qilish tugmalarini bosadi.

---

## 5. Domain va HTTPS sozlash

Bu **bir martalik** sozlash — `api.pravax.uz` uchun bajarildi. Boshqa domain qo'shganda yana takrorlanadi.

### 5.1. DNS A record (registrator panelida)

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `api` | `46.101.126.39` | Auto |

Tekshirish:
```bash
dig api.pravax.uz +short
# Natija: 46.101.126.39
```

### 5.2. `.env` ga domain qo'shish

```bash
nano /home/prava_go/.env
# ALLOWED_HOSTS=api.pravax.uz,46.101.126.39,localhost,127.0.0.1
```

### 5.3. Nginx config

`/etc/nginx/sites-available/prava_go`:
```nginx
server {
    listen 80;
    server_name api.pravax.uz 46.101.126.39;

    client_max_body_size 50M;        # to'lov rasmlari uchun

    location /static/ { alias /home/prava_go/staticfiles/; expires 30d; }
    location /media/  { alias /home/prava_go/media/; expires 7d; }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Faollashtirish:
```bash
sudo ln -s /etc/nginx/sites-available/prava_go /etc/nginx/sites-enabled/  # birinchi marta
sudo nginx -t                                  # syntax test
sudo systemctl reload nginx                    # qayta yuklash
```

### 5.4. SSL sertifikat (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.pravax.uz \
    --non-interactive --agree-tos \
    --email ibrohim.dev.uz@gmail.com \
    --redirect
```

`--redirect` — HTTP avtomatik HTTPS'ga aylantiradi.

### 5.5. Firewall'da port 443 ochish

```bash
sudo ufw allow 443/tcp
sudo ufw status
```

### 5.6. Auto-renewal

```bash
sudo systemctl enable --now certbot.timer
sudo certbot renew --dry-run        # tekshirish
```

Sertifikat har 90 kunda avtomatik yangilanadi.

---

## 6. Har kungi deploy jarayoni

Bu siz har safar yangi kod qo'shganda bajaradigan ishlar.

### 6.1. Lokalda — kodni commit + push

```bash
git add -A
git commit -m "feat: yangi feature"
git push origin master
```

### 6.2. Server'da — pull va restart

```bash
ssh root@46.101.126.39
cd /home/prava_go
git pull origin master                    # yangi kodni tortish
source venv/bin/activate                  # venv aktivatsiya
```

**Quyidagi qadamlardan kerak bo'lganlarini bajaring:**

| Vaziyat | Komanda |
|---|---|
| Yangi paket qo'shildi (`requirements.txt`) | `pip install -r requirements.txt` |
| Migration qo'shildi (`migrations/`) | `python manage.py migrate` |
| Static fayllar o'zgardi (admin UI, jazzmin) | `python manage.py collectstatic --noinput` |
| Doim | (keyingi qadam — restart) |

### 6.3. Restart

**Eng xavfsiz — hamma jarayonlarni qaytadan ishga tushirish:**
```bash
sudo supervisorctl restart all
```

Yoki aniq qaysi jarayon kerak bo'lsa — pastroqdagi jadvalga qarang.

### 6.4. Tekshirish

```bash
sudo supervisorctl status                 # hamma jarayon RUNNING bo'lsin
curl -sI https://api.pravax.uz/api/docs/  # 200 OK bo'lsin
sudo tail -20 /var/log/prava_go.err.log   # xato yo'qligini tekshirish
```

---

## 7. Qaysi jarayonni restart qilish kerak?

Bu **eng muhim jadval**. Bir marta meni urgan: `tokens/constants.py` ni o'zgartirib faqat `prava_go` ni restart qildim, lekin `payment_bot_admin` eski qiymatlarni xotirada saqladi va to'lov noto'g'ri token berdi.

| O'zgargan fayl | Restart kerak |
|---|---|
| `*/views.py`, `*/serializers.py`, `*/urls.py` | `prava_go` |
| `*/models.py` (migration bilan) | `prava_go` + `prava_celery` |
| **`tokens/constants.py`, `tokens/services.py`** | **`prava_go` + `payment_bot_admin` + `payment_bot_user` + `prava_celery`** |
| `contests/tasks.py`, `root/settings.py` (CELERY_BEAT_SCHEDULE) | `prava_celery` + `prava_celerybeat` |
| `payments/bot_user.py`, `payments/bot_admin.py`, `payments/services.py` | `payment_bot_user` + `payment_bot_admin` |
| `users/telegram_bot.py` | `prava_tgbot` |
| `root/settings.py` | **Hammasi** (`supervisorctl restart all`) |
| `requirements.txt` (yangi paket) | **Hammasi** |
| `static/` yoki jazzmin | `prava_go` (avval `collectstatic`) |
| Nginx config | `sudo systemctl reload nginx` |

**Qoida:** Shubha bo'lsa — `sudo supervisorctl restart all`. Hech narsa buzmaydi, hammasi ~5 sekundda qaytadan ishga tushadi.

---

## 8. Eng ko'p ishlatiladigan komandalar

### Supervisor

```bash
# Hammasi holati
sudo supervisorctl status

# Bittasini restart
sudo supervisorctl restart prava_go

# Hammasi restart
sudo supervisorctl restart all

# Yangi config qo'shdimi tekshirish
sudo supervisorctl reread
sudo supervisorctl update
```

### Loglar

```bash
# Real-time (jonli kuzatish)
sudo tail -f /var/log/prava_go.out.log
sudo tail -f /var/log/payment_bot_user.out.log
sudo tail -f /var/log/payment_bot_admin.out.log

# Oxirgi 50 qator
sudo tail -50 /var/log/prava_go.err.log

# Ikkala botni bir paytda
sudo tail -f /var/log/payment_bot_*.out.log

# Faqat xatolarni qidirish
sudo grep "ERROR\|Exception" /var/log/prava_go.err.log | tail -20

# Aniq payment bo'yicha
sudo grep "payment#5" /var/log/payment_bot_user.out.log
```

### Nginx

```bash
sudo nginx -t                              # config syntax test
sudo systemctl reload nginx                # config qayta yuklash (downtime'siz)
sudo systemctl restart nginx               # restart (qisqa downtime)
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Django

```bash
cd /home/prava_go && source venv/bin/activate

python manage.py check                     # konfig tekshirish
python manage.py migrate                   # migration qo'llash
python manage.py makemigrations            # yangi migration yaratish
python manage.py collectstatic --noinput   # static fayllarni yig'ish
python manage.py shell                     # interaktiv Python shell
python manage.py createsuperuser           # admin yaratish
```

### Database

```bash
# PostgreSQL'ga kirish
sudo -u postgres psql prava_exam

# Yoki Django orqali
python manage.py dbshell

# Backup
sudo -u postgres pg_dump prava_exam > /tmp/backup_$(date +%Y%m%d).sql

# Qayta tiklash
sudo -u postgres psql prava_exam < /tmp/backup_20260515.sql
```

### Tezkor diagnostika (1 ta komanda)

```bash
sudo supervisorctl status && echo && curl -sI https://api.pravax.uz/api/docs/ | head -3
```

---

## 9. Troubleshooting

### "502 Bad Gateway" brauzer'da

**Sabab:** Gunicorn ishlamayapti yoki Django crash bo'lgan.

```bash
sudo supervisorctl status prava_go
sudo tail -50 /var/log/prava_go.err.log
# Xato topib tuzating, keyin:
sudo supervisorctl restart prava_go
```

### "DisallowedHost: Invalid HTTP_HOST header"

**Sabab:** Domain `ALLOWED_HOSTS` ro'yxatida yo'q.

```bash
nano /home/prava_go/.env
# ALLOWED_HOSTS qatoriga yangi domain qo'shing
sudo supervisorctl restart prava_go
```

### Telegram bot ishlamayapti

**Sabab:** Polling jarayoni to'xtagan yoki webhook qo'yilgan.

```bash
# Status
sudo supervisorctl status prava_tgbot
sudo tail -30 /var/log/prava_tgbot.err.log

# Webhook tekshirish
curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
# url bo'sh bo'lishi kerak. Bo'lmasa:
curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"

sudo supervisorctl restart prava_tgbot
```

### Pending updates ko'p

**Sabab:** Bot polling consume qilmayapti.

```bash
curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo" | python3 -c "import sys,json;print(json.load(sys.stdin)['result']['pending_update_count'])"
```

> 0 bo'lsa polling ishlamayapti. Restart qiling.

### To'lov approve ishlayapti, lekin user noto'g'ri token oladi

**Sabab:** `payment_bot_admin` jarayoni eski `tokens/constants.py` ni xotirada saqlab turibdi.

```bash
sudo supervisorctl restart payment_bot_admin payment_bot_user prava_celery
```

### SSL sertifikat ishlamayapti

```bash
# Sertifikat holati
sudo certbot certificates

# Qayta yangilash (test)
sudo certbot renew --dry-run

# Majburiy yangilash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### Disk to'lib ketdi

```bash
df -h                                      # disk holati
du -sh /var/log/*.log | sort -rh | head    # eng katta loglar
sudo truncate -s 0 /var/log/prava_go.out.log    # log faylni bo'shatish (faylni o'chirmasdan)
```

### Database connection error

```bash
sudo systemctl status postgresql
sudo systemctl restart postgresql
# Keyin Django'ni ham:
sudo supervisorctl restart prava_go prava_celery
```

---

## 10. Backup va xavfsizlik

### Database backup

```bash
# Qo'lda
sudo -u postgres pg_dump prava_exam | gzip > /root/backup_$(date +%Y%m%d_%H%M).sql.gz

# Cron orqali avtomatik (kuniga 1 marta, soat 03:00)
sudo crontab -e
# Qo'shing:
0 3 * * * sudo -u postgres pg_dump prava_exam | gzip > /root/backup_$(date +\%Y\%m\%d).sql.gz && find /root -name "backup_*.sql.gz" -mtime +7 -delete
```

(Yuqoridagi cron 7 kunlik backuplarni saqlab turadi, eskilarni o'chiradi.)

### Media (rasm va PDF) backup

```bash
# Tar arxiv
tar -czf /root/media_$(date +%Y%m%d).tar.gz /home/prava_go/media/

# DigitalOcean Spaces yoki S3 ga yuklash (ixtiyoriy)
```

### `.env` xavfsizligi

`.env` fayli **HECH QACHON git'ga commit qilinmaydi** (`.gitignore`'da). Tokenlar va parollar shu yerda.

Backup:
```bash
sudo cp /home/prava_go/.env /root/.env.backup.$(date +%Y%m%d)
```

### Foydalanuvchi parollari

Django `django.contrib.auth.hashers.PBKDF2PasswordHasher` ishlatadi (default). Akademiya admin parollari ham shu hashing'da. Plaintext parollar **hech qachon DB'da saqlanmaydi**.

### SSH key avtorizatsiyasi

Server'ga faqat `~/.ssh/authorized_keys`'da kalit bor foydalanuvchilar kira oladi. Parol orqali kirish o'chirilgan (yoki o'chirilishi kerak):

```bash
sudo nano /etc/ssh/sshd_config
# PasswordAuthentication no
sudo systemctl restart ssh
```

---

## Yakuniy chek-list (yangi serverga ko'chirishda)

Agar `46.101.126.39` o'rniga yangi serverga ko'chirayotgan bo'lsangiz:

- [ ] Ubuntu o'rnatish
- [ ] `apt install python3 python3-pip python3-venv postgresql redis-server nginx supervisor certbot python3-certbot-nginx git ufw`
- [ ] PostgreSQL'da `prava_exam` DB va `prava_user` user yaratish
- [ ] `git clone <repo> /home/prava_go`
- [ ] `python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt`
- [ ] `.env` faylni yaratish (avvalgi serverdan ko'chirish)
- [ ] `python manage.py migrate`
- [ ] `python manage.py collectstatic --noinput`
- [ ] `python manage.py createsuperuser`
- [ ] 6 ta supervisor config faylini `/etc/supervisor/conf.d/`'ga ko'chirish
- [ ] `sudo supervisorctl reread && sudo supervisorctl update`
- [ ] Nginx config yaratish + symlink + reload
- [ ] DNS A record yangi server IP'ga
- [ ] `certbot --nginx -d api.YOUR_DOMAIN.uz`
- [ ] `ufw allow 22/tcp 80/tcp 443/tcp && ufw enable`
- [ ] DB backup'ni yangi serverga restore qilish
- [ ] Media fayllarni `/home/prava_go/media/`'ga ko'chirish
- [ ] Tekshirish: `sudo supervisorctl status` + `curl -sI https://api.YOUR_DOMAIN.uz/api/docs/`

---

## Qisqa shpargalka (eslab qolish uchun)

```
🚀 Deploy:        cd /home/prava_go && git pull && source venv/bin/activate
                  pip install -r requirements.txt    # agar requirements o'zgardi
                  python manage.py migrate           # agar migration bo'lsa
                  python manage.py collectstatic --noinput  # agar static
                  sudo supervisorctl restart all     # eng xavfsiz

📊 Status:        sudo supervisorctl status

📜 Loglar:        sudo tail -f /var/log/prava_go.out.log
                  sudo tail -f /var/log/payment_bot_*.out.log

🔄 Restart:       sudo supervisorctl restart <name>
                  sudo supervisorctl restart all     # hammasi

🔒 SSL renewal:   sudo certbot renew --dry-run

🌐 Test:          curl -sI https://api.pravax.uz/api/docs/
```

---

**Yana savollar bo'lsa:** `docs/db_schema.md`, `docs/tz.md`, `docs/tz_telegram_login.md` — qo'shimcha hujjatlar.
