import json
import urllib.request
from pathlib import Path

pw = next(
    l.split("=", 1)[1]
    for l in Path("/opt/companion/.env").read_text().splitlines()
    if l.startswith("APP_PASSWORD=")
)
data = json.dumps({"password": pw}).encode()
req = urllib.request.Request(
    "http://127.0.0.1:8787/api/login",
    data=data,
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req) as r:
    sc = r.headers.get("Set-Cookie")
    print("set-cookie:", sc)
    print("has-Secure:", "Secure" in (sc or ""))
    print("body:", r.read().decode())
