"""Resolve browser/IANA links even when a system ships only canonical zone files."""

from functools import lru_cache
from pathlib import Path
from zoneinfo import TZPATH, ZoneInfo

DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh"


@lru_cache(maxsize=1)
def links():
    result = {}
    for root in TZPATH:
        source = Path(root) / "tzdata.zi"
        if not source.is_file():
            continue
        for line in source.read_text().splitlines():
            fields = line.split()
            if len(fields) >= 3 and fields[0] in ("L", "Link"):
                result[fields[2]] = fields[1]
    return result


def canonical_name(value: str):
    aliases = links()
    while value in aliases:
        value = aliases[value]
    return value


def zone(value: str = DEFAULT_TIMEZONE):
    return ZoneInfo(canonical_name(value))
