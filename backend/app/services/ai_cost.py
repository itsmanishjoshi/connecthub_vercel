from __future__ import annotations

import os
from typing import Any


def _float_env(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def get_pricing_rates(tier: str | None = None) -> dict[str, float]:
    """USD per 1M tokens for analytics estimates (configure in backend/.env)."""
    lite = (tier or "").lower() == "lite"
    if lite:
        return {
            "input_per_1m": _float_env("AI_LITE_INPUT_PRICE_PER_1M", 0.15),
            "output_per_1m": _float_env("AI_LITE_OUTPUT_PRICE_PER_1M", 0.60),
        }
    return {
        "input_per_1m": _float_env("AI_INPUT_PRICE_PER_1M", 2.50),
        "output_per_1m": _float_env("AI_OUTPUT_PRICE_PER_1M", 10.00),
    }


def get_pricing_info() -> dict[str, Any]:
    standard = get_pricing_rates("heavy")
    lite = get_pricing_rates("lite")
    return {
        "provider": "estimated",
        "currency": "USD",
        "standard": {
            "label": "Heavy / default tasks",
            "input_per_1m_usd": standard["input_per_1m"],
            "output_per_1m_usd": standard["output_per_1m"],
        },
        "lite": {
            "label": "Lite tasks",
            "input_per_1m_usd": lite["input_per_1m"],
            "output_per_1m_usd": lite["output_per_1m"],
        },
        "note": "Estimated spend from token counts and configured AI pricing rates.",
    }


def estimate_cost_usd(
    tokens_in: int | None,
    tokens_out: int | None,
    *,
    tier: str | None = None,
) -> float:
    rates = get_pricing_rates(tier)
    tin = max(0, int(tokens_in or 0))
    tout = max(0, int(tokens_out or 0))
    cost = (tin / 1_000_000) * rates["input_per_1m"] + (tout / 1_000_000) * rates["output_per_1m"]
    return round(cost, 6)


def _token_split(row: dict[str, Any]) -> tuple[int, int]:
    tin = int(row.get("tokens_in") or 0)
    tout = int(row.get("tokens_out") or 0)
    if tin or tout:
        return tin, tout
    total = int(row.get("tokens") or 0)
    if not total:
        return 0, 0
    tin = int(total * 0.65)
    return tin, total - tin


def cost_for_row(row: dict[str, Any], *, tier: str | None = None) -> float:
    meta = row.get("meta") or {}
    if isinstance(meta, dict) and meta.get("cost_usd") is not None:
        try:
            return round(float(meta["cost_usd"]), 6)
        except (TypeError, ValueError):
            pass
    resolved_tier = tier or (meta.get("tier") if isinstance(meta, dict) else None)
    tin, tout = _token_split(row)
    return estimate_cost_usd(tin, tout, tier=str(resolved_tier) if resolved_tier else None)


def enrich_ai_usage_payload(payload: dict[str, Any]) -> dict[str, Any]:
    summary = dict(payload.get("summary") or {})
    tin, tout = _token_split(summary)
    summary["tokens_in"] = tin or summary.get("tokens_in") or 0
    summary["tokens_out"] = tout or summary.get("tokens_out") or 0
    summary["cost_usd"] = estimate_cost_usd(summary["tokens_in"], summary["tokens_out"])
    payload["summary"] = summary

    for key in ("dailyActivity", "byProvider", "byRoute", "byFeature", "byTask", "byUser"):
        rows = payload.get(key)
        if not isinstance(rows, list):
            continue
        enriched: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            tin, tout = _token_split(item)
            item["tokens_in"] = tin
            item["tokens_out"] = tout
            item["cost_usd"] = cost_for_row(item)
            enriched.append(item)
        payload[key] = enriched

    recent = payload.get("recentLogs")
    if isinstance(recent, list):
        payload["recentLogs"] = [
            {**dict(row), "cost_usd": cost_for_row(dict(row))}
            for row in recent
        ]

    payload["pricing"] = get_pricing_info()
    return payload
