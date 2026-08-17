PYTHON = venv/bin/python
MANAGE = $(PYTHON) manage.py

# ─── Server ───────────────────────────────────────────────────────────────────
run:
	$(MANAGE) runserver

run-prod:
	$(MANAGE) runserver 0.0.0.0:8000

# ─── Celery ───────────────────────────────────────────────────────────────────
celery:
	venv/bin/celery -A root worker --loglevel=info

celery-beat:
	venv/bin/celery -A root beat --loglevel=info

# ─── Migrations ───────────────────────────────────────────────────────────────
migrate:
	$(MANAGE) migrate

migrations:
	$(MANAGE) makemigrations

migrations-app:
	$(MANAGE) makemigrations $(app)

showmigrations:
	$(MANAGE) showmigrations

squash:
	$(MANAGE) squashmigrations $(app) $(from) $(to)

# ─── Database ─────────────────────────────────────────────────────────────────
superuser:
	$(MANAGE) createsuperuser

shell:
	$(MANAGE) shell

dbshell:
	$(MANAGE) dbshell

flush:
	$(MANAGE) flush --no-input

# ─── Static & Schema ──────────────────────────────────────────────────────────
static:
	$(MANAGE) collectstatic --no-input

schema:
	$(MANAGE) spectacular --color --file schema.yaml

# ─── Setup ────────────────────────────────────────────────────────────────────
install:
	pip install -r requirements.txt

freeze:
	pip freeze > requirements.txt

venv-create:
	python3 -m venv venv

setup: venv-create install migrate

# ─── Code quality ─────────────────────────────────────────────────────────────
check:
	$(MANAGE) check

lint:
	venv/bin/flake8 .

# ─── Help ─────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  make run              — Django dev server"
	@echo "  make celery           — Celery worker"
	@echo "  make celery-beat      — Celery beat (scheduler)"
	@echo "  make migrate          — Migratsiyalarni qo'llash"
	@echo "  make migrations       — Yangi migratsiya yaratish"
	@echo "  make migrations-app app=users  — Muayyan app uchun"
	@echo "  make superuser        — Superuser yaratish"
	@echo "  make shell            — Django shell"
	@echo "  make freeze           — requirements.txt yangilash"
	@echo "  make schema           — OpenAPI schema.yaml export"
	@echo ""

.PHONY: run run-prod celery celery-beat migrate migrations migrations-app \
        showmigrations squash superuser shell dbshell flush static schema \
        install freeze venv-create setup check lint help
