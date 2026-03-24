from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from database import Base, SessionLocal, engine
from routers.admin import router as admin_router
from routers.billing import router as billing_router
from routers.categories import router as categories_router
from routers.chat import router as chat_router
from routers.escrow import router as escrow_router
from routers.integrations_telegram import router as integrations_telegram_router
from routers.listing_responses import router as listing_responses_router
from routers.listings import router as listings_router
from routers.reviews import router as reviews_router
from routers.users import router as users_router
from routers.verification import router as verification_router
from seed_data import seed_categories, seed_demo_listings, seed_staff_users


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


app = FastAPI(
    title="Devor API",
    version="0.3.0",
    description=(
        "Маркетплейс бытовых услуг (Таджикистан). JWT в заголовке Authorization — для SPA без cookie; "
        "при переходе на cookie-сессии добавьте CSRF-токены для мутаций. OpenAPI: /docs"
    ),
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_categories(db)
        seed_staff_users(db)
        seed_demo_listings(db)


app.include_router(admin_router)
app.include_router(categories_router)
app.include_router(listings_router)
app.include_router(listing_responses_router)
app.include_router(users_router)
app.include_router(chat_router)
app.include_router(billing_router)
app.include_router(escrow_router)
app.include_router(reviews_router)
app.include_router(integrations_telegram_router)
app.include_router(verification_router)
app.mount("/media", StaticFiles(directory="media", check_dir=False), name="media")
