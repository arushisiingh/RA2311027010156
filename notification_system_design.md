# Notification System Design

## Stage 1

### Core Actions
- GET /notifications - fetch all notifications for logged-in user
- PATCH /notifications/:id/read - mark one as read
- PATCH /notifications/read-all - mark all as read
- DELETE /notifications/:id - delete a notification

### Headers
Authorization: Bearer <token>
Content-Type: application/json

### GET /notifications Response
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "Placement | Event | Result",
      "message": "string",
      "isRead": false,
      "timestamp": "2026-04-22T17:51:30Z"
    }
  ],
  "unreadCount": 5
}
```

### Real-time Mechanism
Use WebSockets (Socket.io). When a new notification is created server-side, emit it directly to the connected student's socket room. Each student joins a room named by their studentID on login.

---

## Stage 2

### Database Choice: PostgreSQL
Relational DB fits because notifications have clear structure, we need filtering by studentID + isRead + type, and SQL gives us indexing and query control.

### Schema
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studentID VARCHAR(50) NOT NULL,
  type VARCHAR(20) CHECK (type IN ('Placement', 'Event', 'Result')),
  message TEXT NOT NULL,
  isRead BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

### Problems at Scale
- Table grows huge with 50k students and millions of notifications
- Full table scans become slow without indexes
- Writing 50k rows at once blocks the DB

### Solutions
- Add composite index on (studentID, isRead, createdAt)
- Partition table by month
- Use a message queue for bulk inserts

---

## Stage 3

### Why the query is slow
`SELECT *` fetches all columns including message text which is heavy. No index on studentID + isRead means full table scan on 5M rows.

### Fix
```sql
-- Add this index
CREATE INDEX idx_notifications_student_unread 
ON notifications(studentID, isRead, createdAt DESC);

-- Better query
SELECT id, type, message, createdAt 
FROM notifications 
WHERE studentID = 1042 AND isRead = false 
ORDER BY createdAt DESC;
```

### Adding indexes on every column - bad idea?
No. Indexes slow down writes (INSERT/UPDATE) because each index must be updated. Only index columns you actually filter or sort by.

### Students who got Placement notification in last 7 days
```sql
SELECT DISTINCT studentID 
FROM notifications 
WHERE type = 'Placement' 
AND createdAt >= NOW() - INTERVAL '7 days';
```

---

## Stage 4

### Problem
Fetching notifications on every page load hits DB directly — slow and expensive at scale.

### Solutions

**1. Redis Cache**
Cache each student's notifications with key `notifications:{studentID}`. On page load, serve from cache. Invalidate cache when new notification arrives.
- Tradeoff: slightly stale data possible, but fast reads

**2. Pagination**
Don't fetch all notifications at once. Use limit/offset or cursor-based pagination.
- Tradeoff: more API calls but smaller payloads

**3. CDN/Edge caching**
For static/shared notifications (like announcements), cache at edge.
- Tradeoff: not suitable for personal notifications

Best approach: Redis cache + pagination together.

---

## Stage 5

### Problems with current implementation
- If send_email fails at student 200, the remaining 49800 students never get notified
- save_to_db and send_email happen together — if DB write fails after email sent, data is inconsistent
- Sequential loop is slow — 50k emails sent one by one

### Redesign
Use a message queue (like RabbitMQ or BullMQ):
function notify_all(student_ids, message):
for student_id in student_ids:
queue.push({ student_id, message })  # fast, non-blocking
separate worker processes the queue
worker.process(job):
send_email(job.student_id, job.message)  # retry on failure
save_to_db(job.student_id, job.message)  # after email succeeds
push_to_app(job.student_id, job.message)

### Should DB save and email happen together?
No. Email is external and unreliable. Save to DB first, then send email. If email fails, retry from queue. DB is source of truth.

---

## Stage 6

### Approach: In-memory Min-Heap
Fetch notifications from API, assign priority score, maintain a min-heap of size N. As new notifications come in, push to heap and pop if size exceeds N.

### Priority Score Formula
- Placement: weight 3
- Result: weight 2  
- Event: weight 1

Score = weight * (1 / minutes_since_created + 1)

This balances type importance with recency.

### Why heap and not sort?
Sorting all notifications every time is O(n log n). A heap of size N gives O(log N) insertion — much faster as notifications keep coming in.