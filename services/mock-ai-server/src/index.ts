import express from 'express'
import axios from 'axios'

const MIN_DELAY: number = 4000 as const
const MAX_DELAY: number = 8000 as const

const app = express()
app.use(express.json())

const LAMBDA_CALLBACK_URL = process.env.LAMBDA_CALLBACK_URL || 'http://localhost:3004/dev/callback'

const randomDelay = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Helper function to create a delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

app.post('/generate', async (req, res) => {
  try {
    const { prompt, generationId } = req.body

    console.log('Processing generation for prompt: ', prompt)

    const delayMs = randomDelay(MIN_DELAY, MAX_DELAY)
    console.log('Delaying for', delayMs, 'ms')

    // Add a 8-seconds delay before calling the callback
    await delay(delayMs)

    // Trigger Lambda callback
    try {
      const lambdaResponse = await axios.post(LAMBDA_CALLBACK_URL, {
        prompt,
        generationId,
        timestamp: new Date().toISOString(),
      })
      console.log('Successfully triggered Lambda callback with response:', lambdaResponse.data)
      res.status(200).json({ imageUrl: lambdaResponse.data.imageUrl })
    } catch (callbackError) {
      console.error('Failed to trigger Lambda callback:', callbackError)
      throw callbackError
    }

  } catch (error) {
    console.error('Error processing request:', error)
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
    }
    res.status(500).json({ error: 'Failed to process request' })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Mock AI server running on port ${PORT}`)
})
