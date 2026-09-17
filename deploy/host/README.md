# Host hardening (Raspberry Pi)

The live split-flap wall display is on **Ethernet** at `splitflap.strout.us`
(`192.168.0.17`) after the 2026-09-16 Wi-Fi cleanup. Dual-Wi-Fi is not the
current path.

These units remain as a leftover safety net if a display Pi is still on Wi-Fi
(`brcmfmac` can stop answering ping/SSH while Docker and the HDMI kiosk keep
running). They are not how this appliance is networked today.

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

## Ethernet is the live path

A cable to `eth0` is how this wall display is on the LAN. The watchdog is a
safety net, not a substitute for wired networking. Wi-Fi powersave / dual-SSID
notes are obsolete for the live appliance; do not treat them as current config.
