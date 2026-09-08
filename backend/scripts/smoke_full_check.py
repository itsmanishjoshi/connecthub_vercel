"""Full admin + user API smoke check against live backend."""
from __future__ import annotations

import asyncio
import os
import sys
import uuid

import httpx
from dotenv import dotenv_values
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent


def _load_env() -> None:
    merged: dict[str, str | None] = {}
    for path in (
        BACKEND_ROOT / ".env",
        REPO_ROOT / ".env",
    ):
        if path.exists():
            merged.update(dotenv_values(path))
    for key, value in merged.items():
        if value is not None and str(value).strip():
            os.environ.setdefault(key, value)


_load_env()

BASE = os.getenv("SMOKE_API_BASE", "http://127.0.0.1:8001")
ADMIN_USER = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASSWORD", "1725")


class Check:
    def __init__(self) -> None:
        self.passed: list[str] = []
        self.failed: list[str] = []
        self.warnings: list[str] = []

    def ok(self, name: str, detail: str = "") -> None:
        self.passed.append(f"PASS  {name}" + (f" — {detail}" if detail else ""))

    def fail(self, name: str, detail: str) -> None:
        self.failed.append(f"FAIL  {name} — {detail}")

    def warn(self, name: str, detail: str) -> None:
        self.warnings.append(f"WARN  {name} — {detail}")


async def db(client: httpx.AsyncClient, headers: dict, **body):
    return await client.post(f"{BASE}/api/db", headers=headers, json=body)


async def main() -> int:
    check = Check()
    editor = f"smoke_ed_{uuid.uuid4().hex[:6]}"
    viewer = f"smoke_vw_{uuid.uuid4().hex[:6]}"
    editor_id = viewer_id = None

    async with httpx.AsyncClient(timeout=60) as client:
        # Infrastructure
        try:
            health = (await client.get(f"{BASE}/api/health")).json()
            if health.get("application") == "ok":
                check.ok("Health", f"db={health.get('database')}, ai={health.get('ai')}")
            else:
                check.fail("Health", str(health))
        except Exception as exc:
            check.fail("Health", str(exc))
            print_report(check)
            return 1

        try:
            ready = (await client.get(f"{BASE}/api/ready")).json()
            check.ok("Ready", str(ready.get("ready")))
        except Exception as exc:
            check.fail("Ready", str(exc))

        # Admin auth
        try:
            login = await client.post(
                f"{BASE}/api/auth/login",
                json={"username": ADMIN_USER, "password": ADMIN_PASS},
            )
            if login.status_code != 200:
                check.fail("Admin login", f"HTTP {login.status_code}")
                print_report(check)
                return 1
            admin_token = login.json()["token"]
            admin_h = {"Authorization": f"Bearer {admin_token}"}
            check.ok("Admin login")
        except Exception as exc:
            check.fail("Admin login", str(exc))
            print_report(check)
            return 1

        me = await client.get(f"{BASE}/api/auth/me", headers=admin_h)
        me_body = me.json() if me.status_code == 200 else {}
        is_admin = (me_body.get("user") or {}).get("isAdmin") or (me_body.get("profile") or {}).get("is_admin")
        if me.status_code == 200 and is_admin:
            check.ok("Admin /auth/me", (me_body.get("user") or {}).get("username", ""))
        else:
            check.fail("Admin /auth/me", f"HTTP {me.status_code}")

        # Admin panel APIs
        users = await client.get(f"{BASE}/api/admin/users", headers=admin_h)
        if users.status_code == 200:
            check.ok("Admin list users", f"{len(users.json().get('data') or [])} users")
        else:
            check.fail("Admin list users", f"HTTP {users.status_code}")

        analytics = await client.get(f"{BASE}/api/analytics/dashboard", headers=admin_h)
        if analytics.status_code == 200:
            check.ok("Admin analytics dashboard")
        else:
            check.fail("Admin analytics dashboard", f"HTTP {analytics.status_code}")

        overview = await client.get(f"{BASE}/api/analytics/overview", headers=admin_h)
        if overview.status_code == 200:
            check.ok("Admin analytics overview")
        else:
            check.fail("Admin analytics overview", f"HTTP {overview.status_code}")

        # Resolve event dynamically
        events_resp = await db(
            client,
            admin_h,
            table="events",
            action="select",
            select="id,name,slug",
        )
        events = events_resp.json().get("data") or []
        if not events:
            check.fail("Load events", "no events in database")
            print_report(check)
            return 1
        event = events[0]
        event_id = event["id"]
        event_slug = event.get("slug") or ""
        check.ok("Load events", f"{event.get('name')} ({event_id[:8]}…)")

        # Event access
        access = await client.get(f"{BASE}/api/events/{event_id}/access", headers=admin_h)
        if access.status_code == 200:
            check.ok("Event access list")
        else:
            check.fail("Event access list", f"HTTP {access.status_code}")

        if event_slug:
            by_slug = await client.get(f"{BASE}/api/events/by-slug/{event_slug}", headers=admin_h)
            if by_slug.status_code == 200:
                check.ok("Event by slug", event_slug)
            else:
                check.fail("Event by slug", f"HTTP {by_slug.status_code}")
        else:
            check.warn("Event by slug", "no slug on event")

        # Attendees
        attendees = await db(
            client,
            admin_h,
            table="attendees",
            action="select",
            select="id,name,company,extra_data",
            filters=[{"op": "eq", "column": "event_id", "value": event_id}],
        )
        if attendees.status_code != 200:
            check.fail("Load attendees", f"HTTP {attendees.status_code}")
            print_report(check)
            return 1
        rows = attendees.json().get("data") or []
        if not rows:
            check.fail("Load attendees", "no rows for event")
            print_report(check)
            return 1
        aid = rows[0]["id"]
        check.ok("Load attendees", f"{len(rows)} sampled, first={rows[0].get('name')}")

        # Create test users (admin)
        for username, role_label in ((editor, "editor"), (viewer, "viewer")):
            created = await client.post(
                f"{BASE}/api/admin/users",
                headers=admin_h,
                json={"username": username, "email": f"{username}@smoke.test", "password": "SmokeTest1!"},
            )
            if created.status_code not in (200, 201):
                check.fail(f"Create {role_label} user", f"HTTP {created.status_code}")
                print_report(check)
                return 1
            uid = created.json()["data"]["id"]
            if role_label == "editor":
                editor_id = uid
            else:
                viewer_id = uid
            check.ok(f"Create {role_label} user", username)

        await client.post(
            f"{BASE}/api/events/{event_id}/access",
            headers=admin_h,
            json={"user_id": editor_id, "role": "edit"},
        )
        await client.post(
            f"{BASE}/api/events/{event_id}/access",
            headers=admin_h,
            json={"user_id": viewer_id, "role": "view"},
        )
        check.ok("Grant event access", "edit + view roles")

        editor_login = await client.post(
            f"{BASE}/api/auth/login",
            json={"username": editor, "password": "SmokeTest1!"},
        )
        viewer_login = await client.post(
            f"{BASE}/api/auth/login",
            json={"username": viewer, "password": "SmokeTest1!"},
        )
        editor_h = {"Authorization": f"Bearer {editor_login.json()['token']}"}
        viewer_h = {"Authorization": f"Bearer {viewer_login.json()['token']}"}
        check.ok("User login", "editor + viewer")

        # Editor permissions
        editor_candidates = await client.get(
            f"{BASE}/api/events/{event_id}/access/candidates",
            headers=editor_h,
        )
        if editor_candidates.status_code == 403:
            check.ok("Editor blocked from access admin", "403")
        else:
            check.fail("Editor blocked from access admin", f"HTTP {editor_candidates.status_code}")

        editor_update = await db(
            client,
            editor_h,
            table="attendees",
            action="update",
            filters=[{"op": "eq", "column": "id", "value": aid}],
            data={"company": "SmokeEditorCo"},
        )
        if editor_update.status_code == 200:
            check.ok("Editor can update attendee")
        else:
            check.fail("Editor can update attendee", f"HTTP {editor_update.status_code}")

        viewer_update = await db(
            client,
            viewer_h,
            table="attendees",
            action="update",
            filters=[{"op": "eq", "column": "id", "value": aid}],
            data={"company": "SmokeViewFail"},
        )
        if viewer_update.status_code == 403:
            check.ok("View-only blocked from edit", "403")
        else:
            check.fail("View-only blocked from edit", f"HTTP {viewer_update.status_code}")

        # Notes (user privacy)
        note_insert = await db(
            client,
            editor_h,
            table="attendee_notes",
            action="insert",
            data={"attendee_id": aid, "text": "smoke private note"},
        )
        if note_insert.status_code in (200, 201):
            check.ok("Editor can add note")
        else:
            check.fail("Editor can add note", f"HTTP {note_insert.status_code}")

        admin_reads = await db(
            client,
            admin_h,
            table="attendee_notes",
            action="select",
            select="text",
            filters=[{"op": "eq", "column": "user_id", "value": editor_id}],
        )
        admin_note_count = len(admin_reads.json().get("data") or [])
        if admin_note_count >= 1:
            check.ok("Admin can read user notes", str(admin_note_count))
        else:
            check.fail("Admin can read user notes", "0 notes")

        viewer_reads = await db(
            client,
            viewer_h,
            table="attendee_notes",
            action="select",
            select="text",
            filters=[{"op": "eq", "column": "user_id", "value": editor_id}],
        )
        viewer_note_count = len(viewer_reads.json().get("data") or [])
        if viewer_note_count == 0:
            check.ok("View-only cannot read others' notes")
        else:
            check.fail("View-only cannot read others' notes", str(viewer_note_count))

        user_data = await client.get(f"{BASE}/api/admin/users/{editor_id}/data", headers=admin_h)
        if user_data.status_code == 200:
            check.ok("Admin user data export view")
        else:
            check.fail("Admin user data export view", f"HTTP {user_data.status_code}")

        # User export
        my_export = await client.get(f"{BASE}/api/me/export/events", headers=editor_h)
        if my_export.status_code == 200:
            check.ok("User export events")
        else:
            check.fail("User export events", f"HTTP {my_export.status_code}")

        notes_csv = await client.get(f"{BASE}/api/me/export/notes-csv", headers=editor_h)
        if notes_csv.status_code == 200:
            check.ok("User export notes CSV")
        else:
            check.fail("User export notes CSV", f"HTTP {notes_csv.status_code}")

        # Jelly AI
        if health.get("ai") == "configured":
            jelly = await client.post(
                f"{BASE}/api/ai/jelly/chat",
                headers=editor_h,
                json={"query": "Say OK in one word.", "history": []},
            )
            if jelly.status_code == 200 and jelly.json().get("message"):
                check.ok("Jelly chat", jelly.json()["message"][:60])
            else:
                check.fail("Jelly chat", f"HTTP {jelly.status_code} {jelly.text[:120]}")
        else:
            check.warn("Jelly chat", "AI not configured — skipped")

        jelly_analyze = await client.post(
            f"{BASE}/api/ai/jelly/analyze",
            headers=editor_h,
            json={"query": "mark first attendee as met"},
        )
        if jelly_analyze.status_code == 200:
            check.ok("Jelly analyze intent")
        else:
            check.warn("Jelly analyze intent", f"HTTP {jelly_analyze.status_code}")

        # Repository (admin typically)
        repo = await client.get(f"{BASE}/api/repository/technology/files", headers=admin_h)
        if repo.status_code == 200:
            check.ok("Repository files list")
        else:
            check.warn("Repository files", f"HTTP {repo.status_code}")

        # Cleanup test users
        if editor_id:
            await client.delete(f"{BASE}/api/admin/users/{editor_id}", headers=admin_h)
        if viewer_id:
            await client.delete(f"{BASE}/api/admin/users/{viewer_id}", headers=admin_h)
        check.ok("Cleanup test users")

    print_report(check)
    return 1 if check.failed else 0


def print_report(check: Check) -> None:
    print("\n=== ConnectHub smoke check ===\n")
    for line in check.passed:
        print(line)
    for line in check.warnings:
        print(line)
    for line in check.failed:
        print(line)
    print(f"\nSummary: {len(check.passed)} passed, {len(check.warnings)} warnings, {len(check.failed)} failed")


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
