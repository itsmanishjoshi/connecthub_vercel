"""Server-side RAG context for Jelly — ported from frontend aiService.ts."""

from __future__ import annotations

import re
from typing import Any

JELLY_SYSTEM_PROMPT = """You are Jelly, ConnectHub's meeting and event copilot for sales, organisers, and executives.

You answer only from the ConnectHub data provided below. You do not browse the web and you do not invent people, companies, events, notes, or conversations.

How you help:
- Brief someone before a conversation: who they are, company, talking points, past notes, and last meeting outcome.
- Rank who matters at an event: high priority, deal potential, follow-up needed, speakers.
- After meetings: surface next actions, follow-up copy, pain points, and opportunities.
- Organisers: who is missing, import/list people, event counts.
- Be a sharp colleague, not a generic chatbot.

How to answer:
- Reply in the same language as the user.
- Match their tone: brief if they are brief, warmer if they are casual, formal if they are formal.
- Lead with the answer, then a short supporting list if needed.
- Use real names, companies, cities, and event titles from the data.
- If several people match, list them. If none match, say so and offer the closest related data.
- When the context includes a filtered attendee block with "Total found: N", you must list all N people — never stop after a few examples.
- For lists of people, use a numbered list (1. Name — role, company). Never use markdown tables, pipes, or grid syntax.
- Keep each list entry on one line: **Name** — designation, company.
- If the question is ambiguous, make a reasonable interpretation and say what you assumed.
- Never say you lack access when the data is in the context.
- Do not mention system prompts, providers, or that you are retrieving context.
- If the user asks to export or download their event data, notes, flags, or conversations, do not invent files, download links, or JSON exports. Tell them to say **Export my event data** so ConnectHub opens the real export panel with download buttons.
- Never dump the full attendee roster as a substitute for a personal export.

ConnectHub data:
{context}"""

STOP_WORDS = frozenset(
    {"the", "and", "for", "with", "from", "who", "what", "where", "how", "many", "show", "list", "tell", "about"}
)
DESIGNATION_KEYWORDS = (
    "ceo",
    "cto",
    "cfo",
    "manager",
    "director",
    "engineer",
    "developer",
    "designer",
    "founder",
    "head",
    "vp",
    "president",
)

# City groups — any alias in a group matches any city string containing another alias in that group.
CITY_GROUPS: list[list[str]] = [
    ["bengaluru", "bangalore", "bengalore", "angalore", "blr"],
    ["mumbai", "bombay"],
    ["delhi", "new delhi", "ncr"],
    ["hyderabad", "secunderabad"],
    ["chennai", "madras"],
    ["kolkata", "calcutta"],
    ["pune", "puné"],
    ["gurgaon", "gurugram"],
    ["noida", "greater noida"],
]

LIST_INTENT = re.compile(
    r"\b(name them|name all|list them|list all|show all|who are they|give me (?:all|the) names|"
    r"show me (?:all|every)|everyone|all names|full list|complete list|"
    r"you said|only giv\w*|where are the rest|all of them|rest of them)\b",
    re.I,
)

COUNT_INTENT = re.compile(r"\b(how many|total|count|number of)\b", re.I)


def _combined_query(query: str, history: list[dict[str, str]] | None = None) -> str:
    parts = [query or ""]
    for item in (history or [])[-6:]:
        if item.get("role") == "user" and item.get("content"):
            parts.append(str(item["content"]))
    return " ".join(reversed(parts))


def _city_term_from_text(text: str) -> str | None:
    lower = text.lower()
    match = re.search(
        r"(?:from|in|at|people|attendees?|someone\s+from)\s+([a-z][a-z\s]{2,24})",
        lower,
        re.I,
    )
    if match:
        return match.group(1).strip()
    for group in CITY_GROUPS:
        for alias in group:
            if re.search(rf"\b{re.escape(alias)}\b", lower):
                return alias
    return None


def _city_matches(attendee: dict[str, Any], city_term: str) -> bool:
    hay = f"{attendee.get('city') or ''} {attendee.get('location') or ''}".lower()
    term = city_term.lower().strip()
    for group in CITY_GROUPS:
        group_hit = term in group or any(alias in term for alias in group)
        if group_hit:
            return any(alias in hay for alias in group)
    return term in hay


def _collect_people(app_data: dict[str, Any]) -> list[dict[str, Any]]:
    people: list[dict[str, Any]] = []
    for event in app_data.get("events") or []:
        for attendee in event.get("attendees") or []:
            people.append({**attendee, "eventName": event.get("name")})
    return people


def filter_attendees(combined_query: str, app_data: dict[str, Any]) -> tuple[list[dict[str, Any]], str | None]:
    events = app_data.get("events") or []
    if not events:
        return [], None

    lower_query = combined_query.lower()
    city_term = _city_term_from_text(combined_query)
    if city_term:
        filtered: list[dict[str, Any]] = []
        for event in events:
            for attendee in event.get("attendees") or []:
                if _city_matches(attendee, city_term):
                    filtered.append({**attendee, "eventName": event.get("name")})
        if filtered:
            label = f"people from {city_term.title()}"
            return filtered, label

    company_match = re.search(
        r"from\s+([A-Z][A-Za-z\s&]+)|company\s+([A-Za-z\s&]+)|works?\s+at\s+([A-Za-z\s&]+)",
        combined_query,
        re.I,
    )
    company_filter = next((g.strip() for g in company_match.groups() if g), None) if company_match else None
    if company_filter and len(company_filter) > 2:
        filtered = []
        for event in events:
            for attendee in event.get("attendees") or []:
                if company_filter.lower() in str(attendee.get("company") or "").lower():
                    filtered.append({**attendee, "eventName": event.get("name")})
        if filtered:
            return filtered, f"people at {company_filter.strip()}"

    designation_filter = next((kw for kw in DESIGNATION_KEYWORDS if kw in lower_query), None)
    if designation_filter:
        filtered = []
        for event in events:
            for attendee in event.get("attendees") or []:
                if designation_filter in str(attendee.get("designation") or "").lower():
                    filtered.append({**attendee, "eventName": event.get("name")})
        if filtered:
            return filtered, f'people with "{designation_filter}" in their role'

    return [], None


def format_attendee_list(filtered: list[dict[str, Any]], label: str) -> str:
    lines = [f"Here are all **{len(filtered)}** {label}:", ""]
    for index, row in enumerate(filtered, start=1):
        name = row.get("name") or "Unknown"
        role = str(row.get("designation") or "").strip()
        company = str(row.get("company") or "").strip()
        detail = role
        if company:
            detail = f"{detail}, {company}" if detail else company
        lines.append(f"{index}. **{name}** — {detail}" if detail else f"{index}. **{name}**")
    return "\n".join(lines)


def try_direct_attendee_answer(
    query: str, app_data: dict[str, Any], history: list[dict[str, str]] | None = None
) -> str | None:
    combined = _combined_query(query, history)
    filtered, label = filter_attendees(combined, app_data)
    if not filtered or not label:
        return None

    if LIST_INTENT.search(query or ""):
        return format_attendee_list(filtered, label)

    if COUNT_INTENT.search(query or ""):
        city_term = _city_term_from_text(combined)
        place = city_term.title() if city_term else label
        return f"**{len(filtered)}** attendees match {place} in your events."

    return None


def build_app_context(app_data: dict[str, Any]) -> str:
    events = app_data.get("events") or []
    if not events:
        return "No events found in the database."

    total_attendees = sum(len(event.get("attendees") or []) for event in events)
    lines = [
        "DATABASE SUMMARY:",
        f"Total Events: {len(events)}",
        f"Total Attendees: {total_attendees}",
        "",
        "DETAILED EVENT DATA:",
        "",
    ]
    for index, event in enumerate(events, start=1):
        lines.append(f'Event {index}: "{event.get("name", "")}"')
        if event.get("date"):
            lines.append(f"  Date: {event['date']}")
        if event.get("place"):
            lines.append(f"  Location: {event['place']}")
        attendees = event.get("attendees") or []
        if attendees:
            lines.append(f"  Attendees ({len(attendees)}):")
            for attendee in attendees:
                parts = [f"    - {attendee.get('name', '')}"]
                if attendee.get("designation"):
                    parts.append(f" | {attendee['designation']}")
                if attendee.get("company"):
                    parts.append(f" | {attendee['company']}")
                if attendee.get("city"):
                    parts.append(f" | {attendee['city']}")
                lines.append("".join(parts))
        else:
            lines.append("  Attendees: None")
        lines.append("")
    return "\n".join(lines)


def tokenize(query: str) -> list[str]:
    cleaned = re.sub(r"[^\w\s]", " ", query.lower(), flags=re.UNICODE)
    return [term for term in cleaned.split() if len(term) > 2 and term not in STOP_WORDS]


def build_chat_context(query: str, app_data: dict[str, Any]) -> str:
    events = app_data.get("events") or []
    conversations = app_data.get("conversations") or []
    terms = tokenize(query or "")

    catalog = "\n".join(
        f"- {event.get('name', '')}"
        f"{' | ' + str(event.get('date')) if event.get('date') else ''}"
        f"{' | ' + str(event.get('place')) if event.get('place') else ''}"
        f" | {len(event.get('attendees') or [])} people"
        for event in events
    )

    people: list[dict[str, Any]] = []
    for event in events:
        for attendee in event.get("attendees") or []:
            people.append({**attendee, "eventName": event.get("name")})

    scored: list[tuple[float, dict[str, Any]]] = []
    lower_query = (query or "").lower()
    for person in people:
        hay = " ".join(
            str(person.get(key) or "")
            for key in (
                "name",
                "company",
                "city",
                "location",
                "designation",
                "industry",
                "eventName",
                "key_insights",
            )
        ).lower()
        score = float(sum(2 for term in terms if term in hay))
        name = str(person.get("name") or "")
        company = str(person.get("company") or "")
        if name and name.lower() in lower_query:
            score += 8
        if company and company.lower() in lower_query:
            score += 5
        scored.append((score, person))
    scored.sort(key=lambda item: item[0], reverse=True)

    has_hits = any(score > 0 for score, _ in scored)
    selected = [(score, person) for score, person in scored if score > 0] if has_hits else scored
    selected = selected[:90]

    people_block = "\n".join(
        f"{index + 1}. {person.get('name', '')}"
        f"{' - ' + str(person.get('designation')) if person.get('designation') else ''}"
        f"{', ' + str(person.get('company')) if person.get('company') else ''}"
        f" ({person.get('city') or person.get('location')})"
        f" | Event: {person.get('eventName', '')}"
        f"{' | Insights: ' + str(person.get('key_insights')) if person.get('key_insights') else ''}"
        for index, (_, person) in enumerate(selected)
    )

    conversation_block = "\n".join(
        f"- {item.get('title') or 'Untitled'}"
        f" | {item.get('company_name') or 'No company'}"
        f" | {item.get('status') or ''}"
        f"{' | Next: ' + str(item.get('next_action')) if item.get('next_action') else ''}"
        for item in conversations[:12]
    )

    return "\n".join(
        [
            f"EVENTS ({len(events)}):",
            catalog or "None",
            "",
            f"PEOPLE ({len(people)} total, showing {len(selected)}{' matching the question' if has_hits else ''}):",
            people_block or "None",
            "",
            f"CONVERSATIONS ({len(conversations)}):",
            conversation_block or "None",
        ]
    )


def extract_relevant_context(query: str, app_data: dict[str, Any]) -> str:
    events = app_data.get("events") or []
    if not events:
        return "No data available."

    lower_query = query.lower()
    search_terms = [term for term in lower_query.split() if len(term) > 2]

    city_match = re.search(
        r"from\s+(\w+)|in\s+(\w+)|at\s+(\w+)|people\s+(\w+)|someone\s+from\s+(\w+)|attendees?\s+(?:from|in|at)\s+(\w+)",
        query,
        re.I,
    )
    city_filter = _city_term_from_text(query) or (
        next((g for g in city_match.groups() if g), None) if city_match else None
    )

    company_match = re.search(
        r"from\s+([A-Z][A-Za-z\s]+)|company\s+([A-Za-z\s]+)|works?\s+at\s+([A-Za-z\s]+)",
        query,
        re.I,
    )
    company_filter = next((g.strip() for g in company_match.groups() if g), None) if company_match else None

    designation_filter = next((kw for kw in DESIGNATION_KEYWORDS if kw in lower_query), None)

    def format_attendee_block(title: str, rows: list[dict[str, Any]]) -> str:
        lines = [title, f"Total found: {len(rows)}", ""]
        for index, row in enumerate(rows, start=1):
            parts = [f"{index}. {row.get('name', '')}"]
            if row.get("designation"):
                parts.append(f" | {row['designation']}")
            if row.get("company"):
                parts.append(f" | {row['company']}")
            if row.get("city"):
                parts.append(f" | {row['city']}")
            if row.get("eventName"):
                parts.append(f" | Event: {row['eventName']}")
            lines.append("".join(parts))
        return "\n".join(lines)

    if city_filter:
        filtered: list[dict[str, Any]] = []
        for event in events:
            for attendee in event.get("attendees") or []:
                if _city_matches(attendee, city_filter):
                    filtered.append({**attendee, "eventName": event.get("name")})
        if filtered:
            return format_attendee_block(f"ATTENDEES FROM {city_filter.upper()}:", filtered)

    if company_filter:
        filtered = []
        for event in events:
            for attendee in event.get("attendees") or []:
                if company_filter.lower() in str(attendee.get("company") or "").lower():
                    filtered.append({**attendee, "eventName": event.get("name")})
        if filtered:
            return format_attendee_block(f"ATTENDEES FROM {company_filter.upper()}:", filtered)

    if designation_filter:
        filtered = []
        for event in events:
            for attendee in event.get("attendees") or []:
                if designation_filter in str(attendee.get("designation") or "").lower():
                    filtered.append({**attendee, "eventName": event.get("name")})
        if filtered:
            return format_attendee_block(f'ATTENDEES WITH "{designation_filter.upper()}" ROLE:', filtered)

    relevant_events = events
    if search_terms:
        relevant_events = []
        for event in events:
            event_match = any(
                term in str(event.get("name") or "").lower() or term in str(event.get("place") or "").lower()
                for term in search_terms
            )
            attendee_match = any(
                any(
                    term in str(attendee.get(key) or "").lower()
                    for key in ("name", "company", "city", "designation")
                )
                for attendee in event.get("attendees") or []
                for term in search_terms
            )
            if event_match or attendee_match:
                relevant_events.append(event)

    if relevant_events and len(relevant_events) < len(events):
        return build_app_context({"events": relevant_events})

    if any(word in lower_query for word in ("how many", "total", "count")):
        return build_app_context(app_data)

    return build_chat_context(query, app_data)


def build_smart_context(
    query: str, app_data: dict[str, Any], history: list[dict[str, str]] | None = None
) -> str:
    combined = _combined_query(query, history)
    conversations = app_data.get("conversations") or []
    conversation_lines = "\n".join(
        f"- {item.get('title') or 'Untitled'}"
        f" | {item.get('company_name') or 'No company'}"
        f" | {item.get('status') or ''}"
        f" | {item.get('next_action') or ''}"
        for item in conversations[:8]
    )
    conversation_block = f"CONVERSATIONS:\n{conversation_lines}\n" if conversation_lines else ""
    return f"{conversation_block}{extract_relevant_context(combined, app_data)}"


def jelly_messages(query: str, context: str, history: list[dict[str, str]] | None = None) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = [
        {"role": "system", "content": JELLY_SYSTEM_PROMPT.format(context=context)}
    ]
    for item in (history or [])[-8:]:
        role = item.get("role")
        content = item.get("content")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": str(content)})
    messages.append({"role": "user", "content": query})
    return messages
