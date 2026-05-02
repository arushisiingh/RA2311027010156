const express = require('express')
const axios = require('axios')
const { Log } = require('../logging_middleware/logger')

const app = express()
app.use(express.json())

const BASE_URL = 'http://20.207.122.201/evaluation-service'
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJhczIyODdAc3JtaXN0LmVkdS5pbiIsImV4cCI6MTc3NzcwMDYwNCwiaWF0IjoxNzc3Njk5NzA0LCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiYzUwMWE5YzAtZjcwNi00NTU0LTgxOTEtZGVjMDZlN2Q1YTRjIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoiYXJ1c2hpIHNpbmdoIiwic3ViIjoiODJmMDNjY2YtYjcxOS00MjZjLTk3YmItMWQ0NjQ5ODI2ZmE3In0sImVtYWlsIjoiYXMyMjg3QHNybWlzdC5lZHUuaW4iLCJuYW1lIjoiYXJ1c2hpIHNpbmdoIiwicm9sbE5vIjoicmEyMzExMDI3MDEwMTU2IiwiYWNjZXNzQ29kZSI6IlFrYnB4SCIsImNsaWVudElEIjoiODJmMDNjY2YtYjcxOS00MjZjLTk3YmItMWQ0NjQ5ODI2ZmE3IiwiY2xpZW50U2VjcmV0Ijoid0R5RXpORWVSellERFpOWCJ9.5goPCXsaYIAWvDH2DVyXAQrXzH1oqto4cWGdh0sifaM'

const headers = { Authorization: `Bearer ${TOKEN}` }

function pickBestTasks(tasks, maxHours) {
  const n = tasks.length
  const dp = Array.from({ length: n + 1 }, () => new Array(maxHours + 1).fill(0))

  for (let i = 1; i <= n; i++) {
    const task = tasks[i - 1]
    for (let w = 0; w <= maxHours; w++) {
      dp[i][w] = dp[i - 1][w]
      if (task.Duration <= w) {
        const withThis = dp[i - 1][w - task.Duration] + task.Impact
        if (withThis > dp[i][w]) dp[i][w] = withThis
      }
    }
  }

  let w = maxHours
  const selected = []
  for (let i = n; i >= 1; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(tasks[i - 1])
      w -= tasks[i - 1].Duration
    }
  }

  return { selected, totalImpact: dp[n][maxHours] }
}

app.get('/schedule', async (req, res) => {
  try {
    await Log('backend', 'info', 'handler', 'schedule request received')

    const [depotsRes, vehiclesRes] = await Promise.all([
      axios.get(`${BASE_URL}/depots`, { headers }),
      axios.get(`${BASE_URL}/vehicles`, { headers })
    ])

    const depots = depotsRes.data.depots
    const vehicles = vehiclesRes.data.vehicles

    await Log('backend', 'debug', 'service', `${depots.length} depots fetched`)

    const result = depots.map(depot => {
      const { selected, totalImpact } = pickBestTasks(vehicles, depot.MechanicHours)
      return {
        depotID: depot.ID,
        mechanicHoursAvailable: depot.MechanicHours,
        totalImpactScore: totalImpact,
        totalHoursUsed: selected.reduce((sum, t) => sum + t.Duration, 0),
        scheduledTasks: selected.map(t => t.TaskID)
      }
    })

    await Log('backend', 'info', 'handler', 'scheduling done for all depots')
    res.json({ success: true, schedule: result })

  } catch (err) {
    await Log('backend', 'error', 'handler', `schedule failed: ${err.message}`)
    res.status(500).json({ error: 'something went wrong', detail: err.message })
  }
})

app.listen(3000, () => {
  console.log('server up on http://localhost:3000')
})