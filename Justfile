default:
  @just --list

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
