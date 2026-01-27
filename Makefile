SHELL := /bin/sh

.PHONY: help install up down reset db-run db-revert db-status seed dev dev-front build test test-e2e lint lint-fix

help:
	@echo "Targets:"
	@echo "  install     Install dependencies (pnpm)"
	@echo "  up          Start local Postgres (docker compose)"
	@echo "  down        Stop local Postgres (docker compose)"
	@echo "  reset       Recreate local Postgres volumes (DANGEROUS)"
	@echo "  db-run      Run TypeORM migrations"
	@echo "  db-revert   Revert last TypeORM migration"
	@echo "  db-status   Show TypeORM migration status"
	@echo "  seed        Seed demo data (countries, rules, tenants, users)"
	@echo "  dev         Run backend (NestJS)"
	@echo "  dev-front   Run frontend (Vite)"
	@echo "  build       Build backend"
	@echo "  test        Run unit tests"
	@echo "  test-e2e    Run e2e tests"
	@echo "  lint        Run eslint"
	@echo "  lint-fix    Run eslint --fix"

install:
	pnpm install

up:
	docker compose up -d

down:
	docker compose down

reset:
	docker compose down -v

db-run:
	pnpm db:run

db-revert:
	pnpm db:revert

db-status:
	pnpm db:status

seed:
	pnpm seed:dev-data

dev:
	pnpm dev

dev-front:
	pnpm dev:front

build:
	pnpm build

test:
	pnpm test

test-e2e:
	pnpm test:e2e

lint:
	pnpm lint

lint-fix:
	pnpm lint:fix
