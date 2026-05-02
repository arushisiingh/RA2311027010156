---

## 📦 1. Logging Middleware

A plug-and-play `Log()` function used across the entire codebase. Sends structured logs to the evaluation server with **auto token refresh**.

```js
Log('backend', 'info', 'handler', 'request received')
Log('backend', 'error', 'db', 'connection failed')
```

| Parameter | Values |
|-----------|--------|
| stack | `backend`, `frontend` |
| level | `debug`, `info`, `warn`, `error`, `fatal` |
| package | `handler`, `service`, `db`, `auth`, ... |

---

## 🚗 2. Vehicle Maintenance Scheduler

Solves an **0/1 Knapsack Problem** to optimally schedule vehicle maintenance across depots — maximising operational impact within mechanic-hour budgets.

**Run:**
```bash
cd vehicle_maintence_scheduler
npm install
node index.js
```

**Endpoint:** `GET http://localhost:3000/schedule`

**Sample Output:**
```json
{
  "success": true,
  "schedule": [
    {
      "depotID": 4,
      "mechanicHoursAvailable": 97,
      "totalImpactScore": 141,
      "totalHoursUsed": 96,
      "scheduledTasks": ["uuid1", "uuid2", "..."]
    }
  ]
}
```

---

## 🔔 3. Campus Notification Microservice

Multi-stage system design + implementation for a real-time campus notification platform.

| Stage | What |
|-------|------|
| 1 | REST API design + WebSocket real-time |
| 2 | PostgreSQL schema + scaling strategy |
| 3 | Query optimisation + indexing |
| 4 | Redis caching + pagination |
| 5 | Bulk notification redesign with message queue |
| 6 | **Priority inbox with Min-Heap algorithm** |

### Stage 6 — Priority Inbox

Ranks notifications by type weight + recency using a **min-heap of size N**.