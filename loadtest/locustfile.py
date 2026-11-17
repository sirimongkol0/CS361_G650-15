"""Locust scenarios for the CSTU collaboration system.

Three user actions, weighted 40/40/20:
  * list published activities
  * open an activity detail
  * submit feedback (authenticated write)

Environment:
  LOADTEST_HOST           default http://localhost:3000
  LOADTEST_ACCOUNTS_FILE  optional TSV/CSV: email,password (one account per line)
  LOADTEST_EMAIL          fallback single account
  LOADTEST_USER           alias for LOADTEST_EMAIL (course template)
  LOADTEST_PASSWORD       fallback single account
  LOADTEST_STEPS=1        use the 12-minute class shape: 10/20/40 users for
                          2 minutes each, then 80 users for 6 minutes

Examples:
  # one-user smoke test
  LOADTEST_HOST=https://32.189.5.234.sslip.io \
  LOADTEST_ACCOUNTS_FILE=loadtest/accounts.tsv \
  locust -f loadtest/locustfile.py --headless -u 1 -r 1 -t 30s

  # class step test (12 minutes)
  LOADTEST_STEPS=1 LOADTEST_HOST=http://<alb-dns> \
  LOADTEST_ACCOUNTS_FILE=loadtest/accounts.tsv \
  locust -f loadtest/locustfile.py --headless
"""

from __future__ import annotations

import csv
import os
import random
from itertools import count
from pathlib import Path
from uuid import uuid4

from locust import HttpUser, LoadTestShape, between, task

PREFIX = "[LT] "
_account_counter = count()


def _read_accounts() -> list[tuple[str, str]]:
    path = os.getenv("LOADTEST_ACCOUNTS_FILE", "").strip()
    accounts: list[tuple[str, str]] = []
    if path:
        file = Path(path)
        if not file.is_file():
            raise RuntimeError(f"LOADTEST_ACCOUNTS_FILE not found: {file}")
        with file.open(encoding="utf-8") as handle:
            sample = handle.readline()
            handle.seek(0)
            delimiter = "\t" if "\t" in sample else ","
            for row in csv.reader(handle, delimiter=delimiter):
                if not row or row[0].strip().startswith("#"):
                    continue
                if len(row) >= 2 and row[0].strip() and row[1].strip():
                    accounts.append((row[0].strip(), row[1].strip()))
    if not accounts:
        email = (
            os.getenv("LOADTEST_EMAIL", "").strip()
            or os.getenv("LOADTEST_USER", "").strip()
        )
        password = os.getenv("LOADTEST_PASSWORD", "").strip()
        if email and password:
            accounts.append((email, password))
    if not accounts:
        raise RuntimeError(
            "No load-test accounts. Set LOADTEST_ACCOUNTS_FILE or "
            "LOADTEST_EMAIL/LOADTEST_PASSWORD."
        )
    return accounts


ACCOUNTS = _read_accounts()


class CstuUser(HttpUser):
    host = os.getenv("LOADTEST_HOST", "http://localhost:3000")
    wait_time = between(1, 3)

    def on_start(self) -> None:
        self.email, self.password = ACCOUNTS[next(_account_counter) % len(ACCOUNTS)]
        self.token = ""
        self.headers: dict[str, str] = {}
        self.activity_ids: list[int] = []
        self._login()
        self._load_activity_ids()

    def _login(self) -> None:
        response = self.client.post(
            "/api/v1/auth/login",
            json={"email": self.email, "password": self.password},
            name="POST /auth/login",
        )
        if response.status_code != 200:
            raise RuntimeError(
                f"login failed for {self.email}: {response.status_code} {response.text[:200]}"
            )
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def _load_activity_ids(self) -> None:
        response = self.client.get(
            "/api/v1/activities/",
            headers=self.headers,
            name="GET /activities (ids)",
        )
        if response.status_code == 200 and isinstance(response.json(), list):
            self.activity_ids = [row["id"] for row in response.json() if "id" in row]
        if not self.activity_ids:
            self.activity_ids = [1]

    def _request(self, method: str, path: str, name: str, **kwargs):
        response = self.client.request(
            method, path, headers=self.headers, name=name, **kwargs
        )
        if response.status_code == 401:
            self._login()
            response = self.client.request(
                method, path, headers=self.headers, name=name, **kwargs
            )
        return response

    @task(4)
    def list_activities(self) -> None:
        self._request("GET", "/api/v1/activities/", "GET /activities")

    @task(4)
    def activity_detail(self) -> None:
        activity_id = random.choice(self.activity_ids)
        self._request(
            "GET", f"/api/v1/activities/{activity_id}", "GET /activities/{id}"
        )

    @task(2)
    def submit_feedback(self) -> None:
        activity_id = random.choice(self.activity_ids)
        self._request(
            "POST",
            "/api/v1/feedback/",
            "POST /feedback",
            json={
                "title": f"{PREFIX}locust-{uuid4().hex[:12]}",
                "comment": "Load-test feedback; safe to delete.",
                "rating": 5,
                "activity_id": activity_id,
            },
        )


if os.getenv("LOADTEST_STEPS", "").lower() in {"1", "true", "yes", "steps"}:
    class StepLoad(LoadTestShape):
        """12-minute class shape: 10/20/40 users for 2 min, then 80 for 6 min."""

        steps = [(120, 10), (240, 20), (360, 40), (720, 80)]

        def tick(self):
            elapsed = self.get_run_time()
            for end, users in self.steps:
                if elapsed < end:
                    return (users, 5)
            return None
