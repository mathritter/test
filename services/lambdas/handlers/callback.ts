import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

export const callback = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No body provided' }),
      }
    }

    const data = JSON.parse(event.body)
    console.log('Received callback data:', data)

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Callback processed successfully',
        imageUrl: `http://image-url/${data.generationId}`,
      }),
    }
  } catch (error) {
    console.error('Error processing callback:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process callback' }),
    }
  }
}
