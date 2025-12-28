import express from 'express'
import axios from 'axios'

/** Minimum delay in milliseconds before processing the generation request */
const MIN_DELAY: number = 4000 as const

/** Maximum delay in milliseconds before processing the generation request */
const MAX_DELAY: number = 8000 as const

/** Minimum value for error chance randomization (inclusive) */
const ERROR_CHANCE_MIN: number = 1 as const

/** Maximum value for error chance randomization (inclusive). If random number equals this, an error is thrown */
const ERROR_CHANCE_MAX: number = 4 as const

const app = express()
app.use(express.json())

/** Lambda callback URL for notifying completion. Falls back to localhost if not set in environment */
const LAMBDA_CALLBACK_URL = process.env.LAMBDA_CALLBACK_URL || 'http://localhost:3004/dev/callback'

/**
 * Generates a random integer between min and max (inclusive).
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns Random integer between min and max
 */
const randomNumber = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Creates a promise that resolves after the specified number of milliseconds.
 * Used to simulate processing delays in the mock AI server.
 * @param ms - Number of milliseconds to delay
 * @returns Promise that resolves after the specified delay
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

app.post('/generate', async (req, res) => {
  try {
    const { prompt, generationId } = req.body

    console.log('Processing generation for prompt: ', prompt)

    const delayMs = randomNumber(MIN_DELAY, MAX_DELAY)
    console.log('Delaying for', delayMs, 'ms')

    // Add a 8-seconds delay before calling the callback
    await delay(delayMs)

    // Simulate an organic error with a chance of 1/4
    const errorChance = randomNumber(ERROR_CHANCE_MIN, ERROR_CHANCE_MAX)
    if (errorChance === ERROR_CHANCE_MAX) {
      throw new Error('Simulated error')
    }

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

/**
 * Starts the Express server on the specified port.
 * Defaults to port 3001 if PORT environment variable is not set.
 */
const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Mock AI server running on port ${PORT}`)
})
