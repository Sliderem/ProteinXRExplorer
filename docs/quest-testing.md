# Testing on Meta Quest 3

**Status (2026-11-21, 0.1.0-alpha.1):** the project owner tested on a physical Meta Quest 3 over a secure public tunnel. VR mode worked well and MR (passthrough) worked even better. Individual controls and frame rate were not recorded, so the checklist below stays open until each item is ticked.

Test results log:

| Date | Device / browser | Result |
|---|---|---|
| 2026-11-21 | Meta Quest 3, Quest Browser, HTTPS tunnel | VR and MR sessions start and run well (owner-reported) |

## Getting HTTPS to the headset

`localhost` is secure on the PC, but `http://192.168.x.x:5173` from the Quest is NOT, so WebXR is disabled there. Options:

1. **Self-signed HTTPS (simplest):** `cd web && npm run dev:https`. Open `https://<PC-LAN-IP>:5173` in the Quest Browser (same Wi-Fi). Accept the certificate warning (Advanced, Proceed). Allow the PC firewall port 5173.
2. **USB reverse port forwarding:** enable Developer Mode, connect by USB, run `adb reverse tcp:5173 tcp:5173`, then open `http://localhost:5173` on the headset (treated as secure).
3. **Secure tunnel** (for example `cloudflared tunnel --url http://localhost:5173`) gives a trusted https URL. It exposes your dev server publicly while running; only use it if you accept that.

## Checklist

- [ ] Page loads, molecule visible, rotating
- [ ] "Enter VR" button appears; "Enter MR" appears (passthrough supported)
- [ ] VR: molecule about 45 cm wide, about 1 m ahead at chest height
- [ ] Walk around it (6DoF) without drift or discomfort
- [ ] Grip or trigger held: molecule follows hand rotation and movement; releasing stops it
- [ ] Thumbstick forward/back scales smoothly; limits respected
- [ ] A/X resets position, rotation, size
- [ ] B/Y exits the session; page returns to the desktop view with correct size
- [ ] MR: background is passthrough; molecule visible
- [ ] Re-enter after exit works; no duplicate pointers or doubled grabs
- [ ] Controller disconnect/reconnect mid-session does not break
- [ ] Reload `/protein/P01012` works
- [ ] Frame rate smooth (no stutter)

Known unknowns: thumbstick axis index and button numbers (A/X = 4, B/Y = 5) follow the xr-standard mapping and need on-device confirmation.
