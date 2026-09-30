from fastapi import APIRouter, FastAPI
from sqlalchemy import text
from app.core.config import settings
from app.db.database import engine
from app.api.websites import router as websites_router
from app.api.articles import router as articles_router
from app.api.wordpress import router as wordpress_router
from app.vector_store.qdrant import qdrant_client


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    debug=settings.app_debug,
)

# Routes defined in app/api all share the /api prefix.
api_router = APIRouter(prefix="/api")
api_router.include_router(websites_router)
api_router.include_router(articles_router)
api_router.include_router(wordpress_router)
app.include_router(api_router)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "environment": settings.app_env,
    }

@app.get("/health/db")
def database_health_check():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    return {
        "status": "ok",
        "database": "connected",
    }

@app.get("/health/qdrant")
def qdrant_health_check():
    qdrant_client.get_collections()

    return {
        "status": "ok",
        "qdrant": "connected",
    }
