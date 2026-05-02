const axios = require('axios')

const BASE_URL = 'http://20.207.122.201/evaluation-service'
const LOG_URL = `${BASE_URL}/logs`

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
  tokenExpiry = res.data.expires_in * 1000
  return cachedToken
}

const VALID_STACKS = ['backend', 'frontend']
const VALID_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal']
const VALID_PACKAGES = ['cache', 'controller', 'cron_job', 'db', 'domain', 'handler', 'repository', 'route', 'service', 'auth', 'config', 'middleware', 'utils']

async function Log(stack, level, pkg, message) {
  if (!VALID_STACKS.includes(stack) || !VALID_LEVELS.includes(level) || !VALID_PACKAGES.includes(pkg)) {
    console.error(`[logger] invalid params: ${stack}, ${level}, ${pkg}`)
    return
  }

  message = message.slice(0, 48)

  try {
    const token = await getToken()
    const res = await axios.post(LOG_URL, {
      stack,
      level,
      package: pkg,
      message
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    return res.data
  } catch (err) {
    console.error('[logger] failed to send log:', err?.response?.data || err.message)
  }
}

module.exports = { Log }