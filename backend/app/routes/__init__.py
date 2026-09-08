from __future__ import annotations

from fastapi import APIRouter

from app.routes import (
    admin,
    ai_routes,
    analytics_routes,
    auth_routes,
    conversations,
    db_routes,
    events,
    export_routes,
    health,
    integrations_routes,
    media_routes,
    people_routes,
    repository_routes,
    storage,
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth_routes.router)
api_router.include_router(media_routes.router)
api_router.include_router(admin.router)
api_router.include_router(events.router)
api_router.include_router(export_routes.router)
api_router.include_router(integrations_routes.router)
api_router.include_router(analytics_routes.router)
api_router.include_router(ai_routes.router)
api_router.include_router(people_routes.router)
api_router.include_router(conversations.router)
api_router.include_router(repository_routes.router)
api_router.include_router(storage.router)
api_router.include_router(db_routes.router)
