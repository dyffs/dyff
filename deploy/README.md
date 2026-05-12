# Dyff — self-hosted deployment

Run Dyff on a single host with one container plus bundled Postgres and Redis.

## Quick start

```bash
cd deploy/
./setup.sh        # menu-driven; choose 1) Install
```

The installer:
- Generates `.env` with random secrets.
- Prompts for the public URL, port, and admin credentials.
- Optionally configures an egress whitelist (Squid).
- Pulls `dyffs/dyff:latest` and starts everything.

Open the URL it prints. Log in with the admin email/password it generated.

## Files

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage build: Vue frontend + Bun backend + nginx + s6 supervisor |
| `docker-compose.yml` | `dyff` + `postgres` + `redis` + optional `squid` services |
| `nginx.conf` | Serves the SPA and proxies `/api` and `/ping` to the backend |
| `.env.example` | Template env vars (copied to `.env` by `setup.sh`) |
| `setup.sh` | Interactive installer / control script |
| `build.sh` | `docker buildx` build & push to Dockerhub |
| `squid.conf.example` | Outbound allowlist template (LLM + GitHub domains) |
| `s6/` | s6-overlay v3 service definitions (migrate, backend, worker, nginx) |
| `bin/migrate.sh` | Runs DB migrations + admin seed before backend/worker start |

## Common commands

```bash
./setup.sh start      # docker compose up -d
./setup.sh stop       # docker compose down
./setup.sh restart
./setup.sh upgrade    # pulls latest image and recreates
./setup.sh logs       # tails compose logs
./setup.sh backup     # pg_dump + tar of git/asset volumes
```

`setup.sh` also accepts these as positional args, so you can wire it into
cron, systemd, etc.

## Building & releasing the image

```bash
# Build & push :<git-sha> and :latest to dyffs/dyff (amd64)
./deploy/build.sh

# Add arm64 when ready
PLATFORMS=linux/amd64,linux/arm64 ./deploy/build.sh

# Tag a release
TAG=v0.3.0 ./deploy/build.sh
```

The same script runs unchanged in CI; only `docker login` differs per
environment.

### Apple Silicon

amd64-only images run on M-series Macs via Rosetta 2 (Docker Desktop is
transparent about it). Native arm64 is faster — when you want it, just add
`linux/arm64` to `PLATFORMS`.

## Volumes

| Volume | Mount | Holds |
|---|---|---|
| `postgres_data` | `/var/lib/postgresql/data` | DB |
| `git_data` | `/data/git_repos` | Cloned repos |
| `asset_data` | `/data/github_assets` | Cached GitHub assets |
| `dyff_logs` | `/var/log/dyff` | Agent debug logs |

## Egress whitelist (Squid)

If you enable Squid during install, the backend's `HTTP_PROXY` and
`HTTPS_PROXY` are pointed at `http://squid:3128`, and only the domains in
`squid.conf` can be reached. Defaults cover OpenAI, Anthropic, Google AI,
xAI, and GitHub. Edit `squid.conf` and `./setup.sh restart` to apply.

## External Postgres / Redis

During `./setup.sh install`, answer "n" when asked to use bundled services.
You'll be prompted for connection details, which are written to `.env`.
The bundled service will still be defined in compose but will not be
started; if you want to drop it from compose entirely, edit
`docker-compose.yml` and remove the service block.
