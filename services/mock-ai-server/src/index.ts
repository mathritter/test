import express from 'express'
import axios from 'axios'

const app = express()
app.use(express.json())

const LAMBDA_CALLBACK_URL = process.env.LAMBDA_CALLBACK_URL || 'http://localhost:3004/dev/callback'

// Helper function to create a delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

app.post('/generate', async (req, res) => {
  try {
    const { prompt, generationId } = req.body

    console.log('Processing generation for prompt: ', prompt)

    // Add a 8-seconds delay before calling the callback
    await delay(8000) // FIXME: Change to be random between 4-8 seconds

    // Trigger Lambda callback
    try {
      await axios.post(LAMBDA_CALLBACK_URL, {
        prompt,
        generationId,
        timestamp: new Date().toISOString(),
      })
      console.log('Successfully triggered Lambda callback')
    } catch (callbackError) {
      console.error('Failed to trigger Lambda callback:', callbackError)
      throw callbackError
    }

    res.status(200).json({ generationId: generationId })
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
