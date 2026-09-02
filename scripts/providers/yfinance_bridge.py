"""Small JSON bridge between the TypeScript ingestion layer and yfinance."""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any


VOLUME_NOT_MEANINGFUL_SYMBOLS = {
    "DX-Y.NYB",
    "^TNX",
    "^FVX",
    "^TYX",
    "^IRX",
    "^VIX",
    "KRW=X",
    "JPY=X",
}


def parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("dates must use YYYY-MM-DD") from error


def finite_number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--start", required=True, type=parse_date)
    parser.add_argument("--end", type=parse_date)
    parser.add_argument("--interval", choices=["1d"], default="1d")
    args = parser.parse_args()

    try:
        import yfinance as yf
    except ImportError as error:
        raise RuntimeError(
            'yfinance is not installed. Run "pnpm setup:market".'
        ) from error

    cache_directory = Path(
        os.environ.get("YFINANCE_CACHE_DIR", Path.cwd() / ".cache" / "yfinance")
    )
    cache_directory.mkdir(parents=True, exist_ok=True)
    yf.set_tz_cache_location(str(cache_directory))

    history_options: dict[str, Any] = {
        "interval": args.interval,
        "auto_adjust": False,
        "actions": False,
    }
    if args.start == date(1900, 1, 1) and args.end is None:
        history_options["period"] = "max"
    else:
        end_exclusive = args.end + timedelta(days=1) if args.end else None
        history_options["start"] = args.start.isoformat()
        history_options["end"] = (
            end_exclusive.isoformat() if end_exclusive else None
        )

    history = yf.Ticker(args.symbol).history(**history_options)

    rows: list[dict[str, Any]] = []
    for timestamp, candle in history.iterrows():
        close = finite_number(candle.get("Close"))
        if close is None:
            continue

        volume_available = args.symbol not in VOLUME_NOT_MEANINGFUL_SYMBOLS
        row: dict[str, Any] = {
            "timestamp": timestamp.strftime("%Y-%m-%d"),
            "open": finite_number(candle.get("Open")),
            "high": finite_number(candle.get("High")),
            "low": finite_number(candle.get("Low")),
            "close": close,
            "volume": (
                finite_number(candle.get("Volume"))
                if volume_available
                else None
            ),
            "metadata": {
                "interval": args.interval,
                "format": "ohlcv",
                "volume_available": volume_available,
            },
        }
        rows.append(row)

    json.dump({"rows": rows}, sys.stdout, allow_nan=False, separators=(",", ":"))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # The TypeScript caller turns stderr into a typed error.
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from error
