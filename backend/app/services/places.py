from __future__ import annotations

import re

COUNTRIES = {
    "india", "usa", "us", "united states", "united states of america", "uk", "united kingdom",
    "uae", "united arab emirates", "australia", "china", "japan", "germany", "france", "canada",
    "malaysia", "philippines", "indonesia", "thailand", "vietnam", "sri lanka", "bangladesh",
    "nepal", "pakistan", "south africa", "netherlands", "ireland", "switzerland", "sweden",
    "norway", "denmark", "finland", "spain", "italy", "brazil", "mexico", "korea", "south korea",
    "taiwan", "new zealand", "qatar", "saudi arabia", "kuwait", "oman", "bahrain",
}

CITY_ALIASES = {
    "bangalore": "Bengaluru",
    "bengaluru": "Bengaluru",
    "gurgaon": "Gurugram",
    "gurugram": "Gurugram",
    "bombay": "Mumbai",
    "mumbai": "Mumbai",
    "calcutta": "Kolkata",
    "kolkata": "Kolkata",
    "madras": "Chennai",
    "chennai": "Chennai",
    "new delhi": "New Delhi",
    "delhi": "New Delhi",
    "pune": "Pune",
    "hyderabad": "Hyderabad",
    "noida": "Noida",
    "singapore": "Singapore",
    "dubai": "Dubai",
    "london": "London",
    "new york": "New York",
    "san francisco": "San Francisco",
    "sydney": "Sydney",
    "tokyo": "Tokyo",
}

CITY_ENTRIES = sorted(CITY_ALIASES.items(), key=lambda item: len(item[0]), reverse=True)
COUNTRY_LABELS = {
    "usa": "United States",
    "us": "United States",
    "united states": "United States",
    "uk": "United Kingdom",
    "uae": "UAE",
}


def _as_text(value: object) -> str:
    return str(value or "").strip()


def _key(value: object) -> str:
    return re.sub(r"\s+", " ", _as_text(value).lower().replace(".", "")).strip()


def is_country_name(value: object) -> bool:
    return _key(value) in COUNTRIES


def _looks_like_job_phrase(value: object) -> bool:
    return bool(re.search(r"\b(gcc|head|lead|director|manager|president|officer|chief|vp|svp|evp|cxo)\b", _as_text(value), re.I))


def city_from_text(value: object) -> str | None:
    source = _as_text(value)
    if not source:
        return None
    found: list[str] = []
    for alias, city in CITY_ENTRIES:
        if re.search(rf"\b{re.escape(alias)}\b", source, re.I) and city not in found:
            found.append(city)
    return found[0] if len(found) == 1 else None


def canonical_city(value: object) -> str | None:
    text = _as_text(value)
    if not text:
        return None
    if _looks_like_job_phrase(text) and _key(text) not in CITY_ALIASES:
        return city_from_text(text)
    for part in [p.strip() for p in re.split(r"[,/|]", text) if p.strip()]:
        if is_country_name(part):
            continue
        mapped = CITY_ALIASES.get(_key(part))
        if mapped:
            return mapped
        if 3 <= len(part) <= 40 and re.fullmatch(r"[\w .'-]+", part, re.UNICODE) and not _looks_like_job_phrase(part):
            return re.sub(r"\s+", " ", part)
    return None


def pretty_country(value: object) -> str | None:
    if not is_country_name(value):
        return None
    key = _key(value)
    if key in COUNTRY_LABELS:
        return COUNTRY_LABELS[key]
    return _as_text(value).title()


def pick_place(*values: object) -> str | None:
    cities: list[str] = []
    for value in values:
        city = canonical_city(value)
        if city and city not in cities:
            cities.append(city)
    return cities[0] if cities else None


def preferred_place(*values: object) -> str | None:
    city = pick_place(*values)
    if city:
        return city
    country = pretty_country(next((v for v in values if is_country_name(v)), None))
    if country and country != "India":
        return country
    return None


def display_place(*values: object) -> str:
    return preferred_place(*values) or _as_text(next((v for v in values if _as_text(v)), ""))
