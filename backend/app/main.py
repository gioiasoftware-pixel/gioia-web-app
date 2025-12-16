"""
Main FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="Gio.ia Web App API",
    description="Backend API per web app unificata Gio.ia",
    version="1.0.0"
)

# CORS Configuration
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "gioia-web-app-backend"}

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Gio.ia Web App API",
        "version": "1.0.0",
        "docs": "/docs"
    }

# Import routers
from app.api import auth, chat, processor, viewer

# Include routers
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(processor.router)
app.include_router(viewer.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
