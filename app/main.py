from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app.api.routes import router as api_router
from eval.latency_middleware import LatencyMiddleware, metrics_router

app = FastAPI(title="Codebase Intelligence Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev ke liye
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(LatencyMiddleware, window_size=500)

app.include_router(api_router)
app.include_router(metrics_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Codebase Intelligence Engine API is running", "health": "/api/health", "metrics": "/api/metrics"}


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
