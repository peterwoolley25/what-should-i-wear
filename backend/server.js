const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'What Should I Wear API is running!' })
})

// Weather endpoint (we'll implement this next)
app.post('/api/weather', async (req, res) => {
  try {
    const { locations, startTime } = req.body
    // TODO: Fetch weather data
    res.json({ message: 'Weather endpoint - coming soon' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Recommendations endpoint
app.post('/api/recommendations', async (req, res) => {
  try {
    const { activity, weather, effort } = req.body
    // TODO: Generate recommendations
    res.json({ message: 'Recommendations endpoint - coming soon' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})