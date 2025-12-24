# API Engineer Candidate Tasks

This document outlines the tasks that need to be completed as part of the API engineering candidate evaluation process.

Please complete all tasks as described and with a view to quality, resilience, reliability and communication.

Feel free to provide as much additional information as you would like if you would like to explain what you would do if you had more time to do the tasks or elaborate on the decisions you have made. Remember: you cannot over communicate.

> _If you haven't already done so we recommend that you take a quick read of the [challenge overview](OVERVIEW.md). This will provide a bit more information to help you get going._

## Task 1: Implement a Generation Retrieval Endpoint & Support 'generation status'

**Objectives:**

1. Add a new column to the generation table to track the status of new generations.
2. Create a GET endpoint to retrieve the status and results of an image generation request.

**Requirements:**

- **Storing and tracking generation status**
  - Add a new column to the 'generations' database table to hold the current status of the generation
    - Acceptable values for the status are: 'PENDING', 'COMPLETE', 'FAILED'
  - Set an initial status of 'PENDING' when a generation begins
  - Set a status of 'FAILED' when a generation fails
  - Set a status of 'COMPLETE' when a generation successfully finishes
- **Generation endpoint**
  - Create a new GET endpoint `/api/generation/{generationId}`
  - Return the generation status, prompt used, and image URLs (if generation status is COMPLETE)
- **Important considerations**
  - Add appropriate error handling for non-existent generations
  - Update the OpenAPI Specification to include the new endpoint and how it should be used
  - Write unit tests for any code changes or additions you make
  - Provide end-to-end tests to demonstrate the usage of the new endpoint
  - Appropriately handle the different generation states (pending, completed, failed) and code execution pathways

**Evaluation Criteria:**

- All requirements satisfied
- Code quality, organisation, commenting, error handling, best practices
- Appropriate use of database client, queries and error state handling
- Appropriate use of the NestJS framework
- Test quality, usage and approach
- API documentation clarity and code commentary
- Error handling and exception case approach

## Task 2: Implement Retry Mechanism

**Objective:** Create a retry mechanism for failed AI server requests.

**Requirements:**

- Implement an exponential backoff retry strategy of your choosing to help de-risk the service from continued failure.
- Track failed attempts in the database as part of the generation record.
- Implement appropriate logging for retry attempts.
- Write unit tests for any code changes or additions you make.
- Provide end-to-end tests to demonstrate the usage of your solution.

**Evaluation Criteria:**

- Appropriateness of retry strategy implementation.
- Code quality, organisation, commenting, error handling, best practices.
- Error handling and exception case approach.
- Test quality, usage and approach.
- API documentation clarity and code commentary.
- Appropriate use of the NestJS framework.

## Task 3: Design Real-time User Notification System

**Objective:** Create a detailed design proposal for a system to notify users when their image generation requests are completed, specifically focusing on the interaction between the Frontend (FE) and the API, and any API architecture required to facilitate that interaction. It does not include the API's communication with the AI generation engine.

**Requirements:**

- Write a design document covering:
  - System architecture diagram.
  - Technology choices (e.g., WebSockets, Server-Sent Events, WebRTC, AWS SNS, Redis Pub/Sub, etc.) and rationale.
  - Message format and schema.
  - Error handling approach.
  - User offline handling.
  - User acknowledgement.
  - Scaling considerations, risks and mitigating measures.
  - Security considerations, risks and mitigating measures.
  - Trade-offs of your solution and alternatives you would recommend.
  - Implementation complexity; consider the development time, cost and skills required to implement your solution.

**Evaluation Criteria:**

- Architecture solution design quality overall quality and depth.
- Illustration appropriateness, clarity and usefulness.
- Communication style, clarity.
- Depth of knowledge and understanding clear.

---

## Submission Guidelines

1. Create a new branch for each task.
2. Submit a pull request for each task when completed building on each step (e.g step 2 includes the changes made in step 1).
   - Merge the PRs into your main branch when ready.
3. Include detailed PR descriptions explaining your approach.
4. Provide as much clear documentation as you would expect from
   - a production-ready system.
   - an API (so you others know how to use it).
   - your colleagues (expressing the intent of code).
5. Ensure your code is buildable so we can run your solution.
6. Ensure your tests pass (don't strive for coverage, but test quality).
7. Add any necessary deployment instructions or information to allow us to evaluate your submission.
8. You can use any widely accepted NPM/Yarn packages, but use of "unknown" or small packages is not permitted and will possibly result in a failure of your submission.

## Passing grades

- _Task 1_: 44 scoring points available - 35 required to pass (80%)
- _Task 2_: 28 scoring points available - 22 required to pass (80%)
- _Task 3_: 36 scoring points available - 29 required to pass (80%)

## Time Expectations

- Task 1: 1 hour
- Task 2: 1 hour
- Task 3: 1 hour

Total estimated time: 3 hours

Please note that these are rough estimates, and you should focus on quality rather than speed. We want to see your best work, not your fastest submission.

Good luck, have fun and we look forward to meeting you in your craft interview.
