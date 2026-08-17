#!/bin/bash
# Prava GO — Production Deploy Script
# Ubuntu 24.04 | Python 3.12 | PostgreSQL 16 | Redis 7 | Nginx | Supervisor
# Foydalanish: bash deploy.sh

set -e  # Xatolikda to'xta

# ─── Ranglar ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()    { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()     { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()   { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()  { echo -e "${RED}[ERR]${NC}  $1"; }

# ─── Sozlamalar ───────────────────────────────────────────────────────────────
REPO_URL="https://github.com/ibrohim0117/prava-go-real.git"
APP_DIR="/home/prava_go"
APP_NAME="prava_go"
SERVER_IP="46.101.126.39"
DB_NAME="prava_exam"
DB_USER="prava_user"
PYTHON="$APP_DIR/venv/bin/python"
PIP="$APP_DIR/venv/bin/pip"
MANAGE="$PYTHON $APP_DIR/manage.py"

echo ""
echo "================================================================"
echo "   PRAVA GO — Production Deploy"
echo "   Server: $SERVER_IP"
echo "================================================================"
echo ""

# ─── 1. Server yangilash ──────────────────────────────────────────────────────
log "1/10  Server yangilanmoqda..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
ok "Server yangilandi"

# ─── 2. Kerakli paketlar ──────────────────────────────────────────────────────
log "2/10  Paketlar o'rnatilmoqda..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    python3 python3-venv python3-pip \
    postgresql postgresql-contrib \
    redis-server \
    nginx \
    git \
    supervisor \
    curl \
    ufw
ok "Paketlar o'rnatildi"

# ─── 3. Swap fayl (1GB RAM uchun muhim) ──────────────────────────────────────
log "3/10  Swap fayl tekshirilmoqda..."
if [ ! -f /swapfile ]; then
    fallocate -l 1G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    ok "1GB swap fayl yaratildi"
else
    ok "Swap fayl mavjud, o'tkazib yuborildi"
fi

# ─── 4. UFW Firewall ─────────────────────────────────────────────────────────
log "4/10  Firewall sozlanmoqda..."
ufw --force reset > /dev/null 2>&1
ufw default deny incoming > /dev/null 2>&1
ufw default allow outgoing > /dev/null 2>&1
ufw allow 22/tcp > /dev/null 2>&1
ufw allow 80/tcp > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1
ok "UFW: faqat 22 (SSH) va 80 (HTTP) ochiq"

# ─── 5. PostgreSQL ────────────────────────────────────────────────────────────
log "5/10  PostgreSQL sozlanmoqda..."
systemctl start postgresql
systemctl enable postgresql > /dev/null 2>&1

# Kuchli parol generatsiya
DB_PASSWORD=$(python3 -c "import secrets, string; print(''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(24)))")

# Database va user yaratish
su -c "psql -c \"SELECT 1 FROM pg_database WHERE datname='$DB_NAME'\" | grep -q 1 || psql -c \"CREATE DATABASE $DB_NAME;\"" postgres
su -c "psql -c \"SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'\" | grep -q 1 || psql -c \"CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';\"" postgres
su -c "psql -c \"ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';\"" postgres
su -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;\"" postgres
su -c "psql -c \"ALTER DATABASE $DB_NAME OWNER TO $DB_USER;\"" postgres
# PostgreSQL 15+ uchun schema huquqi
su -c "psql -d $DB_NAME -c \"GRANT ALL ON SCHEMA public TO $DB_USER;\"" postgres

ok "PostgreSQL: $DB_NAME / $DB_USER tayyor"

# ─── 6. Redis ─────────────────────────────────────────────────────────────────
log "6/10  Redis ishga tushirilmoqda..."
systemctl start redis-server
systemctl enable redis-server > /dev/null 2>&1
ok "Redis ishlamoqda"

# ─── 7. Loyihani clone qilish ─────────────────────────────────────────────────
log "7/10  Loyiha clone qilinmoqda..."
if [ -d "$APP_DIR/.git" ]; then
    warn "Loyiha mavjud. git pull bajarilmoqda..."
    cd "$APP_DIR" && git pull origin master
else
    rm -rf "$APP_DIR"
    git clone "$REPO_URL" "$APP_DIR"
fi

# Virtual environment
cd "$APP_DIR"
if [ ! -d "$APP_DIR/venv" ]; then
    python3 -m venv "$APP_DIR/venv"
fi

$PIP install --upgrade pip -q
$PIP install -r requirements.txt -q
ok "Loyiha va virtual environment tayyor"

# ─── 8. .env fayl yaratish ────────────────────────────────────────────────────
log "8/10  .env fayl yaratilmoqda..."
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")

cat > "$APP_DIR/.env" << EOF
# Django
SECRET_KEY=$SECRET_KEY
DEBUG=False
ALLOWED_HOSTS=$SERVER_IP,localhost,127.0.0.1

# PostgreSQL
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_HOST=localhost
DB_PORT=5432

# Redis
REDIS_URL=redis://localhost:6379/0

# Email — ishga tushirgandan keyin to'ldiring
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=Prava GO <noreply@prava.go>
EOF

chmod 600 "$APP_DIR/.env"
ok ".env fayl yaratildi (parollar saqlab qo'yildi)"

# Parollarni ko'rsatish
echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │  MUHIM: Quyidagi parollarni saqlang!    │"
echo "  ├─────────────────────────────────────────┤"
echo "  │  DB_USER:     $DB_USER"
echo "  │  DB_PASSWORD: $DB_PASSWORD"
echo "  │  SECRET_KEY:  ${SECRET_KEY:0:20}..."
echo "  └─────────────────────────────────────────┘"
echo ""

# ─── 9. Django setup ──────────────────────────────────────────────────────────
log "9/10  Django sozlanmoqda..."

cd "$APP_DIR"

# Migratsiyalar
log "  → migrate..."
$MANAGE migrate --run-syncdb

# Static fayllar
log "  → collectstatic..."
$MANAGE collectstatic --noinput -v 0

# Media papka huquqlari
mkdir -p "$APP_DIR/media"
ok "Django migrate va collectstatic bajarildi"

# Savollarni import qilish
if [ -d "$APP_DIR/savollar" ]; then
    log "  → Savollar import qilinmoqda (bu biroz vaqt oladi)..."
    $MANAGE import_questions && ok "Savollar import qilindi" || warn "Savollar importda xatolik — keyinroq qo'lda import qiling"

    # Natijani tekshirish
    Q_COUNT=$($MANAGE shell -c "from quiz.models import Question; print(Question.objects.count())" 2>/dev/null || echo "0")
    if [ "$Q_COUNT" -ge 1000 ]; then
        ok "  Savollar soni: $Q_COUNT ✓"
    else
        warn "  Savollar soni: $Q_COUNT (kutilgan: 1223)"
    fi
else
    warn "savollar/ papkasi topilmadi — savollar import qilinmadi"
    warn "Qo'lda upload qiling:"
    warn "  scp -r ./savollar root@$SERVER_IP:$APP_DIR/"
    warn "  scp -r ./images root@$SERVER_IP:$APP_DIR/"
    warn "  ssh root@$SERVER_IP 'cd $APP_DIR && source venv/bin/activate && python manage.py import_questions'"
fi

# Superuser
log "  → Superuser yaratish (interaktiv)..."
$MANAGE createsuperuser

# ─── 10. Gunicorn (Supervisor) ────────────────────────────────────────────────
log "10/10 Supervisor konfiguratsiya..."

# Gunicorn
cat > /etc/supervisor/conf.d/prava_go.conf << EOF
[program:prava_go]
command=$APP_DIR/venv/bin/gunicorn root.wsgi:application --workers 2 --bind 127.0.0.1:8000 --timeout 120 --access-logfile $APP_DIR/logs/gunicorn_access.log --error-logfile $APP_DIR/logs/gunicorn_error.log
directory=$APP_DIR
user=root
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=$APP_DIR/logs/supervisor_gunicorn.log
environment=DJANGO_SETTINGS_MODULE="root.settings"
EOF

# Celery worker
cat > /etc/supervisor/conf.d/prava_celery.conf << EOF
[program:prava_celery]
command=$APP_DIR/venv/bin/celery -A root worker --concurrency=1 --loglevel=info --logfile=$APP_DIR/logs/celery.log
directory=$APP_DIR
user=root
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=$APP_DIR/logs/supervisor_celery.log
environment=DJANGO_SETTINGS_MODULE="root.settings"
EOF

mkdir -p "$APP_DIR/logs"
supervisorctl reread > /dev/null 2>&1
supervisorctl update > /dev/null 2>&1
supervisorctl restart prava_go > /dev/null 2>&1 || supervisorctl start prava_go > /dev/null 2>&1
supervisorctl restart prava_celery > /dev/null 2>&1 || supervisorctl start prava_celery > /dev/null 2>&1
ok "Gunicorn va Celery Supervisor orqali ishga tushdi"

# ─── Nginx ────────────────────────────────────────────────────────────────────
log "Nginx konfiguratsiya..."
rm -f /etc/nginx/sites-enabled/default

cat > /etc/nginx/sites-available/prava_go << EOF
server {
    listen 80;
    server_name $SERVER_IP;

    client_max_body_size 10M;

    location /static/ {
        alias $APP_DIR/staticfiles/;
        expires 30d;
        access_log off;
    }

    location /media/ {
        alias $APP_DIR/media/;
        expires 7d;
        access_log off;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/prava_go /etc/nginx/sites-enabled/prava_go
nginx -t && systemctl restart nginx
systemctl enable nginx > /dev/null 2>&1
ok "Nginx konfiguratsiya qilindi va qayta ishga tushdi"

# ─── Yakuniy tekshiruv ────────────────────────────────────────────────────────
echo ""
echo "================================================================"
echo "   YAKUNIY TEKSHIRUV"
echo "================================================================"

sleep 3  # Xizmatlar to'liq ishga tushishi uchun

# Gunicorn
if supervisorctl status prava_go 2>/dev/null | grep -q RUNNING; then
    ok "Gunicorn: RUNNING ✓"
else
    error "Gunicorn: RUNNING emas — tekshiring: supervisorctl status prava_go"
fi

# Celery
if supervisorctl status prava_celery 2>/dev/null | grep -q RUNNING; then
    ok "Celery:    RUNNING ✓"
else
    warn "Celery:    RUNNING emas — email yuborish ishlamaydi"
fi

# Redis
if redis-cli ping 2>/dev/null | grep -q PONG; then
    ok "Redis:     PONG ✓"
else
    error "Redis: ulanmadi"
fi

# PostgreSQL
if su -c "psql -d $DB_NAME -c 'SELECT 1' -q -t 2>/dev/null" postgres | grep -q 1; then
    ok "PostgreSQL: ulanish ✓"
else
    error "PostgreSQL: ulanib bo'lmadi"
fi

# HTTP tekshiruv
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$SERVER_IP/" 2>/dev/null || echo "0")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
    ok "HTTP $HTTP_CODE: http://$SERVER_IP/ ishlayapti ✓"
else
    warn "HTTP: $HTTP_CODE — Nginx yoki Gunicorn muammosi bo'lishi mumkin"
fi

echo ""
echo "================================================================"
echo "   ENDPOINTLAR"
echo "================================================================"
echo "   Swagger UI:  http://$SERVER_IP/api/docs/"
echo "   ReDoc:       http://$SERVER_IP/api/redoc/"
echo "   Admin:       http://$SERVER_IP/admin/"
echo "================================================================"
echo ""
echo "   Loglar:"
echo "   tail -f $APP_DIR/logs/gunicorn_error.log"
echo "   tail -f $APP_DIR/logs/celery.log"
echo ""
echo "   Xizmatlarni boshqarish:"
echo "   supervisorctl status"
echo "   supervisorctl restart prava_go"
echo "   supervisorctl restart prava_celery"
echo "================================================================"
