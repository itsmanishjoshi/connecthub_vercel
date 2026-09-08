from __future__ import annotations

import re

REPLACEMENTS = [
    (re.compile(r"\bpowerplayt?forms?\b", re.I), "Power Platform"),
    (re.compile(r"\bpower\s*play\s*t?forms?\b", re.I), "Power Platform"),
    (re.compile(r"\bpower\s*play\s*form(s)?\b", re.I), "Power Platform"),
    (re.compile(r"\bpowerplay\s*forms?\b", re.I), "Power Platform"),
    (re.compile(r"\bpower\s*plat\s*froms?\b", re.I), "Power Platform"),
    (re.compile(r"\bpower\s*plat\s*forms?\b", re.I), "Power Platform"),
    (re.compile(r"\bmicrosoft\s+power\s+platforms?\b", re.I), "Power Platform"),
    (re.compile(r"\bpower\s*platforms?\b", re.I), "Power Platform"),
    (re.compile(r"\bpower\s*auto\s*mates?\b", re.I), "Power Automate"),
    (re.compile(r"\bpower\s*automate\b", re.I), "Power Automate"),
    (re.compile(r"\bpower\s*bi\b", re.I), "Power BI"),
    (re.compile(r"\bpower\s*pages?\b", re.I), "Power Pages"),
    (re.compile(r"\bpower\s*apps?\b", re.I), "Power Apps"),
    (re.compile(r"\bdata\s*verse\b", re.I), "Dataverse"),
    (re.compile(r"\bdynamics\s*365\b", re.I), "Dynamics 365"),
    (re.compile(r"\bsales\s*force\b", re.I), "Salesforce"),
    (re.compile(r"\bservice\s*now\b", re.I), "ServiceNow"),
    (re.compile(r"\bshare\s*point\b", re.I), "SharePoint"),
    (re.compile(r"\bco\s*pilot\b", re.I), "Copilot"),
]

KNOWN_TOOLS = [
    "Power Platform",
    "Power Apps",
    "Power Automate",
    "Power BI",
    "Power Pages",
    "Dataverse",
    "Dynamics 365",
    "Salesforce",
    "ServiceNow",
    "SharePoint",
    "Copilot",
    "SAP",
    "Excel",
    "Azure",
    "Microsoft Teams",
    "Jira",
    "Confluence",
    "Oracle",
    "Workday",
    "AWS",
    "Tableau",
    "Snowflake",
    "Google Workspace",
]

TOOL_ALIASES = {
    "Power Platform": [
        re.compile(r"powerplayt?forms?", re.I),
        re.compile(r"power\s*play\s*t?forms?", re.I),
        re.compile(r"power\s*plat\s*froms?", re.I),
        re.compile(r"power\s*plat\s*forms?", re.I),
        re.compile(r"power\s*platforms?", re.I),
    ],
    "Power Apps": [re.compile(r"power\s*apps?", re.I)],
    "Power Automate": [re.compile(r"power\s*auto\s*mates?", re.I), re.compile(r"power\s*automate", re.I)],
    "Power BI": [re.compile(r"power\s*bi\b", re.I)],
    "Dataverse": [re.compile(r"data\s*verse", re.I)],
    "Salesforce": [re.compile(r"sales\s*force", re.I)],
    "ServiceNow": [re.compile(r"service\s*now", re.I)],
    "SharePoint": [re.compile(r"share\s*point", re.I)],
}


def correct_business_terms(text: str | None) -> str | None:
    if not text:
        return text
    value = text
    for pattern, replacement in REPLACEMENTS:
        value = pattern.sub(replacement, value)
    return value


def parse_watch_terms(watch_terms: str | None) -> list[str]:
    return [item.strip() for item in re.split(r"[,;\n]", str(watch_terms or "")) if len(item.strip()) >= 2]


def extract_mentioned_tools(text: str | None, watch_terms: str | None = None) -> list[str]:
    haystack = str(text or "")
    corrected = correct_business_terms(haystack) or ""
    names = sorted(set([*KNOWN_TOOLS, *parse_watch_terms(watch_terms)]), key=len, reverse=True)
    found: list[str] = []
    for name in names:
        exact = re.compile(rf"\b{re.escape(name)}\b", re.I)
        if exact.search(corrected) or exact.search(haystack):
            found.append(name)
            continue
        aliases = TOOL_ALIASES.get(name)
        if aliases and any(p.search(haystack) or p.search(corrected) for p in aliases):
            found.append(name)
    return found
