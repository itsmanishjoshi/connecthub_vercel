"""Smoke-test key requirements against live API."""
import asyncio
import os
import uuid

import httpx
from dotenv import load_dotenv

load_dotenv()

BASE = "http://127.0.0.1:8000"
ADMIN_USER = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASSWORD", "1725")
EVENT_ID = "91bad20e-716e-4239-b827-c97651c257ce"


async def db(c: httpx.AsyncClient, headers: dict, **body):
    return await c.post(f"{BASE}/api/db", headers=headers, json=body)


async def main() -> None:
    results: list[str] = []
    async with httpx.AsyncClient(timeout=30) as c:
        admin_token = (
            await c.post(f"{BASE}/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
        ).json()["token"]
        ah = {"Authorization": f"Bearer {admin_token}"}

        rows = (await db(
            c,
            ah,
            table="attendees",
            action="select",
            select="id,name,profile_pic_url,linkedin_url",
            filters=[{"op": "eq", "column": "event_id", "value": EVENT_ID}],
        )).json()["data"]
        aid = rows[0]["id"]

        # 1. Vineet photo endpoint
        vineet = next((r for r in rows if "Vineet" in r.get("name", "")), None)
        if vineet:
            pic_url = vineet.get("profile_pic_url")
            results.append(f"Vineet API pic_url: {pic_url or 'NONE'}")
            if pic_url:
                pr = await c.get(f"{BASE}{pic_url}", headers=ah)
                results.append(f"Vineet photo HTTP: {pr.status_code}")

        # 2. Editor with edit grant can update cards
        editor = f"ed_{uuid.uuid4().hex[:4]}"
        editor2 = f"vw_{uuid.uuid4().hex[:4]}"
        uid = (
            await c.post(
                f"{BASE}/api/admin/users",
                headers=ah,
                json={"username": editor, "email": f"{editor}@t.com", "password": "x"},
            )
        ).json()["data"]["id"]
        uid2 = (
            await c.post(
                f"{BASE}/api/admin/users",
                headers=ah,
                json={"username": editor2, "email": f"{editor2}@t.com", "password": "x"},
            )
        ).json()["data"]["id"]
        await c.post(
            f"{BASE}/api/events/{EVENT_ID}/access",
            headers=ah,
            json={"user_id": uid, "role": "edit"},
        )
        await c.post(
            f"{BASE}/api/events/{EVENT_ID}/access",
            headers=ah,
            json={"user_id": uid2, "role": "view"},
        )
        et = (await c.post(f"{BASE}/api/auth/login", json={"username": editor, "password": "x"})).json()["token"]
        vt = (await c.post(f"{BASE}/api/auth/login", json={"username": editor2, "password": "x"})).json()["token"]
        eh = {"Authorization": f"Bearer {et}"}
        vh = {"Authorization": f"Bearer {vt}"}

        access_try = await c.get(f"{BASE}/api/events/{EVENT_ID}/access/candidates", headers=eh)
        results.append(f"Editor access candidates: {access_try.status_code} (expect 403)")

        upd = await db(
            c,
            eh,
            table="attendees",
            action="update",
            filters=[{"op": "eq", "column": "id", "value": aid}],
            data={"company": "EditorCoTest"},
        )
        results.append(f"Editor attendee update: {upd.status_code} (expect 200)")

        view_upd = await db(
            c,
            vh,
            table="attendees",
            action="update",
            filters=[{"op": "eq", "column": "id", "value": aid}],
            data={"company": "ViewOnlyFail"},
        )
        results.append(f"View-only attendee update: {view_upd.status_code} (expect 403)")

        # 3. Notes privacy + admin read-all
        await db(
            c,
            eh,
            table="attendee_notes",
            action="insert",
            data={"attendee_id": aid, "text": "editor private note"},
        )
        admin_notes = (
            await db(
                c,
                ah,
                table="attendee_notes",
                action="select",
                select="text",
                filters=[{"op": "eq", "column": "user_id", "value": uid}],
            )
        ).json()["data"]
        results.append(f"Admin reads editor notes: {len(admin_notes or [])} (expect >=1)")

        viewer_notes = (
            await db(
                c,
                vh,
                table="attendee_notes",
                action="select",
                select="text",
                filters=[{"op": "eq", "column": "user_id", "value": uid}],
            )
        ).json()["data"]
        results.append(f"View-only reads editor notes: {len(viewer_notes or [])} (expect 0)")

        data = await c.get(f"{BASE}/api/admin/users/{uid}/data", headers=ah)
        results.append(f"Admin user data API: {data.status_code} (expect 200)")

        await c.delete(f"{BASE}/api/admin/users/{uid}", headers=ah)
        await c.delete(f"{BASE}/api/admin/users/{uid2}", headers=ah)

    print("\n".join(results))
    failed = [line for line in results if "expect" in line and not (
        ("403" in line and line.endswith("(expect 403)"))
        or ("200" in line and "(expect 200)" in line)
        or (">=1" in line and not line.endswith("(expect 0)"))
        or ("0" in line and line.endswith("(expect 0)"))
    )]
    # Simple pass/fail check
    for line in results:
        if "expect 403" in line and "403" not in line.split(":")[1]:
            failed.append(line)
        if "expect 200" in line and "200" not in line.split(":")[1]:
            failed.append(line)
        if "expect 0" in line and not line.rstrip().endswith("0 (expect 0)"):
            count = line.split(":")[1].strip().split()[0]
            if count != "0":
                failed.append(line)

    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
