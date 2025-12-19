"""
Main FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import os
from dotenv import load_dotenv

# Setup logging PRIMA di tutto
from app.core.logging_config import setup_logging
setup_logging(service_name="web-app")

load_dotenv()

app = FastAPI(
    title="Gio.ia Web App API",
    description="Backend API per web app unificata Gio.ia",
    version="1.0.0"
)

# CORS Configuration - Allow all origins including Control Panel Admin
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
CONTROL_PANEL_URL = os.getenv("CONTROL_PANEL_URL", "https://controlpaneladmingioia-production.up.railway.app")

# Lista di origini permesse
allowed_origins = [
    FRONTEND_URL,
    CONTROL_PANEL_URL,
    "https://controlpaneladmingioia-production.up.railway.app",
    "http://localhost:5173",
    "http://localhost:3000",
]

# Rimuovi duplicati e None
allowed_origins = list(set([origin for origin in allowed_origins if origin]))

# Se allow_credentials=True, non possiamo usare ["*"], dobbiamo specificare le origini
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],  # Fallback a "*" se lista vuota
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Serve static files from frontend directory
# On Railway: working dir is /app, so frontend is at /app/frontend
# From backend/app/main.py: go up to /app, then to frontend
base_path = Path(__file__).parent.parent.parent.parent  # /app
frontend_path = base_path / "frontend"

# Also try relative to current working directory (Railway uses /app)
if not frontend_path.exists():
    cwd = Path.cwd()  # Should be /app/backend when running
    if cwd.name == "backend":
        frontend_path = cwd.parent / "frontend"
    else:
        frontend_path = cwd / "frontend"

if frontend_path.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_path)), name="static")
    
    # Serve index.html at root
    @app.get("/")
    async def serve_frontend():
        """Serve frontend HTML."""
        index_file = frontend_path / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return {"message": "Gio.ia Web App API", "version": "1.0.0", "docs": "/docs", "frontend_path": str(frontend_path), "exists": frontend_path.exists()}
else:
    # Fallback if frontend not found
    @app.get("/")
    async def root():
        """Root endpoint."""
        return {
            "message": "Gio.ia Web App API",
            "version": "1.0.0",
            "docs": "/docs",
            "debug": {
                "cwd": str(Path.cwd()),
                "base_path": str(base_path),
                "frontend_path": str(frontend_path),
                "exists": frontend_path.exists() if frontend_path else False
            }
        }

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "gioia-web-app-backend"}

# Import routers
from app.api import auth, chat, processor, viewer, wines, debug, admin

# Include routers
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(processor.router)
app.include_router(viewer.router)
app.include_router(wines.router)
app.include_router(debug.router)
app.include_router(admin.router)

# Migrazioni rimosse - già eseguite manualmente
# @app.on_event("startup")
# async def startup_migrations():
#     """
#     Esegue migrazioni database automaticamente all'avvio.
#     Verifica se le tabelle/colonne esistono prima di crearle/modificarle.
#     """
#     ... (rimosso - migrazioni già eseguite)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

