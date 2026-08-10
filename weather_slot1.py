#!/usr/bin/env python3
"""Keep split-flap screen slot 1 updated with current weather.

Runs on your Mac until you stop it with Ctrl+C. Fetches the weather from
wttr.in, formats it for the board, and pushes it to slot 1 on a loop. The
refresh interval also keeps the slot from hitting its 15-minute expiry.
"""
import json
import time
import urllib.request
from datetime import datetime

# --- Config (edit these) ----------------------------------------------------
HOST = "http://192.168.0.17"        # your Pi display
SLOT = 1                            # which screen slot (1-6)
LOCATION = ""                       # e.g. "Seguin" or "78155"; "" = auto by IP
REFRESH_SECONDS = 300               # 5 min: refreshes weather + beats the 15-min expiry
ALIGN = "left"                      # "left" or "center"

# --- Board constraints ------------------------------------------------------
COLS = 24
SEP = "-" * COLS
SUPPORTED = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?-:'\"/()@#$%&*+"


def clean(s):
    """Uppercase and drop characters the board can't show (degree sign, arrows...)."""
    return "".join(c for c in s.upper() if c in SUPPORTED)


def fetch_weather():
    url = f"https://wttr.in/{LOCATION}?format=%C|%t|%h|%w|%p"
    raw = urllib.request.urlopen(url, timeout=10).read().decode().strip()
    condition, temp, humidity, wind, precip = (
        clean(p) for p in (raw.split("|") + ["?"] * 5)[:5]
    )
    return [
        "WEATHER",
        SEP,
        condition or "UNKNOWN",
        f"TEMP {temp}",
        f"HUMIDITY {humidity}",
        f"WIND {wind}",
        f"PRECIP {precip}",
    ]


def push(lines):
    body = json.dumps({"lines": lines, "align": ALIGN}).encode()
    req = urllib.request.Request(
        f"{HOST}/api/screens/{SLOT}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.status


def main():
    print(f"Updating weather -> {HOST} slot {SLOT} every {REFRESH_SECONDS}s. Ctrl+C to stop.")
    while True:
        stamp = datetime.now().strftime("%H:%M:%S")
        try:
            lines = fetch_weather()
            status = push(lines)
            print(f"[{stamp}] pushed ({status}): {lines[2]} / {lines[3]}")
        except Exception as e:
            print(f"[{stamp}] error: {e} - retrying in {REFRESH_SECONDS}s")
        time.sleep(REFRESH_SECONDS)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped.")
