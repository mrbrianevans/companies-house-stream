# Deploying

Production is one DigitalOcean droplet. Docker Compose runs the app and Caddy terminates TLS. A push to `master` deploys it. The **Deploy** workflow SSHes in and runs the same commands as a manual deploy: fast-forward the checkout, then `docker compose up -d --build`. It then checks that the services are up and prunes dangling images.

The frontend and server build workflows run first. The deploy job runs only after both succeed. Two deploys never run at once; a second push waits, and a deploy that has already started is not cancelled.

Create the secrets below before merging this workflow. Until they exist, the SSH step fails.

## Secrets

Repository secrets: GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

| Secret | Required | Value |
| --- | --- | --- |
| `DEPLOY_HOST` | yes | `companies.stream`, or the droplet IP `159.65.213.133`. DNS is unproxied, so both accept SSH. |
| `DEPLOY_USER` | yes | Unix user that can `git pull` in the checkout and run `docker compose`. Use the account you already deploy as. |
| `DEPLOY_SSH_KEY` | yes | Private half of a dedicated ed25519 key, OpenSSH format, no passphrase. |
| `DEPLOY_PATH` | yes | Absolute path of the git checkout on the droplet (the directory you `cd` into before `git pull`). |
| `DEPLOY_KNOWN_HOSTS` | yes | Host-key lines from `ssh-keyscan` for the same host as `DEPLOY_HOST`. |
| `DEPLOY_PORT` | no | SSH port. Leave the secret unset to use 22. |

Nothing in the workflow hard-codes the host, user, key, or path. The host key is checked with `StrictHostKeyChecking=yes`.

## Deploy key

On your machine:

```bash
ssh-keygen -t ed25519 -C "companies-stream-deploy" -f deploy_key -N ""
```

`-N ""` leaves the key without a passphrase. The workflow has no passphrase secret, so a protected key cannot log in.

Append the public key to that user's `authorized_keys` on the droplet. From your machine:

```bash
ssh USER@companies.stream 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys' < deploy_key.pub
```

`USER` is the account you will store in `DEPLOY_USER`.

Paste the contents of the private file `deploy_key` into the `DEPLOY_SSH_KEY` secret, including the `BEGIN` and `END` lines. Then delete the local private key and keep it out of the repository.

This key is only for GitHub Actions to log into the droplet. `git fetch` on the droplet still uses the remote already configured in that checkout. Leave that GitHub credential in place.

Optional restriction on the `authorized_keys` line. `restrict` disables port forwarding, agent forwarding, X11, and PTYs, and still allows the deploy command:

```
restrict ssh-ed25519 AAAA... companies-stream-deploy
```

Skip a `command=` restriction unless that forced command is the whole deploy. Skip a `from=` restriction too: GitHub-hosted runners publish from a changing address pool, so port 22 has to accept those runners as well as your laptop. If `ufw` or a DigitalOcean cloud firewall limits SSH to your IP, the workflow cannot connect. Key authentication stays required.

`DEPLOY_USER` needs:

- write access to `DEPLOY_PATH` (and to be the owner git will accept, or a `safe.directory` entry)
- a working `git fetch` of `origin`, the same way a manual pull works today
- permission to run Docker without a password prompt, usually by being in the `docker` group

## Host key

`DEPLOY_KNOWN_HOSTS` is the server's public host key, so the runner can refuse a different machine. Scan the same name you stored in `DEPLOY_HOST`:

```bash
ssh-keyscan -t ed25519,ecdsa,rsa companies.stream
```

If `DEPLOY_HOST` is the IP, scan the IP instead. If `DEPLOY_PORT` is not 22, pass `-p` with that port. `ssh-keyscan` then prints `[host]:port` lines, which is what SSH looks up for a non-default port.

Paste the stdout lines into the secret. Skip the `#` comments on stderr. Several lines (ed25519, ecdsa, rsa) are fine; put them all in the one secret.

Confirm the scan against the droplet itself before trusting it. On the droplet:

```bash
ssh-keygen -l -f /etc/ssh/ssh_host_ed25519_key.pub
```

On your machine, save the scan output and fingerprint it:

```bash
ssh-keyscan -t ed25519 companies.stream > /tmp/companies-stream-hostkeys.txt
ssh-keygen -l -f /tmp/companies-stream-hostkeys.txt
```

The `SHA256:` fingerprints should match. Then delete `/tmp/companies-stream-hostkeys.txt` if you don't want it lying around.

## Manual deploy

GitHub → **Actions** → **Deploy** → **Run workflow** → branch **master** → **Run workflow**.

From the CLI, with the `gh` auth that can dispatch this repo:

```bash
gh workflow run deploy.yaml --ref master
```

The manual run uses the same checks and the same SSH script as a push.

## What the SSH step runs

On the droplet, in `DEPLOY_PATH`:

1. Stop if the checkout has uncommitted changes, or if it is not on the branch being deployed. It does not reset or clean the tree.
2. `git fetch`, then `git pull --ff-only` of that branch. A checkout that has diverged fails the job.
3. `docker compose up -d --build`.
4. `docker compose ps`, and fail if any compose service is not running.
5. `curl` `https://companies.stream/events/health` through the local Caddy (Host `companies.stream`, address `127.0.0.1`), up to 12 times, 5 seconds apart. The job fails if it never returns HTTP success. That route is the API `/health` handler behind Caddy. A response can report individual Companies House streams as offline; that does not fail the deploy. Only a failure to get an HTTP success does.
6. `docker image prune -f`, so rebuilt images don't fill the disk. Images still in use are kept.

Containers are set to `restart: unless-stopped`, so a crash or a Docker daemon restart brings them back. A manual `docker compose stop` stays stopped until the next deploy.
