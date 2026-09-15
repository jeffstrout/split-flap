# Host hardening (Raspberry Pi)

Wi-Fi-only Pis (especially with `brcmfmac`) can stop answering ping/SSH while
Docker and the HDMI kiosk keep running. These units make the next failure
debuggable and self-recovering.

| Piece | What it does |
| --- | --- |
| Persistent `journald` | Keeps logs across reboots (`SystemMaxUse=200M`) |
| Gateway watchdog | Pings the default gateway every minute; reboots after **5** consecutive failures (~5 minutes) |

## Install (on the Pi)

From a git checkout of this repo:

```bash
sudo ./deploy/host/install-host-hardening.sh
```

## Verify

```bash
systemctl status gateway-watchdog.timer
cat /var/lib/gateway-watchdog/fail_count    # should be 0 when healthy
journalctl --list-boots                    # previous boots appear after a reboot
sudo tail -f /var/log/gateway-watchdog.log # only written on failures / recovery
```

## Prefer Ethernet

A cable to `eth0` is more reliable than Wi-Fi for an unattended wall display.
The watchdog is a safety net, not a substitute for wired networking.

Powersave should stay off (NetworkManager `wifi.powersave = 2`); the install
script does not change Wi-Fi config — see the live appliance or PI-SETUP.
