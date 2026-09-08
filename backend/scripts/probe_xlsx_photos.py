import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.people_spreadsheet import _extract_embedded_sheet_photos, people_from_sheet_rows, _workbook_rows


def main() -> None:
    path = BACKEND_ROOT / "uploads" / "private" / "ingest" / "ingest-last.xlsx"
    if len(sys.argv) > 1:
        path = Path(sys.argv[1])
    buffer = path.read_bytes()
    photos = _extract_embedded_sheet_photos(buffer)
    print(f"Embedded photos by sheet row: {len(photos)}")
    for row in sorted(photos.keys())[:10]:
        print(f"  row {row}: {len(photos[row])} bytes")

    sheet_rows = _workbook_rows(buffer, path.name)
    for sheet_name, rows in sheet_rows:
        parsed = people_from_sheet_rows(rows, lambda p: p)
        matched = 0
        for person in parsed["people"]:
            row = person.get("_sheet_row")
            if row in photos:
                matched += 1
        print(f"Sheet {sheet_name}: {len(parsed['people'])} people, {matched} with embedded photos")


if __name__ == "__main__":
    main()
