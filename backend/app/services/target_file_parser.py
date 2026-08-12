"""Extract one hostname or IPv4 target per row from TXT, CSV, or XLSX files."""

from __future__ import annotations

import csv
import io
import zipfile
from xml.etree import ElementTree

MAX_TARGET_FILE_SIZE = 2 * 1024 * 1024
MAX_TARGETS = 300
_SPREADSHEET_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def _clean(values: list[str]) -> list[str]:
    targets: list[str] = []
    seen: set[str] = set()
    for value in values:
        target = value.strip().lower()
        if not target or target in {"hostname", "host", "domain", "ip", "ip address", "target"}:
            continue
        if target not in seen:
            targets.append(target)
            seen.add(target)
    if not targets:
        raise ValueError("The file does not contain any targets.")
    if len(targets) > MAX_TARGETS:
        raise ValueError(f"Maximum {MAX_TARGETS} targets per file.")
    return targets


def _xlsx_values(data: bytes) -> list[str]:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        if sum(entry.file_size for entry in archive.infolist()) > MAX_TARGET_FILE_SIZE:
            raise ValueError("Expanded Excel content exceeds the 2 MB limit.")
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
            shared_strings = ["".join(node.itertext()) for node in root.findall(f"{_SPREADSHEET_NS}si")]

        sheets = sorted(name for name in archive.namelist() if name.startswith("xl/worksheets/") and name.endswith(".xml"))
        if not sheets:
            raise ValueError("Excel file has no worksheet.")
        root = ElementTree.fromstring(archive.read(sheets[0]))
        values: list[str] = []
        for row in root.findall(f".//{_SPREADSHEET_NS}row"):
            cell = row.find(f"{_SPREADSHEET_NS}c")
            if cell is None:
                continue
            raw = cell.findtext(f"{_SPREADSHEET_NS}v", default="")
            if cell.get("t") == "s" and raw.isdigit():
                values.append(shared_strings[int(raw)] if int(raw) < len(shared_strings) else "")
            elif cell.get("t") == "inlineStr":
                values.append("".join(cell.itertext()))
            else:
                values.append(raw)
        return values


def parse_target_file(filename: str, data: bytes) -> list[str]:
    if not data:
        raise ValueError("The uploaded file is empty.")
    if len(data) > MAX_TARGET_FILE_SIZE:
        raise ValueError("File exceeds the 2 MB limit.")
    name = (filename or "").lower()
    if name.endswith(".xlsx"):
        return _clean(_xlsx_values(data))
    if name.endswith((".txt", ".csv")):
        text = data.decode("utf-8-sig", errors="replace")
        return _clean([cell for row in csv.reader(io.StringIO(text)) for cell in row])
    raise ValueError("Upload a .txt, .csv, or .xlsx file.")
