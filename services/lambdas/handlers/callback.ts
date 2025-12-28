import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

/**
 * AWS Lambda handler for processing callback requests from the AI image generation service.
 * This function receives callback data containing generation results and processes them.
 * It expects a JSON body with generation information and returns a success response with the image URL.
 *
 * @param event - API Gateway proxy event containing the HTTP request details
 * @returns Promise resolving to an API Gateway proxy result with status code and JSON body
 *
 * @example
 * ```typescript
 * // Success response
 * {
 *   statusCode: 200,
 *   body: JSON.stringify({
 *     message: 'Callback processed successfully',
 *     imageUrl: 'http://image-url/123e4567-e89b-12d3-a456-426614174000'
 *   })
 * }
 * ```
 *
 * @throws Returns 400 status code if request body is missing
 * @throws Returns 500 status code if JSON parsing or processing fails
 */
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
