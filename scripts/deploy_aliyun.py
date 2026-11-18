#!/usr/bin/env python3
"""One-shot deploy Companion to a Linux host over SSH. Secrets via env only."""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "123.57.241.90")
USER = os.environ.get("DEPLOY_USER", "root")
PORT = int(os.environ.get("DEPLOY_PORT", "22"))
PASSWORD = os.environ.get("DEPLOY_SSH_PASS", "")
KEY_FILE = os.environ.get("DEPLOY_SSH_KEY", "")
LOCAL_ENV = Path(os.environ.get("DEPLOY_ENV_FILE", Path(__file__).resolve().parents[1] / ".env"))
REMOTE_DIR = "/opt/companion"
REPO = "https://github.com/YanisJiang/Companion.git"


def die(msg: str, code: int = 1) -> None:
    print(f"[deploy] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(code)


def connect() -> paramiko.SSHClient:
    if not PASSWORD and not KEY_FILE:
        die("set DEPLOY_SSH_KEY or DEPLOY_SSH_PASS")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"[deploy] connecting {USER}@{HOST}:{PORT} ...")
    kwargs = dict(
        hostname=HOST,
        port=PORT,
        username=USER,
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )
    if KEY_FILE:
        kwargs["key_filename"] = KEY_FILE
    else:
        kwargs["password"] = PASSWORD
    client.connect(**kwargs)
    return client


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 600, check: bool = True) -> str:
    print(f"[deploy] $ {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout, get_pty=True)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        # truncate huge apt logs a bit
        lines = out.strip().splitlines()
        if len(lines) > 40:
            print("\n".join(lines[:15] + ["..."] + lines[-15:]))
        else:
            print(out.strip())
    if err.strip() and code != 0:
        print(err.strip(), file=sys.stderr)
    if check and code != 0:
        die(f"command failed ({code}): {cmd}")
    return out


def main() -> None:
    if not LOCAL_ENV.is_file():
        die(f"missing local env file: {LOCAL_ENV}")

    client = connect()
    try:
        run(client, "uname -a && cat /etc/os-release | head -n 5")
        run(
            client,
            "export DEBIAN_FRONTEND=noninteractive; "
            "apt-get update -y; "
            "apt-get install -y git curl ca-certificates build-essential python3 nginx",
            timeout=900,
        )

        # Node 20
        run(
            client,
            "if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q v20; then "
            "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -; "
            "apt-get install -y nodejs; "
            "fi; "
            "node -v; npm -v",
            timeout=900,
        )

        run(client, f"mkdir -p {REMOTE_DIR}")
        run(
            client,
            f"if [ -d {REMOTE_DIR}/.git ]; then "
            f"cd {REMOTE_DIR} && git fetch origin && git reset --hard origin/master; "
            f"else git clone {REPO} {REMOTE_DIR}; fi",
            timeout=300,
        )

        # upload .env without printing contents
        sftp = client.open_sftp()
        remote_env = f"{REMOTE_DIR}/.env"
        print(f"[deploy] uploading .env -> {remote_env}")
        sftp.put(str(LOCAL_ENV), remote_env)
        sftp.chmod(remote_env, 0o600)
        sftp.close()

        run(
            client,
            f"cd {REMOTE_DIR} && npm ci && npm run build",
            timeout=900,
        )
        run(client, "npm install -g pm2", timeout=300)
        run(
            client,
            f"cd {REMOTE_DIR} && "
            "pm2 delete companion >/dev/null 2>&1 || true; "
            "NODE_ENV=production pm2 start npm --name companion -- start && "
            "pm2 save && "
            "pm2 startup systemd -u root --hp /root | tail -n 1 | bash || true",
            timeout=180,
        )

        nginx_conf = r"""
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 8m;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
""".strip()

        # write nginx config via sftp
        sftp = client.open_sftp()
        with sftp.file("/etc/nginx/sites-available/companion", "w") as f:
            f.write(nginx_conf + "\n")
        sftp.close()

        run(
            client,
            "rm -f /etc/nginx/sites-enabled/default; "
            "ln -sfn /etc/nginx/sites-available/companion /etc/nginx/sites-enabled/companion; "
            "nginx -t && systemctl enable nginx && systemctl reload nginx",
        )

        # optional ufw
        run(
            client,
            "if command -v ufw >/dev/null 2>&1; then "
            "ufw allow OpenSSH; ufw allow 80/tcp; ufw --force enable || true; "
            "fi",
            check=False,
        )

        time.sleep(2)
        run(client, "pm2 ls")
        run(client, "curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8787/api/health")
        print()
        run(client, "curl -sS http://127.0.0.1/api/health || curl -sS http://127.0.0.1:8787/api/health")
        print("[deploy] done. Try: http://%s/" % HOST)
    finally:
        client.close()


if __name__ == "__main__":
    main()
