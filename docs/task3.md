# Task 3: Image Generation Job Flow

## 1. Front-end Request

The front-end sends a POST request to initiate an image generation job.

**Request:**
```
POST /api/generate
Authorization: Bearer <jwt>
Content-Type: application/json
```

**Request Body:**
```json
{
  "prompt": "A beautiful sunset over a calm ocean",
  "notifyChannel": "auto"
}
```

**Note:** `notifyChannel` can be either `WS`, `push`, or `auto`.

**Response:**
```json
{
  "jobId": "some_job_id_123jdf123",
  "generationStatus": "PENDING"
}
```

## 2. Backend Processing

When the backend receives the processed image, it's sent to:
- **SNS service** (Simple Notification Service)
- **SQS** (Simple Queue Service)

The SQS queue can be configured with a configurable number of retries before messages are moved to a Dead Letter Queue (DLQ).

## 3. Lambda SQS Handler

The Lambda function reads from SQS and determines the notification channel (`push` or `WS`).

**Process Flow:**
1. The application uses Redis heartbeat pattern to check if the user is online or offline
2. Data is persisted to the database
3. The queue message is consumed
4. User notification is sent:
   - **If user is online:** Notified via WebSocket (WS)
   - **If user is offline:** Sent back to SNS, which delivers via FCM/APNs/WebPush

**Lambda Event Payload:**
```json
{
  "event": "job.completed",
  "jobId": "some_job_id_123jdf123",
  "userId": "some_user",
  "generationStatus": "COMPLETE",
  "imageUrl": "http://image-url/<generationId>"
}
```

## 4. Front-end Event Reception

The front-end receives the event notification.

**WebSocket Event:**
```json
{
  "type": "job.update",
  "jobId": "job_01HXYZ123",
  "generationStatus": "COMPLETE",
  "imageUrl": "http://image-url/<generationId>"
}
```

## Technology Stack

*Main reason for AWS is the ease of integration*

| Technology | Why |
|------------|-----|
| Amazon Cloudwatch | Easy AWS logging service |
| Amazon SNS | Make sure disconnected users receive push notification on mobile or browser |
| Amazon SQS | Buffer. Here we make sure no messages will be lost and we can retry by using dead letter queue |
| Redis | Easy way to check if user is online (heartbeat pattern) |
| LambdaWrapper (NestJS) | Cost efficiency, scalability and flexibility - WS |
| Postgres | API database |


## Possible risks

### Sensible data exposure
- Risk: Publicly exposed image URLs.
- Mitigation: Store the image URL in a S3 bucket and use encryption at rest and in transit (TLS).

### Duplication of events

- Risk: Client receiving duplicate or manipulated notifications.
- Mitigation: Each event has a unique event_id; client and backend perform deduplication; audit logs.

### Notification abuse
- Risk: Flooding of jobs or SSE/WS connections to overload the system.
- Mitigation: Rate limiting via Redis; quotas per user; monitoring with CloudWatch.

### Integrity and reliability
- Risk: loss of messages due to network or Lambda failures.
- Mitigation: use of SQS DLQ for unprocessed messages; idempotent reprocessing; reconciliation via REST.

# Advantages
- Reliability: SQS ensures that no notification is lost.
- Scalability: SNS allows fan-out for multiple consumers (push, audit, analytics).
- Flexibility: Redis decides whether the user is online or offline.
- User experience: SSE/WS delivers in real time; Push covers disconnected/offline users.
- Managed: Use of AWS services reduces operational effort.

# Disadvantages
- Complexity: Multiple services (SNS, SQS, Lambda, Redis) increase the learning and integration curve.
- Scaling costs: The serverless combination of Lambda, SQS, and SNS may become expensive as throughput increases.
- Lambda cold start: can impact latency in real-time notifications. Which could be avoided by provisioning a pre-determined number of ready containers.
- Redis maintenance: requires additional configuration and monitoring (ElastiCache).
 

## Cost
- Managed AWS: low initial cost (pay-as-you-go).
- High scalability: costs can grow with job and notification volume.
- Redis (ElastiCache) adds a fixed monthly cost.

## Required skills
- NestJS (REST, SSE/WS).
- AWS Lambda, SNS, SQS, Redis ElastiCache.
- JWT security.
- Push notifications (FCM/APNs/WebPush).
- Observability (CloudWatch).