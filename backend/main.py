from datetime import datetime, timedelta
from typing import Optional

import httpx
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.orm import sessionmaker, declarative_base, Session

# -----------------------------
# DB
# -----------------------------
DATABASE_URL = "sqlite:///./heritage.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    category = Column(String)  # heritage | tourist
    province = Column(String, default="")
    latitude = Column(Float)
    longitude = Column(Float)
    wiki_title = Column(String, default="")
    image_url = Column(String, default="")
    summary = Column(Text, default="")
    health_tip = Column(Text, default="")
    risk_level = Column(String, default="Moderate")
    recommended_items = Column(Text, default="")
    emergency_note = Column(Text, default="")
    active = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_admin = Column(Boolean, default=False)


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -----------------------------
# Auth
# -----------------------------
SECRET_KEY = "CHANGE_ME_TO_A_LONG_RANDOM_STRING_FOR_V2"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain: str, hashed: str) -> bool:
    plain = plain or ""
    return pwd_context.verify(plain, hashed)


def hash_password(pw: str) -> str:
    pw = pw or ""
    return pwd_context.hash(pw)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# -----------------------------
# Schemas
# -----------------------------
class RegisterIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SiteIn(BaseModel):
    name: str
    category: str
    province: str = ""
    latitude: float
    longitude: float
    wiki_title: str = ""
    image_url: str = ""
    summary: str = ""
    health_tip: str = ""
    risk_level: str = "Moderate"
    recommended_items: str = ""
    emergency_note: str = ""
    active: bool = True


class SiteOut(SiteIn):
    id: int
    updated_at: datetime


# -----------------------------
# App
# -----------------------------
app = FastAPI(title="Heritage Health Hub API V2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "https://bejewelled-alfajores-a52bdc.netlify.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "status": "ok",
        "message": "Heritage Health Hub API V2 is running",
        "docs": "/docs",
    }


# -----------------------------
# Seed data (VC-ready V2)
# -----------------------------
SEED = [
    {
        "name": "Great Zimbabwe National Monument",
        "category": "heritage",
        "province": "Masvingo",
        "latitude": -20.2683,
        "longitude": 30.9333,
        "wiki_title": "Great Zimbabwe",
        "image_url": "",
        "summary": "Great Zimbabwe is the largest ancient stone structure in sub-Saharan Africa and a major symbol of Zimbabwean heritage and civilization.",
        "health_tip": "Visitors should carry drinking water, wear a hat, use sunscreen, and prepare for prolonged walking under strong sun exposure.",
        "risk_level": "Moderate",
        "recommended_items": "Water bottle, hat, sunscreen, walking shoes, light snacks",
        "emergency_note": "If dizziness or dehydration occurs, rest immediately in shade and seek the nearest clinic.",
    },
    {
        "name": "Khami Ruins National Monument",
        "category": "heritage",
        "province": "Bulawayo",
        "latitude": -20.1596,
        "longitude": 28.3737,
        "wiki_title": "Khami",
        "image_url": "",
        "summary": "Khami Ruins is an important archaeological heritage site near Bulawayo, known for its terraces and stone-built remains.",
        "health_tip": "Use proper footwear, carry water, and avoid climbing unstable sections. Heat exposure can be significant during midday.",
        "risk_level": "Moderate",
        "recommended_items": "Walking shoes, water, hat, sunscreen",
        "emergency_note": "Take caution on uneven ground and seek help if ankle strain or fatigue occurs.",
    },
    {
        "name": "Matobo Hills",
        "category": "heritage",
        "province": "Matabeleland South",
        "latitude": -20.513,
        "longitude": 28.500,
        "wiki_title": "Matobo National Park",
        "image_url": "",
        "summary": "Matobo Hills is a UNESCO-listed cultural landscape known for granite formations, spiritual significance, and wildlife.",
        "health_tip": "Rocky surfaces can be slippery or uneven. Wear strong footwear and avoid risky climbing without support.",
        "risk_level": "Moderate",
        "recommended_items": "Hiking shoes, water, cap, small first aid kit",
        "emergency_note": "Be cautious near steep rock surfaces and monitor fatigue during hikes.",
    },
    {
        "name": "Mana Pools National Park",
        "category": "tourist",
        "province": "Mashonaland West",
        "latitude": -15.834,
        "longitude": 29.386,
        "wiki_title": "Mana Pools National Park",
        "image_url": "",
        "summary": "Mana Pools is a major safari destination known for wildlife, wilderness, and river-based tourism experiences.",
        "health_tip": "Carry insect repellent, hydrate frequently, avoid isolated walking, and follow wildlife safety guidance strictly.",
        "risk_level": "High",
        "recommended_items": "Insect repellent, water, neutral clothing, sunscreen, first aid kit",
        "emergency_note": "Do not approach wildlife. In emergencies, contact guides or park authorities immediately.",
    },
    {
        "name": "Victoria Falls (Mosi-oa-Tunya)",
        "category": "tourist",
        "province": "Matabeleland North",
        "latitude": -17.9243,
        "longitude": 25.8572,
        "wiki_title": "Victoria Falls",
        "image_url": "",
        "summary": "Victoria Falls is one of the world’s great waterfalls and one of Zimbabwe’s most important tourism destinations.",
        "health_tip": "Surfaces may be wet and slippery near the falls. Wear non-slip shoes, protect electronics from mist, and remain hydrated.",
        "risk_level": "Moderate",
        "recommended_items": "Non-slip shoes, rain jacket, water, sunscreen, waterproof bag",
        "emergency_note": "Take extra care near railings and wet paths. Seek help immediately if slips or breathing discomfort occur.",
    },
    {
        "name": "Hwange National Park",
        "category": "tourist",
        "province": "Matabeleland North",
        "latitude": -18.629,
        "longitude": 26.941,
        "wiki_title": "Hwange National Park",
        "image_url": "",
        "summary": "Hwange National Park is Zimbabwe’s largest game reserve and a key destination for safari tourism and biodiversity.",
        "health_tip": "High temperatures, dust, and insects are common. Stay hydrated and keep distance from wildlife at all times.",
        "risk_level": "High",
        "recommended_items": "Water, repellent, hat, sunscreen, binoculars, light protective clothing",
        "emergency_note": "Always follow ranger instructions and remain in designated safe areas.",
    },
    {
        "name": "Gonarezhou National Park",
        "category": "tourist",
        "province": "Masvingo",
        "latitude": -21.000,
        "longitude": 31.500,
        "wiki_title": "Gonarezhou National Park",
        "image_url": "",
        "summary": "Gonarezhou is a remote wilderness park known for dramatic landscapes, elephants, and conservation value.",
        "health_tip": "Remote conditions require preparation. Carry sufficient water, medicine, and insect protection.",
        "risk_level": "High",
        "recommended_items": "Water, first aid supplies, insect repellent, power bank, sun protection",
        "emergency_note": "Because of remoteness, seek support early before a health issue escalates.",
    },
    {
        "name": "Lake Kariba",
        "category": "tourist",
        "province": "Mashonaland West",
        "latitude": -16.522,
        "longitude": 28.802,
        "wiki_title": "Lake Kariba",
        "image_url": "",
        "summary": "Lake Kariba is a major tourism and fishing destination with boating, houseboats, and lakeside recreation.",
        "health_tip": "Stay hydrated, be cautious on boats, and avoid excessive sun exposure during midday.",
        "risk_level": "Moderate",
        "recommended_items": "Life jacket, water, sunscreen, sunglasses, hat",
        "emergency_note": "Observe boating safety and avoid swimming in unsafe areas.",
    },
    {
        "name": "Eastern Highlands (Nyanga)",
        "category": "tourist",
        "province": "Manicaland",
        "latitude": -18.214,
        "longitude": 32.747,
        "wiki_title": "Nyanga National Park",
        "image_url": "",
        "summary": "The Eastern Highlands are known for mountains, waterfalls, cool weather, and outdoor tourism such as hiking and scenic exploration.",
        "health_tip": "Morning temperatures can be low. Wear layers, use proper hiking shoes, and monitor fatigue on steep terrain.",
        "risk_level": "Moderate",
        "recommended_items": "Warm jacket, hiking shoes, water, rain protection, snacks",
        "emergency_note": "Take care on steep or wet trails and avoid solo hiking in unfamiliar terrain.",
    },
]


def seed_if_empty(db: Session):
    if db.query(Site).count() == 0:
        for s in SEED:
            db.add(Site(**s))

        admin_email = "admin@heritage.local"
        admin_pw = "admin123"
        db.add(User(email=admin_email, hashed_password=hash_password(admin_pw), is_admin=True))
        db.commit()


@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()


# -----------------------------
# Auth routes
# -----------------------------
@app.post("/api/auth/register")
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(400, "Email already registered")
    user = User(email=payload.email, hashed_password=hash_password(payload.password), is_admin=False)
    db.add(user)
    db.commit()
    return {"ok": True}


@app.post("/api/auth/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bad credentials")
    token = create_access_token({"sub": user.email})
    return TokenOut(access_token=token)


@app.get("/api/me")
def me(user: User = Depends(get_current_user)):
    return {"email": user.email, "is_admin": user.is_admin}


# -----------------------------
# Sites routes
# -----------------------------
@app.get("/api/sites", response_model=list[SiteOut])
def list_sites(db: Session = Depends(get_db)):
    rows = db.query(Site).filter(Site.active == True).order_by(Site.name.asc()).all()
    return [
        SiteOut(
            id=r.id,
            name=r.name,
            category=r.category,
            province=r.province,
            latitude=r.latitude,
            longitude=r.longitude,
            wiki_title=r.wiki_title,
            image_url=r.image_url,
            summary=r.summary,
            health_tip=r.health_tip,
            risk_level=r.risk_level,
            recommended_items=r.recommended_items,
            emergency_note=r.emergency_note,
            active=r.active,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@app.get("/api/sites/{site_id}", response_model=SiteOut)
def get_site(site_id: int, db: Session = Depends(get_db)):
    row = db.query(Site).filter(Site.id == site_id, Site.active == True).first()
    if not row:
        raise HTTPException(404, "Site not found")

    return SiteOut(
        id=row.id,
        name=row.name,
        category=row.category,
        province=row.province,
        latitude=row.latitude,
        longitude=row.longitude,
        wiki_title=row.wiki_title,
        image_url=row.image_url,
        summary=row.summary,
        health_tip=row.health_tip,
        risk_level=row.risk_level,
        recommended_items=row.recommended_items,
        emergency_note=row.emergency_note,
        active=row.active,
        updated_at=row.updated_at,
    )


@app.post("/api/admin/sites", response_model=SiteOut)
def add_site(payload: SiteIn, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    row = Site(**payload.model_dump(), updated_at=datetime.utcnow())
    db.add(row)
    db.commit()
    db.refresh(row)
    return SiteOut(id=row.id, updated_at=row.updated_at, **payload.model_dump())


@app.put("/api/admin/sites/{site_id}", response_model=SiteOut)
def update_site(site_id: int, payload: SiteIn, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    row = db.query(Site).filter(Site.id == site_id).first()
    if not row:
        raise HTTPException(404, "Not found")

    for k, v in payload.model_dump().items():
        setattr(row, k, v)

    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return SiteOut(id=row.id, updated_at=row.updated_at, **payload.model_dump())


@app.delete("/api/admin/sites/{site_id}")
def delete_site(site_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    row = db.query(Site).filter(Site.id == site_id).first()
    if not row:
        raise HTTPException(404, "Not found")

    row.active = False
    row.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


# -----------------------------
# Weather
# -----------------------------
@app.get("/api/weather")
async def weather(lat: float, lon: float):
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code",
    }

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        data = r.json()

    current = data.get("current", {})
    t = current.get("temperature_2m")
    wind = current.get("wind_speed_10m", 0)
    rain = current.get("precipitation", 0)

    if t is None:
        suggestion = "Dress comfortably for local conditions."
    elif t >= 30:
        suggestion = "Hot conditions: wear light clothing, a hat, sunscreen, and drink water frequently."
    elif t >= 22:
        suggestion = "Warm conditions: light clothing and comfortable walking shoes recommended."
    elif t >= 12:
        suggestion = "Mild conditions: carry a light jacket."
    else:
        suggestion = "Cool conditions: warm jacket or layered clothing recommended."

    if rain and rain > 0:
        suggestion += " Carry a rain jacket or umbrella."
    if wind and wind >= 25:
        suggestion += " Windy conditions: add a windbreaker."

    return {"current": current, "wear_suggestion": suggestion}


# -----------------------------
# Nearby clinics / hospitals
# -----------------------------
@app.get("/api/nearby-health")
async def nearby_health(lat: float, lon: float, radius_m: int = 10000):
    query = f"""
    [out:json][timeout:25];
    (
      nwr(around:{radius_m},{lat},{lon})["amenity"="hospital"];
      nwr(around:{radius_m},{lat},{lon})["amenity"="clinic"];
      nwr(around:{radius_m},{lat},{lon})["healthcare"="hospital"];
      nwr(around:{radius_m},{lat},{lon})["healthcare"="clinic"];
      nwr(around:{radius_m},{lat},{lon})["amenity"="pharmacy"];
    );
    out center;
    """

    async with httpx.AsyncClient(timeout=25) as client:
        r = await client.post("https://overpass-api.de/api/interpreter", data=query)
        r.raise_for_status()
        data = r.json()

    results = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name", "Unnamed facility")
        center = el.get("center") or {"lat": el.get("lat"), "lon": el.get("lon")}
        if not center:
            continue

        results.append(
            {
                "name": name,
                "type": tags.get("amenity") or tags.get("healthcare") or "health",
                "lat": center.get("lat"),
                "lon": center.get("lon"),
                "address": tags.get("addr:full") or tags.get("addr:street") or "",
            }
        )

    return {"count": len(results), "results": results}


# -----------------------------
# Wiki summary + image
# -----------------------------
@app.get("/api/wiki")
async def wiki(title: str):
    safe_title = title.replace(" ", "_")
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{safe_title}"

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(url, headers={"accept": "application/json"})
        if r.status_code != 200:
            return {"title": title, "extract": "", "thumbnail": None, "content_urls": None}
        data = r.json()

    return {
        "title": data.get("title", title),
        "extract": data.get("extract", ""),
        "thumbnail": (data.get("thumbnail") or {}).get("source"),
        "content_urls": data.get("content_urls", {}),
    }