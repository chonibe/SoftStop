# Default pack

## JSON shape

```json
{
  "cooldownHours": {
    "urgency": 24,
    "discount": 24,
    "interruption": 12,
    "reminder": 6
  },
  "typeCap": {
    "urgency": 1,
    "discount": 1,
    "interruption": 2,
    "reminder": 2
  },
  "globalCap": 4,
  "windowHours": 24,
  "stackingWindowMinutes": 10,
  "threshold": 100,
  "decayPerHour": 8,
  "costs": {
    "urgency": 40,
    "discount": 30,
    "interruption": 25,
    "reminder": 15
  }
}
```

## User pressure

| Field | Default | Effect |
|---|---|---|
| `threshold` | 100 | Block when `pressure + cost > threshold` (allow at exact equality) |
| `decayPerHour` | 8 | Linear decay toward 0 |
| `costs.*` | see table | Added on `record` `executed` / `downgraded` |

| Type | Default cost |
|---|---|
| `urgency` | 40 |
| `discount` | 30 |
| `interruption` | 25 |
| `reminder` | 15 |

## Default type limits

| Type | Cooldown | Cap / window |
|---|---|---|
| `urgency` | 24h | 1 |
| `discount` | 24h | 1 |
| `interruption` | 12h | 2 |
| `reminder` | 6h | 2 |

## Global rules (default)

| Rule | Default | Effect |
|---|---|---|
| Window | 24h | Rolling counts for type + global caps |
| Global cap | 4 | Max escalations of any type in the window |
| Stacking window | 10 min | Blocks back-to-back hard pressure |

Pressure is evaluated **before** cooldowns / caps / stacking.

## Presets

| Preset | Threshold | Global cap | Notes |
|---|---|---|---|
| `default` | 100 | 4 | Production starter |
| `strict` | 60 | 2 | Longer cooldowns, lower caps |
| `lenient` | 150 | 10 | Demos / staging |

## What this pack is not

- Not a notification composer  
- Not a discount engine  
- Not an ML optimizer  
- Not MCP tool authorization  

SoftStop authorizes. Your app executes.

## Next

- [Action types](/policies/action-types)
- [Errors](/api/errors)
