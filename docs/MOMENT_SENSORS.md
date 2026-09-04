# Moment sensors (out of scope)

Waze-style send (“Bluetooth connected → push now”) is **not** in SoftStop OSS. SoftStop never pulls location or device events.

If we add it later, keep this split:

1. **Their app** owns sensors (Bluetooth, geofence home, app open).
2. They call `check` on that event, optionally with `context.moment` (`car` | `home` | `app_open`).
3. Policy may treat a hot moment as a lower cost so a send that would `pressure_exceeded` **allows**.
4. Optional `lastMomentAt` on user state from `record` so a later campaign check can still treat a recent moment as a good send.
5. SoftStop still **does not push** to Braze/OneSignal. The app or ESP fires.

Until (1) and (3) exist, do not market Waze on `/spam`. Current product: every deny returns `sendAfter` / a cheaper type — the execution layer reschedules.
