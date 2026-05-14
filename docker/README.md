# Run
```
cp .env.example .env
docker compose up -d


``

# Logs
```
sudo docker compose logs -f

tail -f /var/log/dyff/dyff.log
tail -f /var/log/dyff/db.log
tail -f /var/log/dyff/agent_debug.log
```