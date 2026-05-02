const axios = require('axios')
const { Log } = require('../logging_middleware/logger')

const BASE_URL = 'http://20.207.122.201/evaluation-service'
const CREDS = {
  email: 'as2287@srmist.edu.in',
  name: 'Arushi Singh',
  rollNo: 'RA2311027010156',
  accessCode: 'QkbpxH',
  clientID: '82f03ccf-b719-426c-97bb-1d4649826fa7',
  clientSecret: 'wDyEzNEeRzYDDZNX'
}

let cachedToken = null
let tokenExpiry = 0

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken
  const res = await axios.post(`${BASE_URL}/auth`, CREDS)
  cachedToken = res.data.access_token
  tokenExpiry = res.data.expires_in
  return cachedToken
}

// higher = more important
const TYPE_WEIGHT = { Placement: 3, Result: 2, Event: 1 }

function scoreNotification(n) {
  const weight = TYPE_WEIGHT[n.Type] || 1
  const ageMinutes = (Date.now() - new Date(n.Timestamp).getTime()) / 60000
  return weight * (1 / (ageMinutes + 1))
}

// min-heap by score
class MinHeap {
  constructor(maxSize) {
    this.maxSize = maxSize
    this.heap = []
  }

  push(item) {
    this.heap.push(item)
    this.heap.sort((a, b) => a.score - b.score)
    if (this.heap.length > this.maxSize) {
      this.heap.shift() // remove lowest score
    }
  }

  getTop() {
    return this.heap.slice().sort((a, b) => b.score - a.score)
  }
}

async function getTopNotifications(n = 10) {
  await Log('backend', 'info', 'service', 'fetching notifications from API')

  const token = await getToken()
  const res = await axios.get(`${BASE_URL}/notifications`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const notifications = res.data.notifications
  await Log('backend', 'debug', 'service', `got ${notifications.length} notifications`)

  const heap = new MinHeap(n)

  for (const notif of notifications) {
    const score = scoreNotification(notif)
    heap.push({ ...notif, score })
  }

  const top = heap.getTop()
  await Log('backend', 'info', 'service', `top ${n} notifications selected`)
  return top
}

// run it
getTopNotifications(10).then(top => {
  console.log(`\nTop 10 Priority Notifications:\n`)
  top.forEach((n, i) => {
    console.log(`${i + 1}. [${n.Type}] ${n.Message} (score: ${n.score.toFixed(4)})`)
  })
}).catch(err => {
  console.error('failed:', err.message)
})