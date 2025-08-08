from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
from typing import List
import requests

app = FastAPI()

# Set your API key for authentication
API_KEY = "my_secret_api_key"

# Request body format
class QueryRequest(BaseModel):
    documents: str
    questions: List[str]

@app.post("/hackrx/run")
async def run_endpoint(request: Request, body: QueryRequest):
    # Check Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Here’s where you’ll process the PDF and answer questions
    # For now, returning dummy answers
    answers = []
    for q in body.questions:
        answers.append(f"Dummy answer for: {q}")

    return {"answers": answers}
