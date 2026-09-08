from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends

from app.database import get_pool
from app.dependencies import api_error, get_current_user
from app.services.analytics import build_org_analytics, build_personal_analytics

router = APIRouter()


@router.get("/api/analytics/dashboard")
async def analytics_dashboard(
    user: dict = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    try:
        analytics = (
            await build_org_analytics(pool)
            if user.get("is_admin")
            else await build_personal_analytics(pool, str(user["id"]))
        )
        return {"analytics": analytics}
    except Exception as error:
        print(f"Analytics error: {error}")
        raise api_error(500, "Could not load analytics")


@router.get("/api/analytics/overview")
async def analytics_overview(
    user: dict = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    try:
        analytics = (
            await build_org_analytics(pool)
            if user.get("is_admin")
            else await build_personal_analytics(pool, str(user["id"]))
        )
        return {"analytics": analytics}
    except Exception as error:
        print(f"Analytics error: {error}")
        raise api_error(500, "Could not load analytics")
