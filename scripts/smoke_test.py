#!/usr/bin/env python3
"""Smoke-test a running PCSMS Compose stack using only the Python stdlib."""

import argparse
import json
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def get(url: str):
    request = Request(url, headers={"Accept": "application/json"})
    with urlopen(request, timeout=5) as response:
        body = response.read()
        return response.status, body


def wait_for(url: str, attempts: int, delay: float):
    last_error = None
    for _ in range(attempts):
        try:
            status, body = get(url)
            if status == 200:
                return body
            last_error = RuntimeError(f"{url} returned HTTP {status}")
        except (HTTPError, URLError, TimeoutError) as exc:
            last_error = exc
        time.sleep(delay)
    raise RuntimeError(f"{url} did not become ready: {last_error}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="http://localhost:8000/api/v1")
    parser.add_argument("--frontend", default="http://localhost:3000")
    parser.add_argument("--attempts", type=int, default=20)
    parser.add_argument("--delay", type=float, default=2)
    args = parser.parse_args()

    health = json.loads(wait_for(f"{args.api}/health", args.attempts, args.delay))
    if health != {"status": "healthy"}:
        raise RuntimeError(f"unexpected health response: {health!r}")

    for resource in ("partners/", "activities/"):
        payload = json.loads(wait_for(f"{args.api}/{resource}", 1, 0))
        if not isinstance(payload, list) or not payload:
            raise RuntimeError(f"{resource} did not return seeded rows")

    wait_for(f"{args.frontend}/dashboard/public", args.attempts, args.delay)
    print("Smoke test passed: database-backed API and frontend are reachable.")


if __name__ == "__main__":
    main()
