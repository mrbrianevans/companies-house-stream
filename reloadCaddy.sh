#/bin/bash
# to reload the caddy config with zero down time. Run from ~/app on deployment machine
docker compose exec -w /etc/caddy webserver caddy reload
