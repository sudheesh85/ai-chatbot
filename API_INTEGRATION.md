# API Integration Guide

This document provides detailed information for backend developers on how to integrate the NL2SQL Chatbot UI with your backend API.

## Overview

The frontend application is designed to be **backend-agnostic** and works with any backend that implements the specified API contract. The application communicates with your backend via REST API and Server-Sent Events (SSE) for streaming responses.

## API Endpoints

### 1. Health Check (Optional)

**Endpoint**: `GET /health`

**Purpose**: Verify that the backend is running and accessible.

**Response**:
- **Status Code**: `200 OK`
- **Body**: Any (not parsed by frontend)

**Example**:
```bash
curl http://localhost:8000/api/v1/health
```

---

### 2. Non-Streaming Question Endpoint

**Endpoint**: `POST /ask/question`

**Purpose**: Process a natural language question and return a complete response.

**Request Headers**:
```
Content-Type: application/json
Authorization: Bearer <token>  # If using JWT
X-API-Key: <api_key>           # If using API Key authentication
```

**Request Body**:
```json
{
  "question": "How many students are in grade 5?",
  "org_id": 123,              // Optional: Organization/tenant ID
  "session_id": "session-123"  // Optional: Session identifier for context
}
```

**Response Format**:
```json
{
  "success": true,
  "response": "There are 45 students in grade 5.",
  "sql": "SELECT COUNT(*) FROM students WHERE grade = 5",  // Optional
  "data": {  // Optional: Include if you want to display data
    "columns": ["count"],
    "rows": [[45]]
  },
  "visualization": "bar",  // Optional: "bar" | "line" | "pie" | "table"
  "error": null  // Only present if success is false
}
```

**Error Response**:
```json
{
  "success": false,
  "response": "",
  "error": "Unable to process your question. Please try rephrasing it."
}
```

**Example Implementation** (Python/FastAPI):
```python
from fastapi import FastAPI, Header
from pydantic import BaseModel

app = FastAPI()

class QuestionRequest(BaseModel):
    question: str
    org_id: int | None = None
    session_id: str | None = None

class QuestionResponse(BaseModel):
    success: bool
    response: str
    sql: str | None = None
    data: dict | None = None
    visualization: str | None = None
    error: str | None = None

@app.post("/api/v1/ask/question", response_model=QuestionResponse)
async def ask_question(
    request: QuestionRequest,
    authorization: str = Header(None),
    x_api_key: str = Header(None, alias="X-API-Key")
):
    # Authenticate user
    if not (authorization or x_api_key):
        return QuestionResponse(
            success=False,
            response="",
            error="Authentication required"
        )
    
    # Process question (your NL2SQL logic here)
    sql_query = generate_sql(request.question)
    result = execute_query(sql_query)
    
    return QuestionResponse(
        success=True,
        response=f"There are {result[0][0]} students in grade 5.",
        sql=sql_query,
        data={
            "columns": ["count"],
            "rows": result
        },
        visualization="bar"
    )
```

---

### 3. Streaming Question Endpoint (SSE)

**Endpoint**: `POST /ask/question/stream`

**Purpose**: Process a natural language question and stream the response in real-time using Server-Sent Events.

**Request Headers**:
```
Content-Type: application/json
Authorization: Bearer <token>  # If using JWT
X-API-Key: <api_key>           # If using API Key authentication
Accept: text/event-stream
```

**Request Body**: Same as non-streaming endpoint

**Response Format** (Server-Sent Events):

The response should be sent as Server-Sent Events with the following format:

```
data: {"chunk": "There are "}

data: {"chunk": "45 "}

data: {"chunk": "students in grade 5."}

data: {"complete": true, "response": "There are 45 students in grade 5.", "sql": "SELECT COUNT(*) FROM students WHERE grade = 5", "data": {"columns": ["count"], "rows": [[45]]}, "visualization": "bar"}

data: [DONE]
```

**Chunk Format**:
- Each chunk should be a JSON object: `{"chunk": "text here"}`
- The final message should include `"complete": true` and all response data
- End with `data: [DONE]` to signal completion

**Example Implementation** (Python/FastAPI):
```python
from fastapi.responses import StreamingResponse
import json

@app.post("/api/v1/ask/question/stream")
async def ask_question_stream(
    request: QuestionRequest,
    authorization: str = Header(None),
    x_api_key: str = Header(None, alias="X-API-Key")
):
    async def generate():
        # Stream response chunks
        response_text = "There are 45 students in grade 5."
        words = response_text.split()
        
        for word in words:
            chunk = {"chunk": word + " "}
            yield f"data: {json.dumps(chunk)}\n\n"
            await asyncio.sleep(0.1)  # Simulate processing delay
        
        # Send final complete response
        final_response = {
            "complete": True,
            "response": response_text,
            "sql": "SELECT COUNT(*) FROM students WHERE grade = 5",
            "data": {
                "columns": ["count"],
                "rows": [[45]]
            },
            "visualization": "bar"
        }
        yield f"data: {json.dumps(final_response)}\n\n"
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
```

---

## Authentication

The frontend supports three authentication methods:

### 1. API Key Authentication

- User enters API key on login page
- API key is sent as `X-API-Key` header in all requests
- Backend should validate the API key on each request

**Backend Implementation**:
```python
from fastapi import Header, HTTPException

async def verify_api_key(x_api_key: str = Header(None, alias="X-API-Key")):
    if not x_api_key or not is_valid_api_key(x_api_key):
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key
```

### 2. JWT Token Authentication

- User logs in with email/password
- Backend returns JWT token
- Token is sent as `Authorization: Bearer <token>` header

**Login Endpoint** (if implementing JWT):
```
POST /api/v1/auth/login

Request:
{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Backend Implementation**:
```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    if not is_valid_token(token):
        raise HTTPException(status_code=401, detail="Invalid token")
    return token
```

### 3. OAuth Authentication

- User authenticates via OAuth provider (Google, Microsoft, etc.)
- Backend handles OAuth callback and returns token
- Token is sent as `Authorization: Bearer <token>` header

---

## Data Visualization

The frontend automatically renders charts and tables based on the response data.

### Visualization Types

1. **`bar`**: Bar chart (default for categorical data)
2. **`line`**: Line chart (for time series data)
3. **`pie`**: Pie chart (for proportional data, max 10 items)
4. **`table`**: Table view (default for large datasets)

### Data Format

```json
{
  "data": {
    "columns": ["month", "sales", "revenue"],
    "rows": [
      ["January", 1000, 50000],
      ["February", 1200, 60000],
      ["March", 1500, 75000]
    ]
  },
  "visualization": "bar"
}
```

**Notes**:
- First column is typically used as X-axis labels or category names
- Subsequent columns are used as data series
- For pie charts, only the first two columns are used (name, value)
- Rows should be arrays of values matching the column order

---

## Error Handling

### HTTP Status Codes

- **200 OK**: Successful request
- **400 Bad Request**: Invalid request format
- **401 Unauthorized**: Authentication required or invalid
- **403 Forbidden**: User doesn't have permission
- **500 Internal Server Error**: Server error

### Error Response Format

```json
{
  "success": false,
  "response": "",
  "error": "User-friendly error message here"
}
```

**Best Practices**:
- Use plain, non-technical language for error messages
- Provide actionable guidance when possible
- Avoid exposing sensitive information (SQL errors, stack traces, etc.)

---

## CORS Configuration

If your backend is on a different domain, configure CORS to allow the frontend origin:

**Python/FastAPI Example**:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-frontend-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Testing Your Integration

### 1. Test Health Endpoint

```bash
curl http://localhost:8000/api/v1/health
```

### 2. Test Non-Streaming Endpoint

```bash
curl -X POST http://localhost:8000/api/v1/ask/question \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "question": "How many students are in grade 5?",
    "session_id": "test-session"
  }'
```

### 3. Test Streaming Endpoint

```bash
curl -X POST http://localhost:8000/api/v1/ask/question/stream \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -H "Accept: text/event-stream" \
  -d '{
    "question": "How many students are in grade 5?",
    "session_id": "test-session"
  }'
```

---

## Session Management

The frontend generates a `session_id` for each chat session to maintain context. Your backend can use this to:

- Track conversation history
- Maintain context across multiple questions
- Provide personalized responses

**Example**:
```python
# Store session context
session_context = {
    "session_id": request.session_id,
    "previous_questions": [...],
    "user_preferences": {...}
}
```

---

## Performance Considerations

1. **Response Time**: Aim for < 3 seconds for non-streaming responses
2. **Streaming Latency**: Send chunks as soon as they're available
3. **Data Size**: For large datasets (> 1000 rows), consider pagination
4. **Caching**: Cache common queries if appropriate

---

## Security Best Practices

1. **Validate Input**: Sanitize and validate all user inputs
2. **SQL Injection**: Never directly execute user input as SQL
3. **Rate Limiting**: Implement rate limiting to prevent abuse
4. **API Key Security**: Store API keys securely, use HTTPS
5. **Token Expiration**: Implement token expiration and refresh
6. **Error Messages**: Don't expose sensitive information in errors

---

## Support

For questions or issues with API integration, please refer to the main README or open an issue in the repository.

---

**Last Updated**: 2024

