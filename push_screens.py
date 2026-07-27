#!/usr/bin/env python3
"""Push live system and weather info to all 6 split-flap screens."""
import json
import subprocess
import urllib.request

HOST = "http://192.168.0.17:8080"
COLS = 24
SEP = "-" * COLS


def run(cmd):
    return subprocess.check_output(cmd, shell=True, text=True).strip()


def weather_screen():
    try:
        raw = urllib.request.urlopen(
            "https://wttr.in/?format=%C|%t|%h|%w|%p", timeout=5
        ).read().decode().strip()
        parts = raw.split("|")
        condition = parts[0] if len(parts) > 0 else "?"
        temp = parts[1] if len(parts) > 1 else "?"
        humidity = parts[2] if len(parts) > 2 else "?"
        wind = parts[3] if len(parts) > 3 else "?"
        precip = parts[4] if len(parts) > 4 else "?"
        return [
            "WEATHER",
            SEP,
            condition.upper(),
            f"TEMP {temp}",
            f"HUMIDITY {humidity}",
            f"WIND {wind}",
            f"PRECIP {precip}",
        ]
    except Exception:
        return ["WEATHER", SEP, "UNAVAILABLE"]


def sun_screen():
    try:
        raw = urllib.request.urlopen(
            "https://wttr.in/?format=%S|%s|%m|%M", timeout=5
        ).read().decode().strip()
        parts = raw.split("|")
        sunrise = parts[0] if len(parts) > 0 else "?"
        sunset = parts[1] if len(parts) > 1 else "?"
        moon_phase = parts[2] if len(parts) > 2 else "?"
        moon_day = parts[3] if len(parts) > 3 else "?"
        return [
            "SUN AND MOON",
            SEP,
            f"SUNRISE  {sunrise}",
            f"SUNSET   {sunset}",
            "",
            f"MOON {moon_phase}",
            f"MOON DAY {moon_day}",
        ]
    except Exception:
        return ["SUN AND MOON", SEP, "UNAVAILABLE"]


def cpu_screen():
    top = run("top -l 1 -n 0 | head -10")
    cpu_line = [l for l in top.splitlines() if "CPU usage" in l]
    load_line = [l for l in top.splitlines() if "Load Avg" in l]
    mem_line = [l for l in top.splitlines() if "PhysMem" in l]

    cpu = "?"
    if cpu_line:
        # extract idle percentage
        parts = cpu_line[0].split(",")
        for p in parts:
            if "idle" in p:
                idle = p.strip().split("%")[0].strip()
                try:
                    cpu = f"{100 - float(idle):.0f}%"
                except ValueError:
                    pass

    load = "?"
    if load_line:
        load = load_line[0].split(":", 1)[1].strip()

    mem_used = "?"
    if mem_line:
        mem_used = mem_line[0].split(":")[1].split("(")[0].strip()

    procs = run("echo $(ps aux | wc -l) PROCESSES")

    return [
        "MAC PERFORMANCE",
        SEP,
        f"CPU USED {cpu}",
        f"LOAD {load}",
        f"RAM {mem_used}",
        procs,
    ]


def system_screen():
    uptime_raw = run("uptime")
    # extract "up X days, H:MM" portion
    up_part = uptime_raw.split("up ")[1].split(",")[0].strip() if "up " in uptime_raw else "?"
    hostname = run("hostname -s").upper()
    chip = run("sysctl -n machdep.cpu.brand_string")
    ram = run("sysctl -n hw.memsize | awk '{printf \"%.0f GB\", $1/1073741824}'")
    os_ver = run("sw_vers -productVersion")

    return [
        "SYSTEM INFO",
        SEP,
        hostname,
        chip.upper(),
        f"RAM {ram}",
        f"MACOS {os_ver}",
        f"UPTIME {up_part}",
    ]


def disk_screen():
    df = run("df -h /").splitlines()[-1].split()
    size = df[1]
    used = df[2]
    avail = df[3]
    pct = df[4]

    return [
        "DISK STORAGE",
        SEP,
        f"TOTAL  {size}",
        f"USED   {used} ({pct})",
        f"FREE   {avail}",
    ]


def network_screen():
    ip = run("ipconfig getifaddr en0 2>/dev/null || echo NO IP")
    wifi = run(
        "networksetup -getairportnetwork en0 2>/dev/null "
        "| sed 's/Current Wi-Fi Network: //' "
        "|| echo ETHERNET"
    )
    # get external IP
    try:
        ext_ip = urllib.request.urlopen(
            "https://api.ipify.org", timeout=3
        ).read().decode().strip()
    except Exception:
        ext_ip = "UNAVAILABLE"

    return [
        "NETWORK",
        SEP,
        f"WIFI {wifi.upper()}",
        f"LOCAL IP",
        f"  {ip}",
        f"EXTERNAL IP",
        f"  {ext_ip}",
    ]


def send(slot, lines, align="left"):
    body = json.dumps({"lines": lines, "align": align}).encode()
    req = urllib.request.Request(
        f"{HOST}/api/screens/{slot}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return resp.status


def main():
    screens = {
        1: weather_screen(),
        2: sun_screen(),
        3: cpu_screen(),
        4: system_screen(),
        5: disk_screen(),
        6: network_screen(),
    }
    for slot, lines in screens.items():
        try:
            print(f"screen {slot}: HTTP {send(slot, lines)}  OK")
            for line in lines:
                print(f"  {line}")
        except Exception as e:
            print(f"screen {slot}: FAILED -- {e}")


if __name__ == "__main__":
    main()
