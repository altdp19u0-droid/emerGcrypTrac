from fastapi import FastAPI, APIRouter, HTTPException, Query, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import csv
import io
import jwt
from passlib.context import CryptContext
from bson import ObjectId
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="CryptoTrack API", version="2.0.0")
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer(auto_error=False)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Settings
SECRET_KEY = os.environ.get("SECRET_KEY", "your-super-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Etherscan API - No longer using env variable, stored per user session
# In-memory session storage for API keys (cleared on app restart)
user_api_keys: Dict[str, str] = {}

# Multi-chain Scanner APIs (same API key works across all Etherscan family)
# Etherscan API V2 - Single endpoint for all chains
ETHERSCAN_V2_API = "https://api.etherscan.io/v2/api"

# Blockscout API - Free alternative for Base and Optimism
BLOCKSCOUT_APIS = {
    "Base": "https://base.blockscout.com/api/v2",
    "Optimism": "https://optimism.blockscout.com/api/v2"
}

# Chain IDs for V2 API
CHAIN_IDS = {
    "Ethereum": 1,
    "Polygon": 137,
    "Arbitrum": 42161,
    "Base": 8453,
    "Optimism": 10
}

CHAIN_SCANNERS = {
    "Ethereum": {
        "chain_id": 1,
        "name": "Etherscan",
        "explorer": "https://etherscan.io",
        "native_symbol": "ETH",
        "api_type": "etherscan"
    },
    "Polygon": {
        "chain_id": 137,
        "name": "Polygonscan", 
        "explorer": "https://polygonscan.com",
        "native_symbol": "MATIC",
        "api_type": "etherscan"
    },
    "Arbitrum": {
        "chain_id": 42161,
        "name": "Arbiscan",
        "explorer": "https://arbiscan.io",
        "native_symbol": "ETH",
        "api_type": "etherscan"
    },
    "Base": {
        "chain_id": 8453,
        "name": "Blockscout",
        "explorer": "https://base.blockscout.com",
        "native_symbol": "ETH",
        "api_type": "blockscout"
    },
    "Optimism": {
        "chain_id": 10,
        "name": "Blockscout",
        "explorer": "https://optimism.blockscout.com",
        "native_symbol": "ETH",
        "api_type": "blockscout"
    }
}

# CoinGecko API
COINGECKO_API_URL = "https://api.coingecko.com/api/v3"

# Stablecoin mapping
STABLECOIN_IDS = {
    "USDC": "usd-coin",
    "EURC": "euro-coin",
    "AGEUR": "ageur",
    "ZCHF": "frankencoin",
    "USDT": "tether",
    "DAI": "dai",
    "USDC.e": "usd-coin"
}

# Stablecoin contract addresses per chain
STABLECOIN_CONTRACTS_BY_CHAIN = {
    "Ethereum": {
        "USDC": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "EURC": "0x1abaea1f7c830bd89acc67ec4af516284b1bc33c",
        "USDT": "0xdac17f958d2ee523a2206206994597c13d831ec7",
        "DAI": "0x6b175474e89094c44da98b954eedeac495271d0f"
    },
    "Polygon": {
        "USDC": "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",  # Native USDC
        "USDC.e": "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",  # Bridged USDC
        "USDT": "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
        "DAI": "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063",
        "EURC": "0x3D9B3E6f1E2c3C6E1e8E8e1e8E8e1e8E8e1e8E8e"  # Placeholder
    },
    "Arbitrum": {
        "USDC": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",  # Native USDC
        "USDC.e": "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",  # Bridged USDC
        "USDT": "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
        "DAI": "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1"
    },
    "Base": {
        "USDC": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",  # Native USDC
        "DAI": "0x50c5725949a6f0c72e6c4a641f24049a917db0cb",
        "EURC": "0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42"
    },
    "Optimism": {
        "USDC": "0x0b2c639c533813f4aa9d7837caf62653d097ff85",  # Native USDC
        "USDC.e": "0x7f5c764cbc14f9669b88837ca1490cca17c31607",  # Bridged
        "USDT": "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58",
        "DAI": "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1"
    }
}

# Legacy mapping for backwards compatibility
STABLECOIN_CONTRACTS = STABLECOIN_CONTRACTS_BY_CHAIN["Ethereum"]

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== AUTH MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one number')
        return v

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    full_name: Optional[str] = None
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshTokenRequest(BaseModel):
    refresh_token: str

# ==================== WALLET MODELS ====================

class WalletCreate(BaseModel):
    name: str
    address: str
    network: str = "Ethereum"
    type: str = "address"

class Wallet(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    address: str
    network: str = "Ethereum"
    type: str = "address"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ==================== TRANSACTION MODELS ====================

class TransactionCreate(BaseModel):
    type: str
    asset: str
    amount: float
    price_usd: float
    price_eur: float
    value_usd: float
    value_eur: float
    fees: float = 0.0
    fees_currency: str = "EUR"
    wallet_id: str
    wallet_name: str
    source: str = "manual"
    date: str
    tx_hash: Optional[str] = None
    counterparty_wallet: Optional[str] = None
    notes: str = ""
    # Interdépendance Crypto ↔ Crypto
    target_wallet_id: Optional[str] = None  # Wallet destinataire pour transferts internes
    create_counterpart_tx: bool = False  # Créer automatiquement la transaction contrepartie

class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str
    asset: str
    amount: float
    price_usd: float
    price_eur: float
    value_usd: float
    value_eur: float
    fees: float = 0.0
    fees_currency: str = "EUR"
    wallet_id: str
    wallet_name: str
    source: str = "manual"
    date: str
    tx_hash: Optional[str] = None
    counterparty_wallet: Optional[str] = None
    is_spam: bool = False
    notes: str = ""
    linked_position_id: Optional[str] = None  # Lien vers position pour interdépendance
    linked_movement_id: Optional[str] = None  # Lien vers mouvement de position
    linked_tx_id: Optional[str] = None  # Lien vers transaction crypto contrepartie
    # Catégorie de revenu/dépense pour classification fiscale
    income_category: Optional[str] = None  # interest, yield, airdrop, reward, cashback, fee, gas, subscription, payment
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class TransactionUpdate(BaseModel):
    """Model for updating an existing crypto transaction"""
    type: Optional[str] = None
    asset: Optional[str] = None
    amount: Optional[float] = None
    price_usd: Optional[float] = None
    price_eur: Optional[float] = None
    value_usd: Optional[float] = None
    value_eur: Optional[float] = None
    fees: Optional[float] = None
    fees_currency: Optional[str] = None
    date: Optional[str] = None
    counterparty_wallet: Optional[str] = None
    income_category: Optional[str] = None  # Catégorie de revenu/dépense

# ==================== ADDRESS CLASSIFICATION ====================

class AddressClassification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    address: str  # The counterparty address
    classification: str  # "trusted", "suspicious", or "neutral"
    label: Optional[str] = None  # Optional custom label
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class AddressClassificationRequest(BaseModel):
    address: str
    classification: str  # "trusted", "suspicious", or "neutral"
    label: Optional[str] = None

# ==================== HIDDEN TOKENS ====================

class HiddenToken(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    symbol: str  # Token symbol to hide (e.g., "SHIT", "DROID")
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class HiddenTokenRequest(BaseModel):
    symbol: str

# ==================== FIAT MODELS ====================

class FiatAccountCreate(BaseModel):
    name: str
    currency: str = "EUR"
    initial_balance: float = 0.0

class FiatAccount(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    currency: str = "EUR"
    balance: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class FiatTransactionCreate(BaseModel):
    type: str  # deposit, withdrawal, crypto_buy, crypto_sell, transfer
    amount: float
    description: str = ""
    account_id: str
    related_tx_id: Optional[str] = None
    date: Optional[str] = None
    # Source (origine)
    source_type: str = "bank"  # "bank" ou "wallet"
    source_account_id: Optional[str] = None  # ID du compte fiat si bank
    source_wallet_id: Optional[str] = None  # ID du wallet si wallet
    source_wallet_address: Optional[str] = None  # Adresse du wallet
    # Destination
    dest_type: str = "bank"  # "bank" ou "wallet"
    dest_account_id: Optional[str] = None  # ID du compte fiat si bank
    dest_wallet_id: Optional[str] = None  # ID du wallet si wallet
    dest_wallet_address: Optional[str] = None  # Adresse du wallet
    # Crypto conversion fields (for crypto_buy/crypto_sell)
    crypto_asset: Optional[str] = None  # EURC, EURA, USDC, etc.
    crypto_amount: Optional[float] = None  # Amount of crypto bought/sold

class FiatTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str
    amount: float
    description: str = ""
    account_id: str
    related_tx_id: Optional[str] = None
    linked_tx_id: Optional[str] = None  # ID de la transaction liée (contrepartie)
    date: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    # Source (origine)
    source_type: str = "bank"
    source_account_id: Optional[str] = None
    source_wallet_id: Optional[str] = None
    source_wallet_address: Optional[str] = None
    source_name: Optional[str] = None  # Nom lisible (ex: "Banque Principale" ou "Wallet ETH")
    # Destination
    dest_type: str = "bank"
    dest_account_id: Optional[str] = None
    dest_wallet_id: Optional[str] = None
    dest_wallet_address: Optional[str] = None
    dest_name: Optional[str] = None  # Nom lisible
    # Running balance (calculé)
    running_balance: Optional[float] = None

class FiatTransactionUpdate(BaseModel):
    """Model for updating an existing fiat transaction"""
    type: Optional[str] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    date: Optional[str] = None
    source_type: Optional[str] = None
    source_account_id: Optional[str] = None
    source_wallet_id: Optional[str] = None
    source_wallet_address: Optional[str] = None
    dest_type: Optional[str] = None
    dest_account_id: Optional[str] = None
    dest_wallet_id: Optional[str] = None
    dest_wallet_address: Optional[str] = None

class CSVImportRequest(BaseModel):
    wallet_id: str
    csv_data: str

# ==================== POSITIONS/INVESTMENTS MODELS ====================

class PositionCreate(BaseModel):
    platform: str  # Bleap, Neverless, Frankencoin, 8Lends...
    product_type: str  # savings, vault, strategy, prime, lending, staking...
    asset: str  # EURA, EURC, ZCHF, USDC...
    amount: float
    apy: float = 0.0  # Taux annuel en %
    deposit_date: Optional[str] = None
    unlock_date: Optional[str] = None  # Date de déblocage (pour produits à terme)
    notes: str = ""
    source_wallet_id: Optional[str] = None  # Wallet source pour interdépendance
    create_withdrawal_tx: bool = False  # Créer une transaction de retrait dans le wallet source
    # Règles d'affectation automatique
    rule_address: Optional[str] = None  # Adresse pour matcher les transactions
    rule_asset: Optional[str] = None  # Asset pour matcher les transactions
    rule_enabled: bool = False  # Activer/désactiver la règle

class Position(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    platform: str
    product_type: str
    asset: str
    amount: float
    apy: float = 0.0
    deposit_date: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    unlock_date: Optional[str] = None
    notes: str = ""
    source_wallet_id: Optional[str] = None  # Wallet source lié
    linked_tx_id: Optional[str] = None  # Transaction de retrait liée
    # Règles d'affectation automatique
    rule_address: Optional[str] = None  # Adresse pour matcher les transactions
    rule_asset: Optional[str] = None  # Asset pour matcher les transactions
    rule_enabled: bool = False  # Activer/désactiver la règle
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PositionUpdate(BaseModel):
    platform: Optional[str] = None
    product_type: Optional[str] = None
    asset: Optional[str] = None
    amount: Optional[float] = None
    apy: Optional[float] = None
    deposit_date: Optional[str] = None
    unlock_date: Optional[str] = None
    notes: Optional[str] = None
    # Règles d'affectation automatique
    rule_address: Optional[str] = None
    rule_asset: Optional[str] = None
    rule_enabled: Optional[bool] = None

# ==================== POSITION MOVEMENTS MODELS ====================

class PositionMovementCreate(BaseModel):
    position_id: str
    movement_type: str  # yield_realized, capital_withdrawal, impermanent_loss
    amount: float
    asset: str  # Asset reçu ou perdu
    date: Optional[str] = None
    tx_hash: Optional[str] = None  # Hash de transaction si on-chain
    notes: str = ""
    target_wallet_id: Optional[str] = None  # Wallet destinataire pour interdépendance
    create_deposit_tx: bool = False  # Créer une transaction de dépôt dans le wallet

class PositionMovement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    position_id: str
    movement_type: str  # yield_realized, capital_withdrawal, impermanent_loss
    amount: float
    asset: str
    date: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    tx_hash: Optional[str] = None
    notes: str = ""
    target_wallet_id: Optional[str] = None  # Wallet destinataire lié
    linked_tx_id: Optional[str] = None  # Transaction de dépôt liée
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PositionMovementUpdate(BaseModel):
    movement_type: Optional[str] = None
    amount: Optional[float] = None
    asset: Optional[str] = None
    date: Optional[str] = None
    tx_hash: Optional[str] = None
    notes: Optional[str] = None

# ==================== API KEY MODELS ====================

class EtherscanApiKeyRequest(BaseModel):
    api_key: str

class EtherscanSyncRequest(BaseModel):
    api_key: Optional[str] = None

# ==================== P&L MODELS ====================

class PLReport(BaseModel):
    asset: str
    total_bought: float
    total_sold: float
    total_cost_eur: float
    total_proceeds_eur: float
    realized_pnl_eur: float
    unrealized_pnl_eur: float
    current_holdings: float
    current_value_eur: float
    total_fees_eur: float

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = credentials.credentials
    payload = decode_token(token)
    
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

async def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[dict]:
    """Get current user or None if not authenticated"""
    if not credentials:
        return None
    try:
        return await get_current_user(credentials)
    except:
        return None

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    """Register a new user"""
    # Check if user exists
    existing = await db.users.find_one({
        "$or": [
            {"email": user_data.email},
            {"username": user_data.username}
        ]
    })
    
    if existing:
        raise HTTPException(status_code=409, detail="User with this email or username already exists")
    
    # Create user
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "username": user_data.username,
        "full_name": user_data.full_name,
        "hashed_password": hash_password(user_data.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    
    await db.users.insert_one(user_doc)
    
    # Create tokens
    token_data = {"sub": user_id, "email": user_data.email}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login user and return tokens"""
    user = await db.users.find_one({
        "$or": [
            {"username": credentials.username},
            {"email": credentials.username}
        ]
    }, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is disabled")
    
    token_data = {"sub": user["id"], "email": user["email"]}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)

@api_router.post("/auth/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshTokenRequest):
    """Refresh access token"""
    payload = decode_token(request.refresh_token)
    
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    
    user_id = payload.get("sub")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="User not found or inactive")
    
    token_data = {"sub": user_id, "email": user["email"]}
    new_access_token = create_access_token(token_data)
    new_refresh_token = create_refresh_token(token_data)
    
    return TokenResponse(access_token=new_access_token, refresh_token=new_refresh_token)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        username=current_user["username"],
        full_name=current_user.get("full_name"),
        created_at=current_user["created_at"]
    )

# ==================== CRYPTO PRICE ENDPOINTS ====================

@api_router.get("/crypto/prices")
async def get_crypto_prices():
    """Get live prices for tracked stablecoins"""
    try:
        coin_ids = ",".join(STABLECOIN_IDS.values())
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{COINGECKO_API_URL}/simple/price",
                params={
                    "ids": coin_ids,
                    "vs_currencies": "usd,eur",
                    "include_24hr_change": "true"
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                data = response.json()
                result = {}
                for symbol, coin_id in STABLECOIN_IDS.items():
                    if coin_id in data:
                        result[symbol] = {
                            "price_usd": data[coin_id].get("usd", 0),
                            "price_eur": data[coin_id].get("eur", 0),
                            "change_24h": data[coin_id].get("usd_24h_change", 0)
                        }
                return result
            else:
                return get_fallback_prices()
    except Exception as e:
        logger.error(f"Error fetching prices: {e}")
        return get_fallback_prices()

def get_fallback_prices():
    return {
        "USDC": {"price_usd": 1.0, "price_eur": 0.92, "change_24h": 0},
        "USDC.e": {"price_usd": 1.0, "price_eur": 0.92, "change_24h": 0},
        "EURC": {"price_usd": 1.09, "price_eur": 1.0, "change_24h": 0},
        "AGEUR": {"price_usd": 1.09, "price_eur": 1.0, "change_24h": 0},
        "ZCHF": {"price_usd": 1.12, "price_eur": 1.03, "change_24h": 0},
        "USDT": {"price_usd": 1.0, "price_eur": 0.92, "change_24h": 0},
        "DAI": {"price_usd": 1.0, "price_eur": 0.92, "change_24h": 0}
    }

@api_router.get("/crypto/historical/{symbol}")
async def get_historical_prices(symbol: str, days: int = 30):
    """Get historical price data"""
    coin_id = STABLECOIN_IDS.get(symbol.upper())
    if not coin_id:
        raise HTTPException(status_code=404, detail="Coin not found")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{COINGECKO_API_URL}/coins/{coin_id}/market_chart",
                params={"vs_currency": "usd", "days": days},
                timeout=10.0
            )
            
            if response.status_code == 200:
                data = response.json()
                return {"symbol": symbol, "prices": data.get("prices", [])}
            else:
                return {"symbol": symbol, "prices": []}
    except Exception as e:
        logger.error(f"Error fetching historical prices: {e}")
        return {"symbol": symbol, "prices": []}

# ==================== MULTI-CHAIN ENDPOINTS ====================

@api_router.get("/chains")
async def get_supported_chains():
    """Get list of supported blockchain networks"""
    chains = []
    for chain_name, chain_info in CHAIN_SCANNERS.items():
        contracts = STABLECOIN_CONTRACTS_BY_CHAIN.get(chain_name, {})
        chains.append({
            "name": chain_name,
            "scanner_name": chain_info["name"],
            "explorer_url": chain_info["explorer"],
            "supported_tokens": list(contracts.keys())
        })
    return {"chains": chains}

@api_router.get("/chains/{chain_name}/tokens")
async def get_chain_tokens(chain_name: str):
    """Get supported tokens for a specific chain"""
    if chain_name not in CHAIN_SCANNERS:
        raise HTTPException(status_code=404, detail=f"Chain {chain_name} not supported")
    
    contracts = STABLECOIN_CONTRACTS_BY_CHAIN.get(chain_name, {})
    return {
        "chain": chain_name,
        "tokens": [
            {"symbol": symbol, "contract": address}
            for symbol, address in contracts.items()
        ]
    }

# ==================== ETHERSCAN API KEY MANAGEMENT ====================

@api_router.post("/etherscan/set-api-key")
async def set_etherscan_api_key(
    request: EtherscanApiKeyRequest,
    current_user: dict = Depends(get_current_user)
):
    """Set Etherscan API key for current session (cleared on logout/app restart)"""
    user_id = current_user["id"]
    user_api_keys[user_id] = request.api_key
    return {"message": "API key set successfully for this session"}

@api_router.delete("/etherscan/clear-api-key")
async def clear_etherscan_api_key(current_user: dict = Depends(get_current_user)):
    """Clear Etherscan API key for current user"""
    user_id = current_user["id"]
    if user_id in user_api_keys:
        del user_api_keys[user_id]
    return {"message": "API key cleared"}

@api_router.get("/etherscan/has-api-key")
async def check_etherscan_api_key(current_user: dict = Depends(get_current_user)):
    """Check if user has an API key set for this session"""
    user_id = current_user["id"]
    has_key = user_id in user_api_keys and bool(user_api_keys[user_id])
    return {"has_api_key": has_key}

# ==================== ETHERSCAN SYNC ENDPOINTS ====================

@api_router.post("/etherscan/sync/{wallet_id}")
async def sync_wallet_from_etherscan(
    wallet_id: str,
    request: Optional[EtherscanSyncRequest] = None,
    current_user: dict = Depends(get_current_user)
):
    """Sync transactions from blockchain scanner for a wallet. API key required for Etherscan networks, not for Blockscout."""
    user_id = current_user["id"]
    
    # Get wallet first to check network
    wallet = await db.wallets.find_one({"id": wallet_id, "user_id": user_id}, {"_id": 0})
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    
    if wallet.get("type") == "manual":
        raise HTTPException(status_code=400, detail="Cannot sync manual wallets")
    
    network = wallet.get("network", "Ethereum")
    
    # Check if network uses Blockscout (no API key needed)
    if network not in CHAIN_SCANNERS:
        raise HTTPException(status_code=400, detail=f"Network {network} not supported for blockchain sync")
    
    chain_info = CHAIN_SCANNERS[network]
    api_type = chain_info.get("api_type", "etherscan")
    
    # Get API key from request body or session (only needed for etherscan networks)
    api_key = None
    if api_type != "blockscout":
        if request and request.api_key:
            api_key = request.api_key
            # Store in session for future use
            user_api_keys[user_id] = api_key
        elif user_id in user_api_keys:
            api_key = user_api_keys[user_id]
        
        if not api_key:
            raise HTTPException(
                status_code=400, 
                detail="API_KEY_REQUIRED",
                headers={"X-Error-Code": "API_KEY_REQUIRED"}
            )
    
    address = wallet["address"]
    chain_id = chain_info["chain_id"]
    scanner_name = chain_info["name"]
    native_symbol = chain_info.get("native_symbol", "ETH")
    
    imported_count = 0
    
    try:
        async with httpx.AsyncClient() as client:
            # 1. Get native token (ETH/MATIC/etc) transactions using V2 API
            response = await client.get(
                ETHERSCAN_V2_API,
                params={
                    "chainid": chain_id,
                    "module": "account",
                    "action": "txlist",
                    "address": address,
                    "sort": "desc",
                    "apikey": api_key
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for API key errors
                if data.get("message") == "NOTOK" and "Invalid API" in str(data.get("result", "")):
                    if user_id in user_api_keys:
                        del user_api_keys[user_id]
                    raise HTTPException(status_code=401, detail=f"Invalid {scanner_name} API key")
                
                if data.get("status") == "1" and data.get("result"):
                    for tx in data["result"]:
                        # Skip failed transactions and contract creations
                        if tx.get("isError") == "1" or not tx.get("value") or tx["value"] == "0":
                            continue
                            
                        existing = await db.transactions.find_one({
                            "tx_hash": tx["hash"],
                            "user_id": user_id,
                            "asset": native_symbol
                        })
                        
                        if not existing:
                            is_incoming = tx["to"].lower() == address.lower()
                            tx_type = "Transfer In" if is_incoming else "Transfer Out"
                            amount = float(tx["value"]) / (10 ** 18)
                            
                            timestamp = int(tx["timeStamp"])
                            tx_date = datetime.fromtimestamp(timestamp, tz=timezone.utc)
                            
                            # Get current price (approximate)
                            price_usd = 2500.0 if native_symbol == "ETH" else 1.0
                            price_eur = price_usd * 0.92
                            
                            transaction = Transaction(
                                user_id=user_id,
                                type=tx_type,
                                asset=native_symbol,
                                amount=amount if is_incoming else -amount,
                                price_usd=price_usd,
                                price_eur=price_eur,
                                value_usd=amount * price_usd,
                                value_eur=amount * price_eur,
                                fees=float(tx.get("gasUsed", 0)) * float(tx.get("gasPrice", 0)) / (10 ** 18),
                                wallet_id=wallet_id,
                                wallet_name=f"{wallet['name']} ({network})",
                                source=f"blockchain_{network.lower()}",
                                date=tx_date.strftime("%Y-%m-%d"),
                                tx_hash=tx["hash"],
                                counterparty_wallet=tx["from"] if is_incoming else tx["to"]
                            )
                            
                            await db.transactions.insert_one(transaction.model_dump())
                            imported_count += 1
            
            # 2. Get ALL token transfers (not just stablecoins) using V2 API
            response = await client.get(
                ETHERSCAN_V2_API,
                params={
                    "chainid": chain_id,
                    "module": "account",
                    "action": "tokentx",
                    "address": address,
                    "sort": "desc",
                    "apikey": api_key
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("status") == "1" and data.get("result"):
                    for tx in data["result"]:
                        existing = await db.transactions.find_one({
                            "tx_hash": tx["hash"],
                            "user_id": user_id,
                            "asset": tx.get("tokenSymbol", "UNKNOWN")
                        })
                        
                        if not existing:
                            is_incoming = tx["to"].lower() == address.lower()
                            tx_type = "Transfer In" if is_incoming else "Transfer Out"
                            
                            decimals = int(tx.get("tokenDecimal", 18))
                            amount = float(tx["value"]) / (10 ** decimals)
                            symbol = tx.get("tokenSymbol", "UNKNOWN")
                            
                            timestamp = int(tx["timeStamp"])
                            tx_date = datetime.fromtimestamp(timestamp, tz=timezone.utc)
                            
                            # Estimate prices for common tokens
                            if symbol in ["USDC", "USDC.e", "USDT", "DAI", "BUSD"]:
                                price_usd, price_eur = 1.0, 0.92
                            elif symbol in ["EURC", "EURS", "EURT"]:
                                price_usd, price_eur = 1.09, 1.0
                            elif symbol in ["WETH", "WMATIC", "WBNB"]:
                                price_usd, price_eur = 2500.0, 2300.0
                            else:
                                price_usd, price_eur = 0.0, 0.0  # Unknown token
                            
                            transaction = Transaction(
                                user_id=user_id,
                                type=tx_type,
                                asset=symbol,
                                amount=amount if is_incoming else -amount,
                                price_usd=price_usd,
                                price_eur=price_eur,
                                value_usd=amount * price_usd,
                                value_eur=amount * price_eur,
                                fees=float(tx.get("gasUsed", 0)) * float(tx.get("gasPrice", 0)) / (10 ** 18),
                                fees_currency="ETH",  # Gas fees are in ETH
                                wallet_id=wallet_id,
                                wallet_name=f"{wallet['name']} ({network})",
                                source=f"blockchain_{network.lower()}",
                                date=tx_date.strftime("%Y-%m-%d"),
                                tx_hash=tx["hash"],
                                counterparty_wallet=tx["from"] if is_incoming else tx["to"]
                            )
                            
                            await db.transactions.insert_one(transaction.model_dump())
                            imported_count += 1
        
        return {
            "message": f"Synced {imported_count} new transactions from {scanner_name}", 
            "imported_count": imported_count,
            "network": network,
            "scanner": scanner_name
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Blockchain sync error for {network}: {e}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

@api_router.get("/etherscan/status")
async def get_etherscan_status(current_user: dict = Depends(get_current_user)):
    """Check if user has API key set for this session"""
    user_id = current_user["id"]
    has_key = user_id in user_api_keys and bool(user_api_keys[user_id])
    return {
        "has_api_key": has_key,
        "supported_chains": list(CHAIN_SCANNERS.keys())
    }

@api_router.post("/etherscan/sync-all")
async def sync_all_wallets(request: Optional[EtherscanSyncRequest] = None, current_user: dict = Depends(get_current_user)):
    """Sync all wallets for the current user. Blockscout networks (Base, Optimism) don't require API key."""
    user_id = current_user["id"]
    
    # Get API key (optional for Blockscout networks)
    api_key = None
    if request and request.api_key:
        api_key = request.api_key
        user_api_keys[user_id] = api_key
    elif user_id in user_api_keys:
        api_key = user_api_keys[user_id]
    
    # Get all blockchain wallets (not manual)
    wallets = await db.wallets.find({
        "user_id": user_id,
        "type": {"$ne": "manual"}
    }, {"_id": 0}).to_list(100)
    
    if not wallets:
        return {"message": "No blockchain wallets to sync", "total_imported": 0, "wallets_synced": 0}
    
    total_imported = 0
    wallets_synced = 0
    errors = []
    skipped = []
    
    for wallet in wallets:
        try:
            network = wallet.get("network", "Ethereum")
            chain_info = CHAIN_SCANNERS.get(network, {})
            api_type = chain_info.get("api_type", "etherscan")
            
            # Skip Etherscan networks if no API key
            if api_type != "blockscout" and not api_key:
                skipped.append(f"{wallet['name']} ({network}): API key required")
                continue
            
            # Create a request with the API key (or None for Blockscout)
            sync_request = EtherscanSyncRequest(api_key=api_key) if api_key else None
            result = await sync_wallet_from_etherscan(wallet["id"], sync_request, current_user)
            total_imported += result.get("imported_count", 0)
            wallets_synced += 1
        except Exception as e:
            errors.append(f"{wallet['name']}: {str(e)}")
    
    return {
        "message": f"Synced {wallets_synced} wallets, {total_imported} new transactions",
        "total_imported": total_imported,
        "wallets_synced": wallets_synced,
        "skipped": skipped if skipped else None,
        "errors": errors if errors else None
    }

class SyncChainRequest(BaseModel):
    api_key: Optional[str] = None
    address: str
    chain: str

@api_router.post("/etherscan/sync-chain")
async def sync_address_on_chain(request: SyncChainRequest, current_user: dict = Depends(get_current_user)):
    """Sync a specific address on a specific blockchain"""
    user_id = current_user["id"]
    
    # Get API key
    api_key = None
    if request.api_key:
        api_key = request.api_key
        user_api_keys[user_id] = api_key
    elif user_id in user_api_keys:
        api_key = user_api_keys[user_id]
    
    address = request.address
    network = request.chain
    
    if network not in CHAIN_SCANNERS:
        raise HTTPException(status_code=400, detail=f"Network {network} not supported")
    
    chain_info = CHAIN_SCANNERS[network]
    chain_id = chain_info["chain_id"]
    native_symbol = chain_info.get("native_symbol", "ETH")
    api_type = chain_info.get("api_type", "etherscan")
    
    # For Blockscout chains (Base, Optimism), API key is not required
    if api_type == "etherscan" and not api_key:
        raise HTTPException(
            status_code=400,
            detail="API_KEY_REQUIRED",
            headers={"X-Error-Code": "API_KEY_REQUIRED"}
        )
    
    # Find or create a wallet entry for this address on this chain
    existing_wallet = await db.wallets.find_one({
        "user_id": user_id,
        "address": {"$regex": f"^{address}$", "$options": "i"},
        "network": network
    }, {"_id": 0})
    
    if not existing_wallet:
        # Find any wallet with this address to get the name
        any_wallet = await db.wallets.find_one({
            "user_id": user_id,
            "address": {"$regex": f"^{address}$", "$options": "i"}
        }, {"_id": 0})
        
        wallet_name = any_wallet["name"] if any_wallet else f"Wallet {address[:8]}"
        
        # Create a new wallet for this chain
        new_wallet = Wallet(
            user_id=user_id,
            name=f"{wallet_name} ({network})",
            address=address,
            network=network,
            type="address"
        )
        await db.wallets.insert_one(new_wallet.model_dump())
        wallet_id = new_wallet.id
        wallet_name_full = new_wallet.name
    else:
        wallet_id = existing_wallet["id"]
        wallet_name_full = existing_wallet["name"]
    
    imported_count = 0
    
    try:
        async with httpx.AsyncClient() as client:
            if api_type == "blockscout":
                # Use Blockscout API for Base and Optimism (FREE, no API key needed)
                blockscout_url = BLOCKSCOUT_APIS.get(network)
                
                # Get all transactions with pagination
                next_page_params = None
                page_count = 0
                max_pages = 20  # Limit to avoid infinite loops
                
                while page_count < max_pages:
                    url = f"{blockscout_url}/addresses/{address}/transactions"
                    params = {}
                    if next_page_params:
                        params = next_page_params
                    
                    response = await client.get(url, params=params, timeout=30.0)
                    
                    if response.status_code != 200:
                        break
                    
                    data = response.json()
                    items = data.get("items", [])
                    
                    if not items:
                        break
                    
                    for tx in items:
                        value_wei = int(tx.get("value", "0"))
                        tx_hash = tx.get("hash", "")
                        
                        existing = await db.transactions.find_one({
                            "tx_hash": tx_hash,
                            "user_id": user_id,
                            "source": f"blockchain_{network.lower()}"
                        })
                        
                        if not existing and value_wei > 0:
                            is_incoming = tx.get("to", {}).get("hash", "").lower() == address.lower()
                            tx_type = "Transfer In" if is_incoming else "Transfer Out"
                            amount = value_wei / (10 ** 18)
                            
                            tx_date = datetime.fromisoformat(tx.get("timestamp", "").replace("Z", "+00:00"))
                            
                            price_usd = 2500.0 if native_symbol == "ETH" else 1.0
                            price_eur = price_usd * 0.92
                            
                            transaction = Transaction(
                                user_id=user_id,
                                type=tx_type,
                                asset=native_symbol,
                                amount=amount if is_incoming else -amount,
                                price_usd=price_usd,
                                price_eur=price_eur,
                                value_usd=amount * price_usd,
                                value_eur=amount * price_eur,
                                fees=float(tx.get("gas_used", 0)) * float(tx.get("gas_price", 0)) / (10 ** 18),
                                wallet_id=wallet_id,
                                wallet_name=wallet_name_full,
                                source=f"blockchain_{network.lower()}",
                                date=tx_date.strftime("%Y-%m-%d"),
                                tx_hash=tx_hash,
                                counterparty_wallet=tx.get("from", {}).get("hash", "") if is_incoming else tx.get("to", {}).get("hash", "")
                            )
                            
                            await db.transactions.insert_one(transaction.model_dump())
                            imported_count += 1
                    
                    # Check for next page
                    next_page_params = data.get("next_page_params")
                    if not next_page_params:
                        break
                    page_count += 1
                
                # Get ALL token transfers with pagination
                next_page_params = None
                page_count = 0
                
                while page_count < max_pages:
                    url = f"{blockscout_url}/addresses/{address}/token-transfers"
                    params = {}
                    if next_page_params:
                        params = next_page_params
                    
                    response = await client.get(url, params=params, timeout=30.0)
                    
                    if response.status_code != 200:
                        break
                    
                    data = response.json()
                    items = data.get("items", [])
                    
                    for tx in items:
                        tx_hash = tx.get("transaction_hash", "")
                        token = tx.get("token", {}) or {}
                        symbol = token.get("symbol", "UNKNOWN") or "UNKNOWN"
                        decimals = int(token.get("decimals") or 18)
                        
                        logger.info(f"Processing token transfer: {tx_hash[:20]}... | {symbol}")
                        
                        if not tx_hash or not symbol:
                            logger.info(f"  Skipping: no tx_hash or symbol")
                            continue
                        
                        existing = await db.transactions.find_one({
                            "tx_hash": tx_hash,
                            "user_id": user_id,
                            "asset": symbol,
                            "source": f"blockchain_{network.lower()}"
                        })
                        
                        if existing:
                            logger.info(f"  Skipping: already exists")
                        
                        if not existing:
                            to_addr = tx.get("to", {}) or {}
                            from_addr = tx.get("from", {}) or {}
                            is_incoming = to_addr.get("hash", "").lower() == address.lower()
                            tx_type = "Transfer In" if is_incoming else "Transfer Out"
                            
                            total_value = tx.get("total", {}) or {}
                            raw_value = total_value.get("value") or total_value.get("amount") or "0"
                            amount = float(raw_value) / (10 ** decimals)
                            
                            timestamp_str = tx.get("timestamp", "")
                            if timestamp_str:
                                tx_date = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                            else:
                                tx_date = datetime.now(timezone.utc)
                            
                            if symbol in ["USDC", "USDC.e", "USDT", "DAI", "BUSD"]:
                                price_usd, price_eur = 1.0, 0.92
                            elif symbol in ["EURC", "EURS", "EURT"]:
                                price_usd, price_eur = 1.09, 1.0
                            else:
                                price_usd, price_eur = 0.0, 0.0
                            
                            transaction = Transaction(
                                user_id=user_id,
                                type=tx_type,
                                asset=symbol,
                                amount=amount if is_incoming else -amount,
                                price_usd=price_usd,
                                price_eur=price_eur,
                                value_usd=amount * price_usd,
                                value_eur=amount * price_eur,
                                fees=0,  # Gas fees not available in token-transfers API
                                wallet_id=wallet_id,
                                wallet_name=wallet_name_full,
                                source=f"blockchain_{network.lower()}",
                                date=tx_date.strftime("%Y-%m-%d"),
                                tx_hash=tx_hash,
                                counterparty_wallet=from_addr.get("hash", "") if is_incoming else to_addr.get("hash", ""),
                                notes=""
                            )
                            
                            await db.transactions.insert_one(transaction.model_dump())
                            imported_count += 1
                            
                            # Double-entry: Check if counterparty is also user's wallet
                            counterparty_address = from_addr.get("hash", "") if is_incoming else to_addr.get("hash", "")
                            if counterparty_address:
                                counterparty_wallet = await db.wallets.find_one({
                                    "user_id": user_id,
                                    "address": {"$regex": f"^{counterparty_address}$", "$options": "i"}
                                }, {"_id": 0})
                                
                                if counterparty_wallet:
                                    # Check if mirror transaction already exists
                                    mirror_type = "Transfer Out" if is_incoming else "Transfer In"
                                    mirror_existing = await db.transactions.find_one({
                                        "tx_hash": tx_hash,
                                        "user_id": user_id,
                                        "asset": symbol,
                                        "wallet_id": counterparty_wallet["id"]
                                    })
                                    
                                    if not mirror_existing:
                                        # Create mirror transaction in counterparty wallet
                                        mirror_tx = Transaction(
                                            user_id=user_id,
                                            type=mirror_type,
                                            asset=symbol,
                                            amount=-amount if is_incoming else amount,  # Opposite sign
                                            price_usd=price_usd,
                                            price_eur=price_eur,
                                            value_usd=amount * price_usd,
                                            value_eur=amount * price_eur,
                                            fees=0,
                                            wallet_id=counterparty_wallet["id"],
                                            wallet_name=counterparty_wallet["name"],
                                            source=f"blockchain_{network.lower()}",
                                            date=tx_date.strftime("%Y-%m-%d"),
                                            tx_hash=tx_hash,
                                            counterparty_wallet=address,  # Original wallet is the counterparty
                                            linked_tx_id=transaction.id,  # Link to original
                                            notes="Double-entry automatique"
                                        )
                                        
                                        await db.transactions.insert_one(mirror_tx.model_dump())
                                        
                                        # Update original transaction with link
                                        await db.transactions.update_one(
                                            {"id": transaction.id},
                                            {"$set": {"linked_tx_id": mirror_tx.id}}
                                        )
                                        imported_count += 1
                    
                    # Check for next page
                    next_page_params = data.get("next_page_params")
                    if not next_page_params:
                        break
                    page_count += 1
            
            else:
                # Use Etherscan V2 API for Ethereum, Polygon, Arbitrum
                # 1. Get native token transactions
                response = await client.get(
                    ETHERSCAN_V2_API,
                    params={
                        "chainid": chain_id,
                        "module": "account",
                        "action": "txlist",
                        "address": address,
                        "sort": "desc",
                        "apikey": api_key
                    },
                    timeout=30.0
                )
            
                if response.status_code == 200:
                    data = response.json()
                    
                    if data.get("status") == "1" and data.get("result"):
                        for tx in data["result"]:
                            if tx.get("isError") == "1" or not tx.get("value") or tx["value"] == "0":
                                continue
                                
                            existing = await db.transactions.find_one({
                                "tx_hash": tx["hash"],
                                "user_id": user_id,
                                "asset": native_symbol,
                                "source": f"blockchain_{network.lower()}"
                            })
                            
                            if not existing:
                                is_incoming = tx["to"].lower() == address.lower()
                                tx_type = "Transfer In" if is_incoming else "Transfer Out"
                                amount = float(tx["value"]) / (10 ** 18)
                                
                                timestamp = int(tx["timeStamp"])
                                tx_date = datetime.fromtimestamp(timestamp, tz=timezone.utc)
                                
                                price_usd = 2500.0 if native_symbol == "ETH" else 1.0
                                price_eur = price_usd * 0.92
                                
                                transaction = Transaction(
                                    user_id=user_id,
                                    type=tx_type,
                                    asset=native_symbol,
                                    amount=amount if is_incoming else -amount,
                                    price_usd=price_usd,
                                    price_eur=price_eur,
                                    value_usd=amount * price_usd,
                                    value_eur=amount * price_eur,
                                    fees=float(tx.get("gasUsed", 0)) * float(tx.get("gasPrice", 0)) / (10 ** 18),
                                    wallet_id=wallet_id,
                                    wallet_name=wallet_name_full,
                                    source=f"blockchain_{network.lower()}",
                                    date=tx_date.strftime("%Y-%m-%d"),
                                    tx_hash=tx["hash"],
                                    counterparty_wallet=tx["from"] if is_incoming else tx["to"]
                                )
                                
                                await db.transactions.insert_one(transaction.model_dump())
                                imported_count += 1
                
                # 2. Get token transfers
                response = await client.get(
                    ETHERSCAN_V2_API,
                    params={
                        "chainid": chain_id,
                        "module": "account",
                        "action": "tokentx",
                        "address": address,
                        "sort": "desc",
                        "apikey": api_key
                    },
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if data.get("status") == "1" and data.get("result"):
                        for tx in data["result"]:
                            symbol = tx.get("tokenSymbol", "UNKNOWN")
                            existing = await db.transactions.find_one({
                                "tx_hash": tx["hash"],
                                "user_id": user_id,
                                "asset": symbol,
                                "source": f"blockchain_{network.lower()}"
                            })
                            
                            if not existing:
                                is_incoming = tx["to"].lower() == address.lower()
                                tx_type = "Transfer In" if is_incoming else "Transfer Out"
                                
                                decimals = int(tx.get("tokenDecimal", 18))
                                amount = float(tx["value"]) / (10 ** decimals)
                                
                                timestamp = int(tx["timeStamp"])
                                tx_date = datetime.fromtimestamp(timestamp, tz=timezone.utc)
                                
                                if symbol in ["USDC", "USDC.e", "USDT", "DAI", "BUSD"]:
                                    price_usd, price_eur = 1.0, 0.92
                                elif symbol in ["EURC", "EURS", "EURT"]:
                                    price_usd, price_eur = 1.09, 1.0
                                else:
                                    price_usd, price_eur = 0.0, 0.0
                                
                                transaction = Transaction(
                                    user_id=user_id,
                                    type=tx_type,
                                    asset=symbol,
                                    amount=amount if is_incoming else -amount,
                                    price_usd=price_usd,
                                    price_eur=price_eur,
                                    value_usd=amount * price_usd,
                                    value_eur=amount * price_eur,
                                    fees=0,
                                    wallet_id=wallet_id,
                                    wallet_name=wallet_name_full,
                                    source=f"blockchain_{network.lower()}",
                                    date=tx_date.strftime("%Y-%m-%d"),
                                    tx_hash=tx["hash"],
                                    counterparty_wallet=tx["from"] if is_incoming else tx["to"]
                                )
                                
                                await db.transactions.insert_one(transaction.model_dump())
                                imported_count += 1
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    return {
        "message": f"Synced {imported_count} transactions from {network}",
        "imported_count": imported_count,
        "network": network,
        "address": address
    }

# ==================== WALLET ENDPOINTS ====================

@api_router.post("/wallets", response_model=dict)
async def create_wallet(wallet_data: WalletCreate, current_user: dict = Depends(get_current_user)):
    """Create a new wallet"""
    wallet = Wallet(
        user_id=current_user["id"],
        **wallet_data.model_dump()
    )
    doc = wallet.model_dump()
    await db.wallets.insert_one(doc)
    return {"id": wallet.id, "name": wallet.name, "message": "Wallet created"}

@api_router.get("/wallets")
async def get_wallets(current_user: dict = Depends(get_current_user)):
    """Get all wallets for current user"""
    wallets = await db.wallets.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    return wallets

@api_router.get("/wallets/{wallet_id}")
async def get_wallet(wallet_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific wallet"""
    wallet = await db.wallets.find_one({"id": wallet_id, "user_id": current_user["id"]}, {"_id": 0})
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return wallet

@api_router.delete("/wallets/{wallet_id}")
async def delete_wallet(wallet_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a wallet and all its transactions"""
    result = await db.wallets.delete_one({"id": wallet_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Wallet not found")
    
    await db.transactions.delete_many({"wallet_id": wallet_id, "user_id": current_user["id"]})
    return {"message": "Wallet and related transactions deleted"}

@api_router.delete("/wallets")
async def delete_all_wallets(current_user: dict = Depends(get_current_user)):
    """Delete all wallets and transactions for current user"""
    await db.wallets.delete_many({"user_id": current_user["id"]})
    await db.transactions.delete_many({"user_id": current_user["id"]})
    return {"message": "All wallets and transactions deleted"}

# ==================== TRANSACTION ENDPOINTS ====================

# ==================== ADDRESS CLASSIFICATION ENDPOINTS ====================

@api_router.post("/addresses/classify")
async def classify_address(request: AddressClassificationRequest, current_user: dict = Depends(get_current_user)):
    """Classify a counterparty address as trusted, suspicious, or neutral"""
    user_id = current_user["id"]
    
    if request.classification not in ["trusted", "suspicious", "neutral"]:
        raise HTTPException(status_code=400, detail="Classification must be 'trusted', 'suspicious', or 'neutral'")
    
    # Check if classification exists
    existing = await db.address_classifications.find_one({
        "user_id": user_id,
        "address": request.address.lower()
    })
    
    if existing:
        # Update existing
        await db.address_classifications.update_one(
            {"user_id": user_id, "address": request.address.lower()},
            {"$set": {"classification": request.classification, "label": request.label}}
        )
        return {"message": f"Address classification updated to {request.classification}", "classification": request.classification}
    else:
        # Create new
        classification = AddressClassification(
            user_id=user_id,
            address=request.address.lower(),
            classification=request.classification,
            label=request.label
        )
        await db.address_classifications.insert_one(classification.model_dump())
        return {"message": f"Address classified as {request.classification}", "classification": request.classification}

@api_router.get("/addresses/classifications")
async def get_address_classifications(current_user: dict = Depends(get_current_user)):
    """Get all address classifications for the current user"""
    user_id = current_user["id"]
    classifications = await db.address_classifications.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    return {"classifications": classifications}

@api_router.delete("/addresses/classify/{address}")
async def remove_address_classification(address: str, current_user: dict = Depends(get_current_user)):
    """Remove classification from an address"""
    user_id = current_user["id"]
    result = await db.address_classifications.delete_one({
        "user_id": user_id,
        "address": address.lower()
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Classification not found")
    return {"message": "Classification removed"}

# ==================== HIDDEN TOKENS ENDPOINTS ====================

@api_router.post("/hidden-tokens")
async def add_hidden_token(request: HiddenTokenRequest, current_user: dict = Depends(get_current_user)):
    """Add a token to the hidden list"""
    user_id = current_user["id"]
    symbol = request.symbol.upper().strip()
    
    # Check if already hidden
    existing = await db.hidden_tokens.find_one({
        "user_id": user_id,
        "symbol": symbol
    })
    
    if existing:
        return {"message": f"Token {symbol} is already hidden", "symbol": symbol}
    
    hidden_token = HiddenToken(
        user_id=user_id,
        symbol=symbol
    )
    await db.hidden_tokens.insert_one(hidden_token.model_dump())
    return {"message": f"Token {symbol} added to hidden list", "symbol": symbol}

@api_router.get("/hidden-tokens")
async def get_hidden_tokens(current_user: dict = Depends(get_current_user)):
    """Get all hidden tokens for the current user"""
    user_id = current_user["id"]
    tokens = await db.hidden_tokens.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    return {"hidden_tokens": tokens, "symbols": [t["symbol"] for t in tokens]}

@api_router.delete("/hidden-tokens/{symbol}")
async def remove_hidden_token(symbol: str, current_user: dict = Depends(get_current_user)):
    """Remove a token from the hidden list"""
    user_id = current_user["id"]
    result = await db.hidden_tokens.delete_one({
        "user_id": user_id,
        "symbol": symbol.upper()
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Token not found in hidden list")
    return {"message": f"Token {symbol.upper()} removed from hidden list"}

# ==================== TRANSACTION CRUD ====================

@api_router.post("/transactions", response_model=dict)
async def create_transaction(tx_data: TransactionCreate, current_user: dict = Depends(get_current_user)):
    """Create a new transaction with optional Crypto ↔ Crypto interdependence"""
    tx_dict = tx_data.model_dump()
    
    # Remove non-model fields
    create_counterpart_tx = tx_dict.pop("create_counterpart_tx", False)
    target_wallet_id = tx_dict.pop("target_wallet_id", None)
    
    # Ignore "none" values
    if target_wallet_id == "none":
        target_wallet_id = None
    
    tx = Transaction(user_id=current_user["id"], **tx_dict)
    
    linked_tx_id = None
    linked_tx_message = ""
    
    # Interdépendance Crypto ↔ Crypto: Créer la transaction contrepartie
    if create_counterpart_tx and target_wallet_id and tx_data.type in ["Transfer Out", "Transfer In"]:
        # Vérifier que le wallet destinataire existe
        target_wallet = await db.wallets.find_one({"id": target_wallet_id, "user_id": current_user["id"]}, {"_id": 0})
        if target_wallet:
            # Déterminer le type de contrepartie
            if tx_data.type == "Transfer Out":
                counterpart_type = "Transfer In"
                counterpart_amount = abs(tx_data.amount)
            else:  # Transfer In
                counterpart_type = "Transfer Out"
                counterpart_amount = -abs(tx_data.amount)
            
            # Créer la transaction contrepartie
            counterpart_tx = Transaction(
                user_id=current_user["id"],
                wallet_id=target_wallet_id,
                wallet_name=target_wallet.get("name", ""),
                type=counterpart_type,
                asset=tx_data.asset,
                amount=counterpart_amount,
                price_usd=tx_data.price_usd,
                price_eur=tx_data.price_eur,
                value_usd=tx_data.value_usd,
                value_eur=tx_data.value_eur,
                fees=0,  # Pas de frais sur la contrepartie
                fees_currency=tx_data.fees_currency,
                date=tx_data.date,
                tx_hash=tx_data.tx_hash or "",
                notes=f"Contrepartie de transfert depuis {tx_data.wallet_name}",
                linked_tx_id=tx.id  # Lier à la transaction principale
            )
            counterpart_doc = counterpart_tx.model_dump()
            await db.transactions.insert_one(counterpart_doc)
            linked_tx_id = counterpart_tx.id
            linked_tx_message = f" + transaction contrepartie créée dans {target_wallet.get('name', 'wallet')}"
            
            # Mettre à jour la transaction principale avec l'ID de la contrepartie
            tx_dict["linked_tx_id"] = linked_tx_id
            tx = Transaction(user_id=current_user["id"], **tx_dict)
    
    doc = tx.model_dump()
    await db.transactions.insert_one(doc)
    
    return {
        "id": tx.id, 
        "message": f"Transaction créée{linked_tx_message}",
        "linked_tx_id": linked_tx_id
    }

@api_router.get("/transactions")
async def get_transactions(
    wallet_id: Optional[str] = None,
    wallet_ids: Optional[str] = None,  # Comma-separated list for multi-select
    asset: Optional[str] = None,
    assets: Optional[str] = None,  # Comma-separated list for multi-select
    tx_type: Optional[str] = None,
    tx_types: Optional[str] = None,  # Comma-separated list for multi-select
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    hide_spam: bool = True,
    include_fiat: bool = False,  # Include fiat transactions
    fiat_account_ids: Optional[str] = None,  # Comma-separated fiat account IDs
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user)
):
    """Get transactions with pagination and filters (supports multi-select and fiat)"""
    query = {"user_id": current_user["id"]}
    
    # Handle multi-select wallet_ids
    if wallet_ids:
        wallet_id_list = [w.strip() for w in wallet_ids.split(",") if w.strip()]
        if wallet_id_list:
            query["wallet_id"] = {"$in": wallet_id_list}
    elif wallet_id and wallet_id != "all":
        query["wallet_id"] = wallet_id
    
    # Handle multi-select assets
    if assets:
        asset_list = [a.strip() for a in assets.split(",") if a.strip()]
        if asset_list:
            query["asset"] = {"$in": asset_list}
    elif asset and asset != "All":
        query["asset"] = asset
    
    # Handle multi-select tx_types
    if tx_types:
        type_list = [t.strip() for t in tx_types.split(",") if t.strip()]
        if type_list:
            query["type"] = {"$in": type_list}
    elif tx_type and tx_type != "All":
        query["type"] = tx_type
    
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    # Hide spam transactions by default
    if hide_spam:
        query["$or"] = [{"is_spam": False}, {"is_spam": {"$exists": False}}]
    
    # Get crypto transactions
    crypto_transactions = await db.transactions.find(query, {"_id": 0}).sort("date", -1).to_list(10000)
    for tx in crypto_transactions:
        tx["tx_category"] = "crypto"
    
    # Get fiat transactions if requested
    fiat_transactions = []
    if include_fiat:
        fiat_query = {"user_id": current_user["id"]}
        if fiat_account_ids:
            account_id_list = [a.strip() for a in fiat_account_ids.split(",") if a.strip()]
            if account_id_list:
                fiat_query["account_id"] = {"$in": account_id_list}
        if start_date:
            fiat_query["date"] = {"$gte": start_date}
        if end_date:
            if "date" in fiat_query:
                fiat_query["date"]["$lte"] = end_date
            else:
                fiat_query["date"] = {"$lte": end_date}
        
        raw_fiat = await db.fiat_transactions.find(fiat_query, {"_id": 0}).to_list(10000)
        
        # Get account info for each fiat transaction
        for tx in raw_fiat:
            tx["tx_category"] = "fiat"
            # Get account details
            account = await db.fiat_accounts.find_one({"id": tx.get("account_id")}, {"_id": 0})
            if account:
                tx["account_name"] = account.get("name", "Unknown")
                tx["currency"] = account.get("currency", "EUR")
            else:
                tx["account_name"] = "Unknown"
                tx["currency"] = "EUR"
            # Map fiat type to common format
            tx["asset"] = tx.get("currency", "EUR")
            if tx.get("amount", 0) >= 0:
                tx["debit"] = 0
                tx["credit"] = tx["amount"]
            else:
                tx["debit"] = abs(tx["amount"])
                tx["credit"] = 0
        
        fiat_transactions = raw_fiat
    
    # Combine and sort by date
    all_transactions = crypto_transactions + fiat_transactions
    all_transactions.sort(key=lambda x: x.get("date", ""), reverse=True)
    
    total = len(all_transactions)
    skip = (page - 1) * page_size
    paginated = all_transactions[skip:skip + page_size]
    
    return {
        "transactions": paginated,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }

@api_router.delete("/transactions/{tx_id}")
async def delete_transaction(tx_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a transaction"""
    result = await db.transactions.delete_one({"id": tx_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"message": "Transaction deleted"}

@api_router.put("/transactions/{tx_id}")
async def update_transaction(tx_id: str, tx_data: TransactionUpdate, current_user: dict = Depends(get_current_user)):
    """Update an existing crypto transaction (manual transactions only)"""
    user_id = current_user["id"]
    
    # Find the existing transaction
    existing = await db.transactions.find_one({"id": tx_id, "user_id": user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Only allow editing manual transactions
    if existing.get("source") not in ["manual", "csv_import"]:
        raise HTTPException(status_code=400, detail="Seules les transactions manuelles peuvent être modifiées")
    
    # Build update dict with only provided fields
    update_data = {}
    if tx_data.type is not None:
        update_data["type"] = tx_data.type
    if tx_data.asset is not None:
        update_data["asset"] = tx_data.asset
    if tx_data.amount is not None:
        update_data["amount"] = tx_data.amount
    if tx_data.price_usd is not None:
        update_data["price_usd"] = tx_data.price_usd
    if tx_data.price_eur is not None:
        update_data["price_eur"] = tx_data.price_eur
    if tx_data.fees is not None:
        update_data["fees"] = tx_data.fees
    if tx_data.fees_currency is not None:
        update_data["fees_currency"] = tx_data.fees_currency
    if tx_data.date is not None:
        update_data["date"] = tx_data.date
    if tx_data.counterparty_wallet is not None:
        update_data["counterparty_wallet"] = tx_data.counterparty_wallet
    if tx_data.income_category is not None:
        update_data["income_category"] = tx_data.income_category if tx_data.income_category != "" else None
    
    # Auto-calculate values if amount or prices changed
    amount = tx_data.amount if tx_data.amount is not None else existing.get("amount", 0)
    price_usd = tx_data.price_usd if tx_data.price_usd is not None else existing.get("price_usd", 0)
    price_eur = tx_data.price_eur if tx_data.price_eur is not None else existing.get("price_eur", 0)
    
    if tx_data.value_usd is not None:
        update_data["value_usd"] = tx_data.value_usd
    elif tx_data.amount is not None or tx_data.price_usd is not None:
        update_data["value_usd"] = abs(amount) * price_usd
    
    if tx_data.value_eur is not None:
        update_data["value_eur"] = tx_data.value_eur
    elif tx_data.amount is not None or tx_data.price_eur is not None:
        update_data["value_eur"] = abs(amount) * price_eur
    
    if not update_data:
        return {"message": "No changes provided", "id": tx_id}
    
    # Update the transaction
    await db.transactions.update_one(
        {"id": tx_id, "user_id": user_id},
        {"$set": update_data}
    )
    
    return {"message": "Transaction updated", "id": tx_id}

@api_router.patch("/transactions/{tx_id}/spam")
async def toggle_spam_transaction(tx_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle spam status for a transaction"""
    tx = await db.transactions.find_one({"id": tx_id, "user_id": current_user["id"]}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    new_spam_status = not tx.get("is_spam", False)
    await db.transactions.update_one(
        {"id": tx_id, "user_id": current_user["id"]},
        {"$set": {"is_spam": new_spam_status}}
    )
    return {"message": f"Transaction {'marquée comme spam' if new_spam_status else 'retirée du spam'}", "is_spam": new_spam_status}

class IncomeCategoryUpdate(BaseModel):
    income_category: Optional[str] = None  # interest, yield, airdrop, reward, cashback, fee, gas, subscription, payment, or None

@api_router.patch("/transactions/{tx_id}/category")
async def update_transaction_category(tx_id: str, data: IncomeCategoryUpdate, current_user: dict = Depends(get_current_user)):
    """Update the income/expense category for any transaction (including blockchain imports)"""
    tx = await db.transactions.find_one({"id": tx_id, "user_id": current_user["id"]}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Validate category
    valid_categories = ["interest", "yield", "airdrop", "reward", "cashback", "fee", "gas", "subscription", "payment", None, ""]
    if data.income_category not in valid_categories:
        raise HTTPException(status_code=400, detail=f"Catégorie invalide. Valeurs acceptées: {valid_categories}")
    
    # Set to None if empty string
    category_value = data.income_category if data.income_category not in ["", None] else None
    
    await db.transactions.update_one(
        {"id": tx_id, "user_id": current_user["id"]},
        {"$set": {"income_category": category_value}}
    )
    
    category_labels = {
        "interest": "Intérêts",
        "yield": "Rendement",
        "airdrop": "Airdrop",
        "reward": "Récompense",
        "cashback": "Cashback",
        "fee": "Frais",
        "gas": "Frais de gas",
        "subscription": "Abonnement",
        "payment": "Paiement",
        None: "Aucune catégorie"
    }
    
    return {
        "message": f"Catégorie mise à jour: {category_labels.get(category_value, category_value)}",
        "income_category": category_value
    }

@api_router.post("/transactions/create-double-entries")
async def create_missing_double_entries(current_user: dict = Depends(get_current_user)):
    """Create missing double-entry transactions for transfers between user's own wallets"""
    user_id = current_user["id"]
    
    # Get all user's wallet addresses
    user_wallets = await db.wallets.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    wallet_addresses = {w["address"].lower(): w for w in user_wallets}
    
    if not wallet_addresses:
        return {"message": "Aucun wallet trouvé", "created_count": 0}
    
    # Find transactions without linked_tx_id that have counterparty matching user's wallets
    transactions = await db.transactions.find({
        "user_id": user_id,
        "linked_tx_id": {"$in": [None, ""]},
        "counterparty_wallet": {"$exists": True, "$ne": None, "$ne": ""}
    }, {"_id": 0}).to_list(1000)
    
    created_count = 0
    already_exists = 0
    
    for tx in transactions:
        counterparty = tx.get("counterparty_wallet", "").lower()
        
        # Check if counterparty is one of user's wallets
        if counterparty in wallet_addresses:
            counterparty_wallet = wallet_addresses[counterparty]
            
            # Check if mirror transaction already exists
            mirror_type = "Transfer Out" if tx["type"] == "Transfer In" else "Transfer In"
            mirror_existing = await db.transactions.find_one({
                "tx_hash": tx.get("tx_hash"),
                "user_id": user_id,
                "wallet_id": counterparty_wallet["id"],
                "asset": tx.get("asset")
            })
            
            if mirror_existing:
                # Link them if not already linked
                if not tx.get("linked_tx_id"):
                    await db.transactions.update_one(
                        {"id": tx["id"]},
                        {"$set": {"linked_tx_id": mirror_existing["id"]}}
                    )
                if not mirror_existing.get("linked_tx_id"):
                    await db.transactions.update_one(
                        {"id": mirror_existing["id"]},
                        {"$set": {"linked_tx_id": tx["id"]}}
                    )
                already_exists += 1
                continue
            
            # Create mirror transaction
            mirror_amount = -tx.get("amount", 0)  # Opposite sign
            
            mirror_tx = Transaction(
                user_id=user_id,
                type=mirror_type,
                asset=tx.get("asset", "UNKNOWN"),
                amount=mirror_amount,
                price_usd=tx.get("price_usd", 0),
                price_eur=tx.get("price_eur", 0),
                value_usd=abs(mirror_amount) * tx.get("price_usd", 0),
                value_eur=abs(mirror_amount) * tx.get("price_eur", 0),
                fees=0,
                wallet_id=counterparty_wallet["id"],
                wallet_name=counterparty_wallet["name"],
                source=tx.get("source", "manual"),
                date=tx.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
                tx_hash=tx.get("tx_hash"),
                counterparty_wallet=tx.get("wallet_id"),  # Original wallet address
                linked_tx_id=tx["id"],
                notes="Double-entry créé automatiquement"
            )
            
            # Get original wallet address for counterparty field
            original_wallet = await db.wallets.find_one({"id": tx.get("wallet_id")}, {"_id": 0})
            if original_wallet:
                mirror_tx.counterparty_wallet = original_wallet.get("address", "")
            
            await db.transactions.insert_one(mirror_tx.model_dump())
            
            # Update original transaction with link
            await db.transactions.update_one(
                {"id": tx["id"]},
                {"$set": {"linked_tx_id": mirror_tx.id}}
            )
            
            created_count += 1
    
    return {
        "message": f"{created_count} double-entries créées, {already_exists} déjà existantes",
        "created_count": created_count,
        "already_linked": already_exists
    }

@api_router.post("/transactions/fetch-fees")
async def fetch_missing_fees(current_user: dict = Depends(get_current_user)):
    """Fetch and update fees for transactions that have tx_hash but fees=0"""
    import aiohttp
    
    # Find transactions with tx_hash but no fees
    transactions = await db.transactions.find({
        "user_id": current_user["id"],
        "tx_hash": {"$exists": True, "$ne": None, "$nin": ["", None]},
        "$or": [{"fees": 0}, {"fees": {"$exists": False}}, {"fees": None}]
    }, {"_id": 0}).to_list(500)
    
    if not transactions:
        return {"message": "Aucune transaction à mettre à jour", "updated_count": 0}
    
    # Group transactions by wallet to get network info
    wallet_ids = list(set(tx.get("wallet_id") for tx in transactions if tx.get("wallet_id")))
    wallets = {}
    for wid in wallet_ids:
        wallet = await db.wallets.find_one({"id": wid}, {"_id": 0})
        if wallet:
            wallets[wid] = wallet
    
    updated_count = 0
    errors = []
    
    async with aiohttp.ClientSession() as session:
        for tx in transactions:
            tx_hash = tx.get("tx_hash")
            wallet = wallets.get(tx.get("wallet_id"), {})
            network = wallet.get("network", "Ethereum")
            
            # Get the appropriate API URL
            blockscout_url = BLOCKSCOUT_APIS.get(network)
            if not blockscout_url:
                # Fallback to etherscan-like APIs
                if network == "Ethereum":
                    continue  # Would need Etherscan API key
                errors.append(f"Réseau non supporté: {network}")
                continue
            
            try:
                # Fetch transaction details from Blockscout
                url = f"{blockscout_url}/transactions/{tx_hash}"
                async with session.get(url, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # Extract gas info
                        gas_used = float(data.get("gas_used", 0))
                        gas_price = float(data.get("gas_price", 0))
                        
                        if gas_used > 0 and gas_price > 0:
                            fees_eth = gas_used * gas_price / (10 ** 18)
                            
                            # Get ETH price in EUR (approximate)
                            eth_price_eur = 2500  # Default fallback
                            try:
                                price_url = f"{blockscout_url}/stats"
                                async with session.get(price_url, timeout=5) as price_resp:
                                    if price_resp.status == 200:
                                        price_data = await price_resp.json()
                                        eth_price_eur = float(price_data.get("coin_price", 2500))
                            except:
                                pass
                            
                            fees_eur = fees_eth * eth_price_eur
                            
                            # Update transaction
                            await db.transactions.update_one(
                                {"id": tx["id"]},
                                {"$set": {"fees": fees_eur, "fees_currency": "EUR"}}
                            )
                            updated_count += 1
                    else:
                        errors.append(f"Erreur API pour {tx_hash[:10]}...: {response.status}")
            except Exception as e:
                errors.append(f"Erreur pour {tx_hash[:10]}...: {str(e)}")
    
    return {
        "message": f"{updated_count} transaction(s) mise(s) à jour",
        "updated_count": updated_count,
        "total_checked": len(transactions),
        "errors": errors[:10] if errors else []  # Limit error messages
    }

@api_router.post("/transactions/import-csv")
async def import_csv_transactions(import_data: CSVImportRequest, current_user: dict = Depends(get_current_user)):
    """Import transactions from CSV"""
    try:
        wallet = await db.wallets.find_one({"id": import_data.wallet_id, "user_id": current_user["id"]}, {"_id": 0})
        if not wallet:
            raise HTTPException(status_code=404, detail="Wallet not found")
        
        reader = csv.DictReader(io.StringIO(import_data.csv_data))
        imported_count = 0
        
        for row in reader:
            tx = Transaction(
                user_id=current_user["id"],
                type=row.get("type", "Transfer In"),
                asset=row.get("asset", "USDC"),
                amount=float(row.get("amount", 0)),
                price_usd=float(row.get("price_usd", 1)),
                price_eur=float(row.get("price_eur", 0.92)),
                value_usd=float(row.get("value_usd", 0)),
                value_eur=float(row.get("value_eur", 0)),
                fees=float(row.get("fees", 0)),
                fees_currency=row.get("fees_currency", "EUR"),
                wallet_id=import_data.wallet_id,
                wallet_name=wallet["name"],
                source="csv_import",
                date=row.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
                tx_hash=row.get("tx_hash"),
                counterparty_wallet=row.get("counterparty_wallet")
            )
            
            await db.transactions.insert_one(tx.model_dump())
            imported_count += 1
        
        return {"message": f"Imported {imported_count} transactions"}
    except Exception as e:
        logger.error(f"CSV import error: {e}")
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")

# ==================== FIAT ACCOUNT ENDPOINTS ====================

@api_router.post("/fiat-accounts", response_model=dict)
async def create_fiat_account(account_data: FiatAccountCreate, current_user: dict = Depends(get_current_user)):
    """Create a new fiat account"""
    account = FiatAccount(
        user_id=current_user["id"],
        name=account_data.name,
        currency=account_data.currency,
        balance=account_data.initial_balance
    )
    doc = account.model_dump()
    await db.fiat_accounts.insert_one(doc)
    return {"id": account.id, "message": "Account created"}

@api_router.get("/fiat-accounts")
async def get_fiat_accounts(current_user: dict = Depends(get_current_user)):
    """Get all fiat accounts"""
    accounts = await db.fiat_accounts.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    return accounts

@api_router.delete("/fiat-accounts/{account_id}")
async def delete_fiat_account(account_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a fiat account"""
    result = await db.fiat_accounts.delete_one({"id": account_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    await db.fiat_transactions.delete_many({"account_id": account_id, "user_id": current_user["id"]})
    return {"message": "Fiat account and related transactions deleted"}

@api_router.post("/fiat-transactions", response_model=dict)
async def create_fiat_transaction(tx_data: FiatTransactionCreate, current_user: dict = Depends(get_current_user)):
    """Create a fiat transaction with source/destination tracking and automatic counterpart"""
    account = await db.fiat_accounts.find_one({"id": tx_data.account_id, "user_id": current_user["id"]}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    new_balance = account["balance"] + tx_data.amount
    await db.fiat_accounts.update_one(
        {"id": tx_data.account_id},
        {"$set": {"balance": new_balance}}
    )
    
    # Prepare transaction data
    tx_dict = tx_data.model_dump()
    if not tx_dict.get("date"):
        tx_dict["date"] = datetime.now(timezone.utc).isoformat()
    
    # Generate linked_tx_id for potential counterpart
    main_tx_id = str(uuid.uuid4())
    
    # Resolve source name
    source_name = None
    source_account_data = None
    if tx_dict.get("source_type") == "bank" and tx_dict.get("source_account_id"):
        source_account_data = await db.fiat_accounts.find_one({"id": tx_dict["source_account_id"], "user_id": current_user["id"]}, {"_id": 0})
        source_name = source_account_data["name"] if source_account_data else "Compte inconnu"
    elif tx_dict.get("source_type") == "wallet" and tx_dict.get("source_wallet_id"):
        source_wallet = await db.wallets.find_one({"id": tx_dict["source_wallet_id"]}, {"_id": 0})
        source_name = source_wallet["name"] if source_wallet else tx_dict.get("source_wallet_address", "Wallet inconnu")
    elif tx_dict.get("source_type") == "exchange":
        source_name = tx_dict.get("source_wallet_address") or "Exchange"
    elif tx_dict.get("source_type") == "external":
        source_name = tx_dict.get("source_wallet_address") or "Externe"
    tx_dict["source_name"] = source_name
    
    # Resolve destination name
    dest_name = None
    dest_account_data = None
    if tx_dict.get("dest_type") == "bank" and tx_dict.get("dest_account_id"):
        dest_account_data = await db.fiat_accounts.find_one({"id": tx_dict["dest_account_id"], "user_id": current_user["id"]}, {"_id": 0})
        dest_name = dest_account_data["name"] if dest_account_data else "Compte inconnu"
    elif tx_dict.get("dest_type") == "wallet" and tx_dict.get("dest_wallet_id"):
        dest_wallet = await db.wallets.find_one({"id": tx_dict["dest_wallet_id"]}, {"_id": 0})
        dest_name = dest_wallet["name"] if dest_wallet else tx_dict.get("dest_wallet_address", "Wallet inconnu")
    elif tx_dict.get("dest_type") == "exchange":
        dest_name = tx_dict.get("dest_wallet_address") or "Exchange"
    elif tx_dict.get("dest_type") == "external":
        dest_name = tx_dict.get("dest_wallet_address") or "Externe"
    tx_dict["dest_name"] = dest_name
    
    # Set running balance
    tx_dict["running_balance"] = new_balance
    tx_dict["linked_tx_id"] = None  # Will be set if counterpart is created
    
    tx = FiatTransaction(user_id=current_user["id"], **tx_dict)
    tx.id = main_tx_id
    doc = tx.model_dump()
    await db.fiat_transactions.insert_one(doc)
    
    counterpart_id = None
    counterpart_message = ""
    
    # === AUTO-CREATE COUNTERPART TRANSACTION ===
    
    # Case 1: Virement sortant vers un autre compte Fiat interne (transfer_out ou withdrawal vers bank)
    if tx_dict.get("dest_type") == "bank" and dest_account_data and tx_data.amount < 0:
        # Create incoming transaction on destination account
        counterpart_amount = abs(tx_data.amount)
        dest_new_balance = dest_account_data["balance"] + counterpart_amount
        
        await db.fiat_accounts.update_one(
            {"id": dest_account_data["id"]},
            {"$set": {"balance": dest_new_balance}}
        )
        
        counterpart_tx = FiatTransaction(
            user_id=current_user["id"],
            account_id=dest_account_data["id"],
            type="transfer_in",
            amount=counterpart_amount,
            description=f"Virement de {account['name']}",
            date=tx_dict["date"],
            source_type="bank",
            source_account_id=tx_data.account_id,
            source_name=account["name"],
            dest_type="bank",
            dest_account_id=dest_account_data["id"],
            dest_name=dest_account_data["name"],
            running_balance=dest_new_balance,
            linked_tx_id=main_tx_id
        )
        counterpart_doc = counterpart_tx.model_dump()
        await db.fiat_transactions.insert_one(counterpart_doc)
        
        # Update main transaction with linked_tx_id
        await db.fiat_transactions.update_one(
            {"id": main_tx_id},
            {"$set": {"linked_tx_id": counterpart_tx.id}}
        )
        
        counterpart_id = counterpart_tx.id
        counterpart_message = f" + contrepartie créée sur {dest_account_data['name']}"
    
    # Case 2: Virement entrant depuis un autre compte Fiat interne (transfer_in ou deposit depuis bank)
    elif tx_dict.get("source_type") == "bank" and source_account_data and tx_data.amount > 0:
        # Create outgoing transaction on source account
        counterpart_amount = -abs(tx_data.amount)
        source_new_balance = source_account_data["balance"] + counterpart_amount
        
        await db.fiat_accounts.update_one(
            {"id": source_account_data["id"]},
            {"$set": {"balance": source_new_balance}}
        )
        
        counterpart_tx = FiatTransaction(
            user_id=current_user["id"],
            account_id=source_account_data["id"],
            type="transfer_out",
            amount=counterpart_amount,
            description=f"Virement vers {account['name']}",
            date=tx_dict["date"],
            source_type="bank",
            source_account_id=source_account_data["id"],
            source_name=source_account_data["name"],
            dest_type="bank",
            dest_account_id=tx_data.account_id,
            dest_name=account["name"],
            running_balance=source_new_balance,
            linked_tx_id=main_tx_id
        )
        counterpart_doc = counterpart_tx.model_dump()
        await db.fiat_transactions.insert_one(counterpart_doc)
        
        # Update main transaction with linked_tx_id
        await db.fiat_transactions.update_one(
            {"id": main_tx_id},
            {"$set": {"linked_tx_id": counterpart_tx.id}}
        )
        
        counterpart_id = counterpart_tx.id
        counterpart_message = f" + contrepartie créée sur {source_account_data['name']}"
    
    # Case 3: Virement sortant vers un Wallet Crypto (dest_type == "wallet")
    # Skip for crypto_buy as it has its own dedicated logic (Case 7)
    if tx_dict.get("dest_type") == "wallet" and tx_dict.get("dest_wallet_id") and tx_data.amount < 0 and tx_data.type != "crypto_buy":
        dest_wallet = await db.wallets.find_one({"id": tx_dict["dest_wallet_id"], "user_id": current_user["id"]}, {"_id": 0})
        if dest_wallet:
            # Créer une transaction crypto "Deposit" sur le wallet
            crypto_tx = Transaction(
                user_id=current_user["id"],
                type="Deposit",
                asset="EUR",
                amount=abs(tx_data.amount),
                price_usd=1.08,  # Approximation EUR/USD
                price_eur=1.0,
                value_usd=abs(tx_data.amount) * 1.08,
                value_eur=abs(tx_data.amount),
                fees=0,
                fees_currency="EUR",
                wallet_id=dest_wallet["id"],
                wallet_name=dest_wallet["name"],
                source="fiat_transfer",
                date=tx_dict["date"],
                counterparty_wallet=account["name"]
            )
            crypto_doc = crypto_tx.model_dump()
            await db.transactions.insert_one(crypto_doc)
            
            # Lier la transaction fiat à la transaction crypto
            await db.fiat_transactions.update_one(
                {"id": main_tx_id},
                {"$set": {"linked_crypto_tx_id": crypto_tx.id}}
            )
            
            counterpart_message += f" + dépôt EUR créé sur {dest_wallet['name']}"
    
    # Case 4: Virement sortant vers un Exchange (dest_type == "exchange" avec wallet sélectionné)
    # Skip for crypto_buy as it has its own dedicated logic (Case 7)
    if tx_dict.get("dest_type") == "exchange" and tx_dict.get("dest_wallet_id") and tx_data.amount < 0 and tx_data.type != "crypto_buy":
        dest_wallet = await db.wallets.find_one({"id": tx_dict["dest_wallet_id"], "user_id": current_user["id"]}, {"_id": 0})
        if dest_wallet:
            # Créer une transaction crypto "Deposit" sur le wallet exchange
            crypto_tx = Transaction(
                user_id=current_user["id"],
                type="Deposit",
                asset="EUR",
                amount=abs(tx_data.amount),
                price_usd=1.08,
                price_eur=1.0,
                value_usd=abs(tx_data.amount) * 1.08,
                value_eur=abs(tx_data.amount),
                fees=0,
                fees_currency="EUR",
                wallet_id=dest_wallet["id"],
                wallet_name=dest_wallet["name"],
                source="fiat_transfer",
                date=tx_dict["date"],
                counterparty_wallet=account["name"]
            )
            crypto_doc = crypto_tx.model_dump()
            await db.transactions.insert_one(crypto_doc)
            
            await db.fiat_transactions.update_one(
                {"id": main_tx_id},
                {"$set": {"linked_crypto_tx_id": crypto_tx.id}}
            )
            
            counterpart_message += f" + dépôt EUR créé sur {dest_wallet['name']}"
    
    # Case 5: Virement entrant depuis un Wallet Crypto (source_type == "wallet")
    # Skip for crypto_sell as it has its own dedicated logic (Case 8)
    if tx_dict.get("source_type") == "wallet" and tx_dict.get("source_wallet_id") and tx_data.amount > 0 and tx_data.type != "crypto_sell":
        source_wallet = await db.wallets.find_one({"id": tx_dict["source_wallet_id"], "user_id": current_user["id"]}, {"_id": 0})
        if source_wallet:
            # Créer une transaction crypto "Withdrawal" sur le wallet
            crypto_tx = Transaction(
                user_id=current_user["id"],
                type="Withdrawal",
                asset="EUR",
                amount=-abs(tx_data.amount),
                price_usd=1.08,
                price_eur=1.0,
                value_usd=abs(tx_data.amount) * 1.08,
                value_eur=abs(tx_data.amount),
                fees=0,
                fees_currency="EUR",
                wallet_id=source_wallet["id"],
                wallet_name=source_wallet["name"],
                source="fiat_transfer",
                date=tx_dict["date"],
                counterparty_wallet=account["name"]
            )
            crypto_doc = crypto_tx.model_dump()
            await db.transactions.insert_one(crypto_doc)
            
            await db.fiat_transactions.update_one(
                {"id": main_tx_id},
                {"$set": {"linked_crypto_tx_id": crypto_tx.id}}
            )
            
            counterpart_message += f" + retrait EUR créé sur {source_wallet['name']}"
    
    # Case 6: Virement entrant depuis un Exchange (source_type == "exchange" avec wallet sélectionné)
    # Skip for crypto_sell as it has its own dedicated logic (Case 8)
    if tx_dict.get("source_type") == "exchange" and tx_dict.get("source_wallet_id") and tx_data.amount > 0 and tx_data.type != "crypto_sell":
        source_wallet = await db.wallets.find_one({"id": tx_dict["source_wallet_id"], "user_id": current_user["id"]}, {"_id": 0})
        if source_wallet:
            crypto_tx = Transaction(
                user_id=current_user["id"],
                type="Withdrawal",
                asset="EUR",
                amount=-abs(tx_data.amount),
                price_usd=1.08,
                price_eur=1.0,
                value_usd=abs(tx_data.amount) * 1.08,
                value_eur=abs(tx_data.amount),
                fees=0,
                fees_currency="EUR",
                wallet_id=source_wallet["id"],
                wallet_name=source_wallet["name"],
                source="fiat_transfer",
                date=tx_dict["date"],
                counterparty_wallet=account["name"]
            )
            crypto_doc = crypto_tx.model_dump()
            await db.transactions.insert_one(crypto_doc)
            
            await db.fiat_transactions.update_one(
                {"id": main_tx_id},
                {"$set": {"linked_crypto_tx_id": crypto_tx.id}}
            )
            
            counterpart_message += f" + retrait EUR créé sur {source_wallet['name']}"
    
    # Case 7: ACHAT CRYPTO (crypto_buy) - Fiat → Crypto via passerelle (Prime, Bleap, etc.)
    if tx_data.type == "crypto_buy" and tx_data.crypto_asset and tx_data.crypto_amount and tx_data.crypto_amount > 0:
        wallet_id = tx_dict.get("dest_wallet_id")
        if wallet_id:
            dest_wallet = await db.wallets.find_one({"id": wallet_id, "user_id": current_user["id"]}, {"_id": 0})
            if dest_wallet:
                # Calculate price based on EUR/crypto ratio
                crypto_amount = tx_data.crypto_amount
                eur_amount = abs(tx_data.amount)
                price_eur = eur_amount / crypto_amount if crypto_amount > 0 else 1.0
                
                # Estimate USD price (approximate EUR/USD rate)
                price_usd = price_eur * 1.08
                
                # Create Buy transaction in crypto wallet
                crypto_tx = Transaction(
                    user_id=current_user["id"],
                    type="Buy",
                    asset=tx_data.crypto_asset,
                    amount=crypto_amount,
                    price_usd=price_usd,
                    price_eur=price_eur,
                    value_usd=crypto_amount * price_usd,
                    value_eur=eur_amount,
                    fees=0,
                    fees_currency="EUR",
                    wallet_id=dest_wallet["id"],
                    wallet_name=dest_wallet["name"],
                    source="fiat_purchase",
                    date=tx_dict["date"],
                    counterparty_wallet=account["name"],
                    notes=f"Achat via {dest_wallet['name']} - {eur_amount:.2f} EUR → {crypto_amount:.6f} {tx_data.crypto_asset}"
                )
                crypto_doc = crypto_tx.model_dump()
                await db.transactions.insert_one(crypto_doc)
                
                # Link fiat transaction to crypto transaction
                await db.fiat_transactions.update_one(
                    {"id": main_tx_id},
                    {"$set": {"linked_crypto_tx_id": crypto_tx.id}}
                )
                
                counterpart_message += f" + achat {crypto_amount:.6f} {tx_data.crypto_asset} créé sur {dest_wallet['name']}"
    
    # Case 8: VENTE CRYPTO (crypto_sell) - Crypto → Fiat via passerelle
    if tx_data.type == "crypto_sell" and tx_data.crypto_asset and tx_data.crypto_amount and tx_data.crypto_amount > 0:
        wallet_id = tx_dict.get("source_wallet_id")
        if wallet_id:
            source_wallet = await db.wallets.find_one({"id": wallet_id, "user_id": current_user["id"]}, {"_id": 0})
            if source_wallet:
                # Calculate price based on EUR/crypto ratio
                crypto_amount = tx_data.crypto_amount
                eur_amount = abs(tx_data.amount)
                price_eur = eur_amount / crypto_amount if crypto_amount > 0 else 1.0
                
                # Estimate USD price
                price_usd = price_eur * 1.08
                
                # Create Sell transaction in crypto wallet (negative amount = sold)
                crypto_tx = Transaction(
                    user_id=current_user["id"],
                    type="Sell",
                    asset=tx_data.crypto_asset,
                    amount=-crypto_amount,  # Negative because it's leaving the wallet
                    price_usd=price_usd,
                    price_eur=price_eur,
                    value_usd=crypto_amount * price_usd,
                    value_eur=eur_amount,
                    fees=0,
                    fees_currency="EUR",
                    wallet_id=source_wallet["id"],
                    wallet_name=source_wallet["name"],
                    source="fiat_sale",
                    date=tx_dict["date"],
                    counterparty_wallet=account["name"],
                    notes=f"Vente via {source_wallet['name']} - {crypto_amount:.6f} {tx_data.crypto_asset} → {eur_amount:.2f} EUR"
                )
                crypto_doc = crypto_tx.model_dump()
                await db.transactions.insert_one(crypto_doc)
                
                # Link fiat transaction to crypto transaction
                await db.fiat_transactions.update_one(
                    {"id": main_tx_id},
                    {"$set": {"linked_crypto_tx_id": crypto_tx.id}}
                )
                
                counterpart_message += f" + vente {crypto_amount:.6f} {tx_data.crypto_asset} créée sur {source_wallet['name']}"
    
    return {
        "id": main_tx_id, 
        "message": f"Transaction created{counterpart_message}", 
        "new_balance": new_balance,
        "counterpart_id": counterpart_id
    }

@api_router.get("/fiat-transactions")
async def get_fiat_transactions(
    account_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get fiat transactions with running balance (debit/credit/balance format)"""
    query = {"user_id": current_user["id"]}
    if account_id:
        query["account_id"] = account_id
    
    total = await db.fiat_transactions.count_documents(query)
    
    # Get ALL transactions for this account to calculate running balance
    all_transactions = await db.fiat_transactions.find(query, {"_id": 0}).sort("date", 1).to_list(10000)
    
    # Get account initial balance
    account = None
    if account_id:
        account = await db.fiat_accounts.find_one({"id": account_id}, {"_id": 0})
    
    # Calculate running balance for each transaction
    running_balance = 0
    for tx in all_transactions:
        amount = tx.get("amount", 0)
        running_balance += amount
        tx["running_balance"] = running_balance
        # Add debit/credit columns
        if amount < 0:
            tx["debit"] = abs(amount)
            tx["credit"] = 0
        else:
            tx["debit"] = 0
            tx["credit"] = amount
    
    # Reverse for display (newest first) and paginate
    all_transactions.reverse()
    skip = (page - 1) * page_size
    transactions = all_transactions[skip:skip + page_size]
    
    return {
        "transactions": transactions,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "current_balance": running_balance
    }

@api_router.put("/fiat-transactions/{tx_id}")
async def update_fiat_transaction(tx_id: str, tx_data: FiatTransactionUpdate, current_user: dict = Depends(get_current_user)):
    """Update an existing fiat transaction"""
    user_id = current_user["id"]
    
    # Find the existing transaction
    existing = await db.fiat_transactions.find_one({"id": tx_id, "user_id": user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Get the account
    account = await db.fiat_accounts.find_one({"id": existing["account_id"], "user_id": user_id}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Calculate balance difference if amount changed
    old_amount = existing.get("amount", 0)
    new_amount = tx_data.amount if tx_data.amount is not None else old_amount
    amount_diff = new_amount - old_amount
    
    # Build update dict with only provided fields
    update_data = {}
    if tx_data.type is not None:
        update_data["type"] = tx_data.type
    if tx_data.amount is not None:
        update_data["amount"] = tx_data.amount
    if tx_data.description is not None:
        update_data["description"] = tx_data.description
    if tx_data.date is not None:
        update_data["date"] = tx_data.date
    if tx_data.source_type is not None:
        update_data["source_type"] = tx_data.source_type
    if tx_data.source_account_id is not None:
        update_data["source_account_id"] = tx_data.source_account_id
    if tx_data.source_wallet_id is not None:
        update_data["source_wallet_id"] = tx_data.source_wallet_id
    if tx_data.source_wallet_address is not None:
        update_data["source_wallet_address"] = tx_data.source_wallet_address
    if tx_data.dest_type is not None:
        update_data["dest_type"] = tx_data.dest_type
    if tx_data.dest_account_id is not None:
        update_data["dest_account_id"] = tx_data.dest_account_id
    if tx_data.dest_wallet_id is not None:
        update_data["dest_wallet_id"] = tx_data.dest_wallet_id
    if tx_data.dest_wallet_address is not None:
        update_data["dest_wallet_address"] = tx_data.dest_wallet_address
    
    # Resolve source/dest names if changed
    if tx_data.source_type or tx_data.source_account_id or tx_data.source_wallet_id:
        source_type = tx_data.source_type or existing.get("source_type", "bank")
        if source_type == "bank":
            src_account_id = tx_data.source_account_id or existing.get("source_account_id")
            if src_account_id:
                src_account = await db.fiat_accounts.find_one({"id": src_account_id}, {"_id": 0})
                update_data["source_name"] = src_account["name"] if src_account else "Compte inconnu"
            else:
                update_data["source_name"] = None
        elif source_type == "wallet":
            src_wallet_id = tx_data.source_wallet_id or existing.get("source_wallet_id")
            if src_wallet_id:
                src_wallet = await db.wallets.find_one({"id": src_wallet_id}, {"_id": 0})
                update_data["source_name"] = src_wallet["name"] if src_wallet else "Wallet inconnu"
            else:
                update_data["source_name"] = tx_data.source_wallet_address or existing.get("source_wallet_address")
        elif source_type == "exchange":
            update_data["source_name"] = tx_data.source_wallet_address or existing.get("source_wallet_address") or "Exchange"
        else:
            update_data["source_name"] = "Externe"
    
    if tx_data.dest_type or tx_data.dest_account_id or tx_data.dest_wallet_id:
        dest_type = tx_data.dest_type or existing.get("dest_type", "bank")
        if dest_type == "bank":
            dest_account_id = tx_data.dest_account_id or existing.get("dest_account_id")
            if dest_account_id:
                dest_account = await db.fiat_accounts.find_one({"id": dest_account_id}, {"_id": 0})
                update_data["dest_name"] = dest_account["name"] if dest_account else "Compte inconnu"
            else:
                update_data["dest_name"] = None
        elif dest_type == "wallet":
            dest_wallet_id = tx_data.dest_wallet_id or existing.get("dest_wallet_id")
            if dest_wallet_id:
                dest_wallet = await db.wallets.find_one({"id": dest_wallet_id}, {"_id": 0})
                update_data["dest_name"] = dest_wallet["name"] if dest_wallet else "Wallet inconnu"
            else:
                update_data["dest_name"] = tx_data.dest_wallet_address or existing.get("dest_wallet_address")
        elif dest_type == "exchange":
            update_data["dest_name"] = tx_data.dest_wallet_address or existing.get("dest_wallet_address") or "Exchange"
        else:
            update_data["dest_name"] = "Externe"
    
    if not update_data:
        return {"message": "No changes provided", "id": tx_id}
    
    # Update the transaction
    await db.fiat_transactions.update_one(
        {"id": tx_id, "user_id": user_id},
        {"$set": update_data}
    )
    
    # Update account balance if amount changed
    if amount_diff != 0:
        new_balance = account["balance"] + amount_diff
        await db.fiat_accounts.update_one(
            {"id": account["id"]},
            {"$set": {"balance": new_balance}}
        )
        return {"message": "Transaction updated", "id": tx_id, "new_balance": new_balance}
    
    return {"message": "Transaction updated", "id": tx_id}

@api_router.delete("/fiat-transactions/{tx_id}")
async def delete_fiat_transaction(tx_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a fiat transaction, its counterpart if exists, and update account balances"""
    user_id = current_user["id"]
    
    # Find the transaction
    tx = await db.fiat_transactions.find_one({"id": tx_id, "user_id": user_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Get account and reverse the amount
    account = await db.fiat_accounts.find_one({"id": tx["account_id"], "user_id": user_id}, {"_id": 0})
    new_balance = None
    if account:
        new_balance = account["balance"] - tx.get("amount", 0)
        await db.fiat_accounts.update_one(
            {"id": account["id"]},
            {"$set": {"balance": new_balance}}
        )
    
    # Check for linked counterpart transaction and delete it too
    linked_tx_id = tx.get("linked_tx_id")
    counterpart_deleted = False
    if linked_tx_id:
        linked_tx = await db.fiat_transactions.find_one({"id": linked_tx_id, "user_id": user_id}, {"_id": 0})
        if linked_tx:
            # Reverse balance on the counterpart account
            linked_account = await db.fiat_accounts.find_one({"id": linked_tx["account_id"], "user_id": user_id}, {"_id": 0})
            if linked_account:
                linked_new_balance = linked_account["balance"] - linked_tx.get("amount", 0)
                await db.fiat_accounts.update_one(
                    {"id": linked_account["id"]},
                    {"$set": {"balance": linked_new_balance}}
                )
            await db.fiat_transactions.delete_one({"id": linked_tx_id, "user_id": user_id})
            counterpart_deleted = True
    
    # Check for linked crypto transaction and delete it too
    linked_crypto_tx_id = tx.get("linked_crypto_tx_id")
    crypto_deleted = False
    if linked_crypto_tx_id:
        await db.transactions.delete_one({"id": linked_crypto_tx_id, "user_id": user_id})
        crypto_deleted = True
    
    # Delete the main transaction
    await db.fiat_transactions.delete_one({"id": tx_id, "user_id": user_id})
    
    message = "Transaction deleted"
    if counterpart_deleted:
        message += " (+ contrepartie fiat supprimée)"
    if crypto_deleted:
        message += " (+ transaction crypto supprimée)"
    
    return {"message": message, "new_balance": new_balance}

# ==================== POSITIONS/INVESTMENTS ENDPOINTS ====================

@api_router.post("/positions", response_model=dict)
async def create_position(position: PositionCreate, current_user: dict = Depends(get_current_user)):
    """Create a new investment position with optional wallet interdependence"""
    pos_dict = position.model_dump()
    pos_dict["deposit_date"] = pos_dict.get("deposit_date") or datetime.now(timezone.utc).isoformat()
    
    # Remove non-model fields
    create_withdrawal_tx = pos_dict.pop("create_withdrawal_tx", False)
    source_wallet_id = pos_dict.get("source_wallet_id")
    
    # Ignore "none" values
    if source_wallet_id == "none":
        source_wallet_id = None
        pos_dict["source_wallet_id"] = None
    
    pos = Position(user_id=current_user["id"], **pos_dict)
    
    linked_tx_id = None
    linked_tx_message = ""
    
    # Interdépendance: Créer une transaction de retrait dans le wallet source
    if create_withdrawal_tx and source_wallet_id:
        # Vérifier que le wallet existe
        wallet = await db.wallets.find_one({"id": source_wallet_id, "user_id": current_user["id"]}, {"_id": 0})
        if wallet:
            # Créer une transaction de retrait (Transfer Out)
            withdrawal_tx = Transaction(
                user_id=current_user["id"],
                wallet_id=source_wallet_id,
                type="Transfer Out",
                asset=position.asset,
                amount=-abs(position.amount),  # Négatif pour un retrait
                date=pos_dict["deposit_date"],
                tx_hash="",
                price_eur=0,
                value_eur=0,
                notes=f"Dépôt vers position {position.platform} - {position.product_type}",
                linked_position_id=pos.id
            )
            withdrawal_doc = withdrawal_tx.model_dump()
            await db.transactions.insert_one(withdrawal_doc)
            linked_tx_id = withdrawal_tx.id
            linked_tx_message = " + transaction de retrait créée dans le wallet"
            
            # Mettre à jour la position avec l'ID de la transaction liée
            pos_dict["linked_tx_id"] = linked_tx_id
            pos = Position(user_id=current_user["id"], **pos_dict)
    
    doc = pos.model_dump()
    await db.positions.insert_one(doc)
    
    return {
        "id": pos.id, 
        "message": f"Position créée{linked_tx_message}",
        "linked_tx_id": linked_tx_id
    }

@api_router.get("/positions")
async def get_positions(current_user: dict = Depends(get_current_user)):
    """Get all investment positions for user"""
    positions = await db.positions.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    
    # Get all movements for this user to enrich positions
    all_movements = await db.position_movements.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(10000)
    movements_by_position = {}
    for mov in all_movements:
        pos_id = mov.get("position_id")
        if pos_id not in movements_by_position:
            movements_by_position[pos_id] = []
        movements_by_position[pos_id].append(mov)
    
    # Calculate estimated earnings for each position
    for pos in positions:
        amount = pos.get("amount", 0)
        apy = pos.get("apy", 0)
        deposit_date_str = pos.get("deposit_date", "")
        pos_id = pos.get("id")
        
        # Get movements for this position
        pos_movements = movements_by_position.get(pos_id, [])
        pos["realized_yield"] = sum(m.get("amount", 0) for m in pos_movements if m.get("movement_type") == "yield_realized")
        pos["capital_withdrawn"] = sum(m.get("amount", 0) for m in pos_movements if m.get("movement_type") == "capital_withdrawal")
        pos["total_loss"] = sum(m.get("amount", 0) for m in pos_movements if m.get("movement_type") == "impermanent_loss")
        pos["movements_count"] = len(pos_movements)
        
        # Remaining capital = initial amount - withdrawn - loss
        pos["remaining_capital"] = amount - pos["capital_withdrawn"] - pos["total_loss"]
        
        # Calculate days since deposit
        try:
            # Parse date string (might be just date or full ISO)
            if "T" in deposit_date_str:
                deposit_date = datetime.fromisoformat(deposit_date_str.replace("Z", "+00:00"))
            else:
                deposit_date = datetime.strptime(deposit_date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            days_elapsed = (datetime.now(timezone.utc) - deposit_date).days
            # Only count positive days (past deposits)
            if days_elapsed > 0:
                # Estimated earnings = remaining_capital * (apy/100) * (days/365)
                pos["estimated_earnings"] = round(pos["remaining_capital"] * (apy / 100) * (days_elapsed / 365), 2)
                pos["days_elapsed"] = days_elapsed
            else:
                pos["estimated_earnings"] = 0
                pos["days_elapsed"] = 0
        except:
            pos["estimated_earnings"] = 0
            pos["days_elapsed"] = 0
        
        # Pending yield = estimated - already realized
        pos["pending_yield"] = max(0, pos["estimated_earnings"] - pos["realized_yield"])
        
        # Check if locked
        unlock_date_str = pos.get("unlock_date")
        if unlock_date_str:
            try:
                # Parse date string (might be just date or full ISO)
                if "T" in unlock_date_str:
                    unlock_date = datetime.fromisoformat(unlock_date_str.replace("Z", "+00:00"))
                else:
                    unlock_date = datetime.strptime(unlock_date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                pos["is_locked"] = datetime.now(timezone.utc) < unlock_date
                pos["days_until_unlock"] = max(0, (unlock_date - datetime.now(timezone.utc)).days)
            except:
                pos["is_locked"] = False
                pos["days_until_unlock"] = 0
        else:
            pos["is_locked"] = False
            pos["days_until_unlock"] = 0
        
        # Position status
        if pos["total_loss"] > 0:
            pos["status"] = "loss"
        elif pos["capital_withdrawn"] >= amount:
            pos["status"] = "closed"
        elif pos["is_locked"]:
            pos["status"] = "locked"
        else:
            pos["status"] = "active"
    
    # Calculate totals by asset
    totals_by_asset = {}
    for pos in positions:
        asset = pos.get("asset", "UNKNOWN")
        if asset not in totals_by_asset:
            totals_by_asset[asset] = {
                "amount": 0, 
                "estimated_earnings": 0, 
                "realized_yield": 0,
                "capital_withdrawn": 0,
                "total_loss": 0,
                "remaining_capital": 0
            }
        totals_by_asset[asset]["amount"] += pos.get("amount", 0)
        totals_by_asset[asset]["estimated_earnings"] += pos.get("estimated_earnings", 0)
        totals_by_asset[asset]["realized_yield"] += pos.get("realized_yield", 0)
        totals_by_asset[asset]["capital_withdrawn"] += pos.get("capital_withdrawn", 0)
        totals_by_asset[asset]["total_loss"] += pos.get("total_loss", 0)
        totals_by_asset[asset]["remaining_capital"] += pos.get("remaining_capital", 0)
    
    # Global totals
    total_invested = sum(p.get("amount", 0) for p in positions)
    total_realized_yield = sum(p.get("realized_yield", 0) for p in positions)
    total_capital_withdrawn = sum(p.get("capital_withdrawn", 0) for p in positions)
    total_loss = sum(p.get("total_loss", 0) for p in positions)
    total_estimated = sum(p.get("estimated_earnings", 0) for p in positions)
    
    return {
        "positions": positions,
        "totals_by_asset": totals_by_asset,
        "total_positions": len(positions),
        "global_totals": {
            "total_invested": total_invested,
            "total_realized_yield": total_realized_yield,
            "total_capital_withdrawn": total_capital_withdrawn,
            "total_loss": total_loss,
            "total_estimated_earnings": total_estimated,
            "remaining_capital": total_invested - total_capital_withdrawn - total_loss
        }
    }

@api_router.put("/positions/{position_id}")
async def update_position(position_id: str, pos_data: PositionUpdate, current_user: dict = Depends(get_current_user)):
    """Update an existing position"""
    existing = await db.positions.find_one({"id": position_id, "user_id": current_user["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Position not found")
    
    update_data = {k: v for k, v in pos_data.model_dump().items() if v is not None}
    if not update_data:
        return {"message": "No changes provided", "id": position_id}
    
    await db.positions.update_one(
        {"id": position_id, "user_id": current_user["id"]},
        {"$set": update_data}
    )
    return {"message": "Position updated", "id": position_id}

@api_router.delete("/positions/{position_id}")
async def delete_position(position_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a position and all its movements"""
    result = await db.positions.delete_one({"id": position_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Position not found")
    # Also delete all movements for this position
    await db.position_movements.delete_many({"position_id": position_id, "user_id": current_user["id"]})
    return {"message": "Position deleted"}

# ==================== RÈGLES D'AFFECTATION AUTOMATIQUE ====================

@api_router.post("/positions/{position_id}/apply-rules")
async def apply_position_rules(position_id: str, current_user: dict = Depends(get_current_user)):
    """Apply position rules to match existing transactions and create movements"""
    user_id = current_user["id"]
    
    # Get the position
    position = await db.positions.find_one({"id": position_id, "user_id": user_id}, {"_id": 0})
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    
    if not position.get("rule_enabled"):
        return {"message": "Règles non activées pour cette position", "matched": 0}
    
    rule_address = position.get("rule_address", "").lower().strip()
    rule_asset = position.get("rule_asset", "").strip()
    
    if not rule_address and not rule_asset:
        return {"message": "Aucune règle définie", "matched": 0}
    
    # Build query to find matching transactions
    query = {"user_id": user_id, "linked_position_id": {"$exists": False}}
    
    # Both address AND asset must match if both are defined
    if rule_address and rule_asset:
        query["$and"] = [
            {"$or": [
                {"counterparty_wallet": {"$regex": rule_address, "$options": "i"}},
                {"tx_hash": {"$regex": rule_address, "$options": "i"}}
            ]},
            {"asset": rule_asset}
        ]
    elif rule_address:
        query["$or"] = [
            {"counterparty_wallet": {"$regex": rule_address, "$options": "i"}},
            {"tx_hash": {"$regex": rule_address, "$options": "i"}}
        ]
    elif rule_asset:
        query["asset"] = rule_asset
    
    # Find matching transactions (Transfer Out = dépôt vers position)
    query["type"] = {"$in": ["Transfer Out", "Sell"]}
    
    matching_txs = await db.transactions.find(query, {"_id": 0}).to_list(1000)
    
    created_movements = 0
    linked_transactions = 0
    
    for tx in matching_txs:
        # Check if movement already exists for this transaction
        existing_mov = await db.position_movements.find_one({
            "position_id": position_id,
            "linked_tx_id": tx.get("id")
        })
        
        if existing_mov:
            continue
        
        # Create movement (capital withdrawal to position = dépôt)
        amount = abs(tx.get("amount", 0))
        mov = PositionMovement(
            user_id=user_id,
            position_id=position_id,
            movement_type="capital_deposit",  # Nouveau type pour dépôt
            amount=amount,
            asset=tx.get("asset", position.get("asset")),
            date=tx.get("date", datetime.now(timezone.utc).isoformat()),
            tx_hash=tx.get("tx_hash", ""),
            notes=f"Auto-affecté depuis {tx.get('wallet_name', 'wallet')}",
            linked_tx_id=tx.get("id")
        )
        await db.position_movements.insert_one(mov.model_dump())
        created_movements += 1
        
        # Link transaction to position
        await db.transactions.update_one(
            {"id": tx.get("id")},
            {"$set": {"linked_position_id": position_id}}
        )
        linked_transactions += 1
    
    # Also find Transfer In (rendements reçus de la position)
    query_in = {"user_id": user_id, "linked_position_id": {"$exists": False}, "type": "Transfer In"}
    if rule_address and rule_asset:
        query_in["$and"] = [
            {"$or": [
                {"counterparty_wallet": {"$regex": rule_address, "$options": "i"}},
                {"tx_hash": {"$regex": rule_address, "$options": "i"}}
            ]},
            {"asset": rule_asset}
        ]
    elif rule_address:
        query_in["$or"] = [
            {"counterparty_wallet": {"$regex": rule_address, "$options": "i"}},
            {"tx_hash": {"$regex": rule_address, "$options": "i"}}
        ]
    elif rule_asset:
        query_in["asset"] = rule_asset
    
    matching_in_txs = await db.transactions.find(query_in, {"_id": 0}).to_list(1000)
    
    for tx in matching_in_txs:
        existing_mov = await db.position_movements.find_one({
            "position_id": position_id,
            "linked_tx_id": tx.get("id")
        })
        
        if existing_mov:
            continue
        
        amount = abs(tx.get("amount", 0))
        mov = PositionMovement(
            user_id=user_id,
            position_id=position_id,
            movement_type="yield_realized",  # Rendement reçu
            amount=amount,
            asset=tx.get("asset", position.get("asset")),
            date=tx.get("date", datetime.now(timezone.utc).isoformat()),
            tx_hash=tx.get("tx_hash", ""),
            notes=f"Rendement auto-affecté depuis {tx.get('wallet_name', 'wallet')}",
            linked_tx_id=tx.get("id")
        )
        await db.position_movements.insert_one(mov.model_dump())
        created_movements += 1
        
        await db.transactions.update_one(
            {"id": tx.get("id")},
            {"$set": {"linked_position_id": position_id}}
        )
        linked_transactions += 1
    
    return {
        "message": f"Règles appliquées: {created_movements} mouvements créés, {linked_transactions} transactions liées",
        "created_movements": created_movements,
        "linked_transactions": linked_transactions
    }

@api_router.get("/positions/{position_id}/preview-rules")
async def preview_position_rules(position_id: str, current_user: dict = Depends(get_current_user)):
    """Preview which transactions would match the position rules without applying them"""
    user_id = current_user["id"]
    
    position = await db.positions.find_one({"id": position_id, "user_id": user_id}, {"_id": 0})
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    
    rule_address = position.get("rule_address", "").lower().strip()
    rule_asset = position.get("rule_asset", "").strip()
    
    if not rule_address and not rule_asset:
        return {"matching_transactions": [], "count": 0}
    
    # Build query
    query = {"user_id": user_id}
    
    if rule_address and rule_asset:
        query["$and"] = [
            {"$or": [
                {"counterparty_wallet": {"$regex": rule_address, "$options": "i"}},
                {"tx_hash": {"$regex": rule_address, "$options": "i"}}
            ]},
            {"asset": rule_asset}
        ]
    elif rule_address:
        query["$or"] = [
            {"counterparty_wallet": {"$regex": rule_address, "$options": "i"}},
            {"tx_hash": {"$regex": rule_address, "$options": "i"}}
        ]
    elif rule_asset:
        query["asset"] = rule_asset
    
    matching_txs = await db.transactions.find(query, {"_id": 0}).sort("date", -1).to_list(50)
    
    return {
        "matching_transactions": matching_txs,
        "count": len(matching_txs),
        "rule_address": rule_address,
        "rule_asset": rule_asset
    }

# ==================== POSITION MOVEMENTS ENDPOINTS ====================

@api_router.post("/position-movements", response_model=dict)
async def create_position_movement(movement: PositionMovementCreate, current_user: dict = Depends(get_current_user)):
    """Create a new movement for a position (yield, withdrawal, loss, capital addition) with optional wallet interdependence"""
    # Verify position exists and belongs to user
    position = await db.positions.find_one({"id": movement.position_id, "user_id": current_user["id"]}, {"_id": 0})
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    
    mov_dict = movement.model_dump()
    mov_dict["date"] = mov_dict.get("date") or datetime.now(timezone.utc).isoformat()
    
    # Remove non-model fields
    create_deposit_tx = mov_dict.pop("create_deposit_tx", False)
    target_wallet_id = mov_dict.get("target_wallet_id")
    
    # Ignore "none" values
    if target_wallet_id == "none":
        target_wallet_id = None
        mov_dict["target_wallet_id"] = None
    
    linked_tx_id = None
    linked_tx_message = ""
    position_update_message = ""
    
    # Mettre à jour le montant de la position si ajout ou retrait de capital
    if movement.movement_type == "capital_addition":
        # Ajout de capital = augmente le montant de la position
        new_amount = position.get("amount", 0) + abs(movement.amount)
        await db.positions.update_one(
            {"id": movement.position_id},
            {"$set": {"amount": new_amount}}
        )
        position_update_message = f" (nouveau capital: {new_amount:.2f})"
    elif movement.movement_type == "capital_withdrawal":
        # Retrait de capital = diminue le montant de la position
        new_amount = max(0, position.get("amount", 0) - abs(movement.amount))
        await db.positions.update_one(
            {"id": movement.position_id},
            {"$set": {"amount": new_amount}}
        )
        position_update_message = f" (nouveau capital: {new_amount:.2f})"
    
    # Interdépendance: Créer une transaction dans le wallet
    # Pour ajout de capital: créer un Transfer Out depuis le wallet source
    if create_deposit_tx and target_wallet_id and movement.movement_type == "capital_addition":
        wallet = await db.wallets.find_one({"id": target_wallet_id, "user_id": current_user["id"]}, {"_id": 0})
        if wallet:
            withdrawal_tx = Transaction(
                user_id=current_user["id"],
                wallet_id=target_wallet_id,
                type="Transfer Out",
                asset=movement.asset,
                amount=-abs(movement.amount),
                date=mov_dict["date"],
                tx_hash=movement.tx_hash or "",
                price_eur=0,
                value_eur=0,
                notes=f"Ajout capital vers position {position.get('platform', '')} - {position.get('product_type', '')}",
                linked_position_id=movement.position_id
            )
            await db.transactions.insert_one(withdrawal_tx.model_dump())
            linked_tx_id = withdrawal_tx.id
            linked_tx_message = " + transaction de retrait créée dans le wallet"
            mov_dict["linked_tx_id"] = linked_tx_id
    
    # Pour rendement ou retrait: créer un Transfer In vers le wallet cible
    elif create_deposit_tx and target_wallet_id and movement.movement_type in ["yield_realized", "capital_withdrawal"]:
        # Vérifier que le wallet existe
        wallet = await db.wallets.find_one({"id": target_wallet_id, "user_id": current_user["id"]}, {"_id": 0})
        if wallet:
            # Créer une transaction de dépôt (Transfer In)
            movement_type_label = "Rendement" if movement.movement_type == "yield_realized" else "Retrait capital"
            deposit_tx = Transaction(
                user_id=current_user["id"],
                wallet_id=target_wallet_id,
                type="Transfer In",
                asset=movement.asset,
                amount=abs(movement.amount),  # Positif pour un dépôt
                date=mov_dict["date"],
                tx_hash=movement.tx_hash or "",
                price_eur=0,
                value_eur=0,
                notes=f"{movement_type_label} de position {position.get('platform', '')} - {position.get('product_type', '')}",
                linked_position_id=movement.position_id
            )
            deposit_doc = deposit_tx.model_dump()
            await db.transactions.insert_one(deposit_doc)
            linked_tx_id = deposit_tx.id
            linked_tx_message = " + transaction de dépôt créée dans le wallet"
            
            # Ajouter l'ID de la transaction liée au mouvement
            mov_dict["linked_tx_id"] = linked_tx_id
    
    mov = PositionMovement(user_id=current_user["id"], **mov_dict)
    doc = mov.model_dump()
    await db.position_movements.insert_one(doc)
    
    return {
        "id": mov.id, 
        "message": f"Mouvement créé{linked_tx_message}{position_update_message}",
        "linked_tx_id": linked_tx_id
    }

@api_router.get("/position-movements")
async def get_position_movements(position_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get all movements for user, optionally filtered by position"""
    query = {"user_id": current_user["id"]}
    if position_id:
        query["position_id"] = position_id
    
    movements = await db.position_movements.find(query, {"_id": 0}).to_list(1000)
    
    # Group by type for summary
    summary = {
        "capital_addition": {"count": 0, "total": 0},
        "yield_realized": {"count": 0, "total": 0},
        "capital_withdrawal": {"count": 0, "total": 0},
        "capital_deposit": {"count": 0, "total": 0},
        "impermanent_loss": {"count": 0, "total": 0}
    }
    for mov in movements:
        mt = mov.get("movement_type", "")
        if mt in summary:
            summary[mt]["count"] += 1
            summary[mt]["total"] += mov.get("amount", 0)
    
    return {
        "movements": movements,
        "summary": summary,
        "total_movements": len(movements)
    }

@api_router.get("/position-movements/{position_id}")
async def get_movements_for_position(position_id: str, current_user: dict = Depends(get_current_user)):
    """Get all movements for a specific position"""
    movements = await db.position_movements.find(
        {"position_id": position_id, "user_id": current_user["id"]}, 
        {"_id": 0}
    ).to_list(1000)
    
    # Calculate totals
    total_addition = sum(m.get("amount", 0) for m in movements if m.get("movement_type") == "capital_addition")
    total_yield = sum(m.get("amount", 0) for m in movements if m.get("movement_type") in ["yield_realized", "capital_deposit"])
    total_withdrawal = sum(m.get("amount", 0) for m in movements if m.get("movement_type") == "capital_withdrawal")
    total_loss = sum(m.get("amount", 0) for m in movements if m.get("movement_type") == "impermanent_loss")
    
    return {
        "movements": movements,
        "total_capital_added": total_addition,
        "total_yield_realized": total_yield,
        "total_capital_withdrawn": total_withdrawal,
        "total_loss": total_loss
    }

@api_router.get("/export/position-movements")
async def export_position_movements_csv(position_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Export position movements to CSV"""
    from fastapi.responses import StreamingResponse
    import io
    
    query = {"user_id": current_user["id"]}
    if position_id:
        query["position_id"] = position_id
    
    movements = await db.position_movements.find(query, {"_id": 0}).sort("date", -1).to_list(10000)
    
    # Get position details for context
    positions_cache = {}
    for mov in movements:
        pos_id = mov.get("position_id")
        if pos_id and pos_id not in positions_cache:
            pos = await db.positions.find_one({"id": pos_id}, {"_id": 0})
            if pos:
                positions_cache[pos_id] = pos
    
    # Build CSV
    output = io.StringIO()
    headers = ["Date", "Position", "Plateforme", "Type Produit", "Type Mouvement", "Asset", "Montant", "TX Hash", "Notes"]
    output.write(",".join(headers) + "\n")
    
    movement_type_labels = {
        "capital_addition": "Ajout Capital",
        "yield_realized": "Rendement Réalisé",
        "capital_withdrawal": "Retrait Capital",
        "capital_deposit": "Dépôt Capital (auto)",
        "impermanent_loss": "Perte"
    }
    
    for mov in movements:
        pos = positions_cache.get(mov.get("position_id"), {})
        row = [
            mov.get("date", "")[:10],
            f"{pos.get('platform', 'N/A')} - {pos.get('product_type', 'N/A')}",
            pos.get("platform", "N/A"),
            pos.get("product_type", "N/A"),
            movement_type_labels.get(mov.get("movement_type", ""), mov.get("movement_type", "")),
            mov.get("asset", ""),
            str(mov.get("amount", 0)),
            mov.get("tx_hash", ""),
            mov.get("notes", "").replace(",", ";").replace("\n", " ")
        ]
        output.write(",".join([f'"{v}"' for v in row]) + "\n")
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=position_movements_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@api_router.put("/position-movements/{movement_id}")
async def update_position_movement(movement_id: str, mov_data: PositionMovementUpdate, current_user: dict = Depends(get_current_user)):
    """Update an existing movement"""
    existing = await db.position_movements.find_one({"id": movement_id, "user_id": current_user["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Movement not found")
    
    update_data = {k: v for k, v in mov_data.model_dump().items() if v is not None}
    if not update_data:
        return {"message": "No changes provided", "id": movement_id}
    
    await db.position_movements.update_one(
        {"id": movement_id, "user_id": current_user["id"]},
        {"$set": update_data}
    )
    return {"message": "Movement updated", "id": movement_id}

@api_router.delete("/position-movements/{movement_id}")
async def delete_position_movement(movement_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a movement"""
    result = await db.position_movements.delete_one({"id": movement_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Movement not found")
    return {"message": "Movement deleted"}

# ==================== PORTFOLIO ENDPOINTS ====================

@api_router.get("/portfolio/summary")
async def get_portfolio_summary(current_user: dict = Depends(get_current_user)):
    """Get portfolio summary (excluding SPAM transactions)"""
    # Exclude spam transactions from portfolio calculations
    transactions = await db.transactions.find({
        "user_id": current_user["id"],
        "$or": [{"is_spam": False}, {"is_spam": {"$exists": False}}]
    }, {"_id": 0}).to_list(10000)
    
    holdings = {}
    for tx in transactions:
        asset = tx.get("asset", "UNKNOWN")
        amount = tx.get("amount", 0)
        
        if asset not in holdings:
            holdings[asset] = 0
        
        if tx.get("type") in ["Transfer In", "Buy"]:
            holdings[asset] += amount
        elif tx.get("type") in ["Transfer Out", "Sell"]:
            holdings[asset] -= amount
    
    prices = await get_crypto_prices()
    
    total_value_usd = 0
    total_value_eur = 0
    assets = []
    
    for asset, amount in holdings.items():
        if amount > 0:
            price_data = prices.get(asset, {"price_usd": 1, "price_eur": 0.92})
            value_usd = amount * price_data.get("price_usd", 1)
            value_eur = amount * price_data.get("price_eur", 0.92)
            
            total_value_usd += value_usd
            total_value_eur += value_eur
            
            assets.append({
                "asset": asset,
                "amount": amount,
                "price_usd": price_data.get("price_usd", 1),
                "price_eur": price_data.get("price_eur", 0.92),
                "value_usd": value_usd,
                "value_eur": value_eur,
                "change_24h": price_data.get("change_24h", 0)
            })
    
    return {
        "total_value_usd": total_value_usd,
        "total_value_eur": total_value_eur,
        "assets": assets,
        "asset_count": len(assets)
    }

@api_router.get("/portfolio/allocation")
async def get_portfolio_allocation(current_user: dict = Depends(get_current_user)):
    """Get portfolio allocation by asset"""
    summary = await get_portfolio_summary(current_user)
    total = summary["total_value_usd"]
    
    allocation = []
    for asset in summary["assets"]:
        percentage = (asset["value_usd"] / total * 100) if total > 0 else 0
        allocation.append({
            "asset": asset["asset"],
            "value_usd": asset["value_usd"],
            "percentage": percentage
        })
    
    return allocation

# ==================== P&L CALCULATION (FIFO) ====================

@api_router.get("/portfolio/pnl")
async def get_pnl_report(current_user: dict = Depends(get_current_user)):
    """Calculate P&L using FIFO method in EUR (excluding SPAM and internal transfers)"""
    # Exclude spam transactions from P&L calculations - stricter filter
    transactions = await db.transactions.find(
        {
            "user_id": current_user["id"],
            "is_spam": {"$ne": True}  # Exclude is_spam=True, include False and undefined
        },
        {"_id": 0}
    ).sort("date", 1).to_list(10000)
    
    # Filter again in Python to be absolutely sure (belt and suspenders)
    transactions = [tx for tx in transactions if tx.get("is_spam") != True]
    
    # Identify internal transfers (non-taxable)
    # Internal transfers are: linked_tx_id set, linked_position_id set, or source contains "transfer"
    def is_internal_transfer(tx):
        """Check if transaction is an internal transfer (non-taxable)"""
        # Has linked counterpart transaction = internal transfer between wallets
        if tx.get("linked_tx_id"):
            return True
        # Linked to a position = capital movement, not taxable
        if tx.get("linked_position_id"):
            return True
        # Source indicates fiat transfer
        if "transfer" in tx.get("source", "").lower():
            return True
        # Notes indicate internal transfer
        notes = tx.get("notes", "").lower()
        if "contrepartie" in notes or "interne" in notes or "transfert" in notes:
            return True
        return False
    
    # Group by asset
    asset_txs: Dict[str, List[dict]] = {}
    for tx in transactions:
        asset = tx.get("asset", "UNKNOWN")
        if asset not in asset_txs:
            asset_txs[asset] = []
        asset_txs[asset].append(tx)
    
    prices = await get_crypto_prices()
    reports = []
    
    for asset, txs in asset_txs.items():
        # FIFO queue: list of (amount, cost_per_unit_eur)
        fifo_queue = []
        
        total_bought = 0
        total_sold = 0
        total_cost_eur = 0
        total_proceeds_eur = 0
        realized_pnl_eur = 0
        total_fees_eur = 0
        
        for tx in txs:
            tx_type = tx.get("type", "")
            amount = abs(tx.get("amount", 0))
            price_eur = tx.get("price_eur", 0.92)
            fees = tx.get("fees", 0)
            fees_currency = tx.get("fees_currency", "EUR")
            
            # Convert fees to EUR
            fee_eur = fees if fees_currency == "EUR" else fees * 0.92
            total_fees_eur += fee_eur
            
            # Check if this is an internal transfer (non-taxable)
            internal_transfer = is_internal_transfer(tx)
            
            if tx_type in ["Transfer In", "Buy"]:
                # Add to FIFO queue
                cost_per_unit = price_eur + (fee_eur / amount if amount > 0 else 0)
                fifo_queue.append({"amount": amount, "cost": cost_per_unit})
                total_bought += amount
                total_cost_eur += amount * price_eur + fee_eur
                
            elif tx_type in ["Transfer Out", "Sell"]:
                total_sold += amount
                proceeds = amount * price_eur - fee_eur
                total_proceeds_eur += proceeds
                
                # Calculate cost basis using FIFO
                remaining = amount
                cost_basis = 0
                
                while remaining > 0 and fifo_queue:
                    oldest = fifo_queue[0]
                    
                    if oldest["amount"] <= remaining:
                        # Use entire lot
                        cost_basis += oldest["amount"] * oldest["cost"]
                        remaining -= oldest["amount"]
                        fifo_queue.pop(0)
                    else:
                        # Use partial lot
                        cost_basis += remaining * oldest["cost"]
                        oldest["amount"] -= remaining
                        remaining = 0
                
                # Realized P&L for this sale - ONLY if NOT an internal transfer
                if not internal_transfer:
                    realized_pnl_eur += proceeds - cost_basis
                # For internal transfers, P&L is neutral (0)
        
        # Calculate current holdings and unrealized P&L
        current_holdings = sum(lot["amount"] for lot in fifo_queue)
        remaining_cost = sum(lot["amount"] * lot["cost"] for lot in fifo_queue)
        
        price_data = prices.get(asset, {"price_eur": 0.92})
        current_value_eur = current_holdings * price_data.get("price_eur", 0.92)
        unrealized_pnl_eur = current_value_eur - remaining_cost
        
        reports.append(PLReport(
            asset=asset,
            total_bought=total_bought,
            total_sold=total_sold,
            total_cost_eur=total_cost_eur,
            total_proceeds_eur=total_proceeds_eur,
            realized_pnl_eur=realized_pnl_eur,
            unrealized_pnl_eur=unrealized_pnl_eur,
            current_holdings=current_holdings,
            current_value_eur=current_value_eur,
            total_fees_eur=total_fees_eur
        ))
    
    # Summary
    total_realized = sum(r.realized_pnl_eur for r in reports)
    total_unrealized = sum(r.unrealized_pnl_eur for r in reports)
    total_fees = sum(r.total_fees_eur for r in reports)
    total_holdings_value = sum(r.current_value_eur for r in reports)
    
    return {
        "reports": [r.model_dump() for r in reports],
        "summary": {
            "total_realized_pnl_eur": total_realized,
            "total_unrealized_pnl_eur": total_unrealized,
            "total_pnl_eur": total_realized + total_unrealized,
            "total_fees_eur": total_fees,
            "total_holdings_value_eur": total_holdings_value
        }
    }

# ==================== EXPORT ENDPOINT ====================

@api_router.get("/export/transactions")
async def export_transactions(current_user: dict = Depends(get_current_user)):
    """Export all transactions as CSV (excluding SPAM)"""
    # Exclude spam transactions from export
    transactions = await db.transactions.find({
        "user_id": current_user["id"],
        "$or": [{"is_spam": False}, {"is_spam": {"$exists": False}}]
    }, {"_id": 0}).sort("date", -1).to_list(10000)
    
    output = io.StringIO()
    if transactions:
        # Remove user_id from export
        for tx in transactions:
            tx.pop("user_id", None)
        writer = csv.DictWriter(output, fieldnames=transactions[0].keys())
        writer.writeheader()
        for tx in transactions:
            writer.writerow(tx)
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"}
    )

@api_router.get("/export/fiat-accounts")
async def export_fiat_accounts(current_user: dict = Depends(get_current_user)):
    """Export all fiat accounts as CSV"""
    accounts = await db.fiat_accounts.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    
    output = io.StringIO()
    if accounts:
        fieldnames = ["name", "currency", "balance", "created_at"]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for acc in accounts:
            writer.writerow({
                "name": acc.get("name", ""),
                "currency": acc.get("currency", "EUR"),
                "balance": acc.get("balance", 0),
                "created_at": acc.get("created_at", "")
            })
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=comptes_fiat.csv"}
    )

@api_router.get("/export/fiat-transactions")
async def export_fiat_transactions(
    account_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Export fiat transactions as CSV"""
    query = {"user_id": current_user["id"]}
    if account_id:
        query["account_id"] = account_id
    
    transactions = await db.fiat_transactions.find(query, {"_id": 0}).sort("date", -1).to_list(10000)
    
    # Get account names for reference
    accounts = await db.fiat_accounts.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    account_names = {a["id"]: a["name"] for a in accounts}
    
    output = io.StringIO()
    if transactions:
        fieldnames = ["date", "type", "description", "debit", "credit", "solde", "compte", "origine", "destination"]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for tx in transactions:
            amount = tx.get("amount", 0)
            writer.writerow({
                "date": tx.get("date", ""),
                "type": tx.get("type", ""),
                "description": tx.get("description", ""),
                "debit": abs(amount) if amount < 0 else "",
                "credit": amount if amount > 0 else "",
                "solde": tx.get("running_balance", ""),
                "compte": account_names.get(tx.get("account_id"), ""),
                "origine": tx.get("source_name", ""),
                "destination": tx.get("dest_name", "")
            })
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions_fiat.csv"}
    )

@api_router.get("/export/positions")
async def export_positions(current_user: dict = Depends(get_current_user)):
    """Export all investment positions as CSV"""
    positions = await db.positions.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    movements = await db.position_movements.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(10000)
    
    # Group movements by position
    movements_by_pos = {}
    for mov in movements:
        pos_id = mov.get("position_id")
        if pos_id not in movements_by_pos:
            movements_by_pos[pos_id] = {"yield": 0, "withdrawn": 0, "loss": 0}
        if mov.get("movement_type") == "yield_realized":
            movements_by_pos[pos_id]["yield"] += mov.get("amount", 0)
        elif mov.get("movement_type") == "capital_withdrawal":
            movements_by_pos[pos_id]["withdrawn"] += mov.get("amount", 0)
        elif mov.get("movement_type") == "impermanent_loss":
            movements_by_pos[pos_id]["loss"] += mov.get("amount", 0)
    
    output = io.StringIO()
    if positions:
        fieldnames = ["plateforme", "type", "asset", "montant_initial", "apy", "date_depot", "date_deblocage", "rendement_realise", "capital_retire", "pertes", "notes"]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for pos in positions:
            pos_id = pos.get("id")
            mov_data = movements_by_pos.get(pos_id, {"yield": 0, "withdrawn": 0, "loss": 0})
            writer.writerow({
                "plateforme": pos.get("platform", ""),
                "type": pos.get("product_type", ""),
                "asset": pos.get("asset", ""),
                "montant_initial": pos.get("amount", 0),
                "apy": pos.get("apy", 0),
                "date_depot": pos.get("deposit_date", ""),
                "date_deblocage": pos.get("unlock_date", ""),
                "rendement_realise": mov_data["yield"],
                "capital_retire": mov_data["withdrawn"],
                "pertes": mov_data["loss"],
                "notes": pos.get("notes", "")
            })
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=positions.csv"}
    )

# ==================== FISCAL PDF EXPORT ====================

@api_router.get("/export/fiscal-pdf")
async def export_fiscal_pdf(
    year: int = Query(default=datetime.now().year),
    current_user: dict = Depends(get_current_user)
):
    """Generate French fiscal report PDF for cryptocurrency gains/losses (excluding SPAM)"""
    
    # Get all transactions for the year (excluding SPAM)
    start_date = f"{year}-01-01"
    end_date = f"{year}-12-31"
    
    transactions = await db.transactions.find({
        "user_id": current_user["id"],
        "date": {"$gte": start_date, "$lte": end_date},
        "$or": [{"is_spam": False}, {"is_spam": {"$exists": False}}]
    }, {"_id": 0}).sort("date", 1).to_list(10000)
    
    # Get P&L report
    pnl_data = await get_pnl_report(current_user)
    summary = pnl_data["summary"]
    reports = pnl_data["reports"]
    
    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=30,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#1a1a2e')
    )
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        spaceBefore=20,
        spaceAfter=10,
        textColor=colors.HexColor('#16213e')
    )
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6
    )
    cell_style = ParagraphStyle(
        'CellStyle',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        wordWrap='CJK'
    )
    cell_style_small = ParagraphStyle(
        'CellStyleSmall',
        parent=styles['Normal'],
        fontSize=7,
        leading=9,
        wordWrap='CJK'
    )
    
    elements = []
    
    # Title
    elements.append(Paragraph(f"Rapport Fiscal - Crypto-actifs {year}", title_style))
    elements.append(Spacer(1, 10))
    
    # User info
    elements.append(Paragraph(f"<b>Utilisateur:</b> {current_user.get('full_name', current_user['username'])}", normal_style))
    elements.append(Paragraph(f"<b>Email:</b> {current_user['email']}", normal_style))
    elements.append(Paragraph(f"<b>Date du rapport:</b> {datetime.now().strftime('%d/%m/%Y %H:%M')}", normal_style))
    elements.append(Spacer(1, 20))
    
    # Summary Section
    elements.append(Paragraph("Résumé des Plus/Moins-Values", heading_style))
    
    summary_data = [
        ["Description", "Montant (EUR)"],
        ["Plus-values réalisées", f"{summary['total_realized_pnl_eur']:,.2f} €"],
        ["Plus-values latentes", f"{summary['total_unrealized_pnl_eur']:,.2f} €"],
        ["Total des plus/moins-values", f"{summary['total_pnl_eur']:,.2f} €"],
        ["Total des frais", f"{summary['total_fees_eur']:,.2f} €"],
        ["Valeur actuelle du portefeuille", f"{summary['total_holdings_value_eur']:,.2f} €"]
    ]
    
    summary_table = Table(summary_data, colWidths=[10*cm, 5*cm])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#1a1a2e')),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        # Highlight total row
        ('BACKGROUND', (0, 3), (-1, 3), colors.HexColor('#dbeafe')),
        ('FONTNAME', (0, 3), (-1, 3), 'Helvetica-Bold'),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 20))
    
    # Detail by Asset
    elements.append(Paragraph("Détail par Crypto-actif (Méthode FIFO)", heading_style))
    
    asset_data = [["Actif", "Acheté", "Vendu", "Coût (€)", "Produit (€)", "P&L Réalisé (€)", "P&L Latent (€)"]]
    
    for report in reports:
        pnl_realized_color = "green" if report["realized_pnl_eur"] >= 0 else "red"
        pnl_unrealized_color = "green" if report["unrealized_pnl_eur"] >= 0 else "red"
        
        asset_data.append([
            report["asset"],
            f"{report['total_bought']:,.2f}",
            f"{report['total_sold']:,.2f}",
            f"{report['total_cost_eur']:,.2f}",
            f"{report['total_proceeds_eur']:,.2f}",
            f"{report['realized_pnl_eur']:,.2f}",
            f"{report['unrealized_pnl_eur']:,.2f}"
        ])
    
    asset_table = Table(asset_data, colWidths=[2*cm, 2.3*cm, 2.3*cm, 2.5*cm, 2.5*cm, 2.7*cm, 2.7*cm])
    asset_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10b981')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f0fdf4')),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#1a1a2e')),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1fae5')),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
    ]))
    elements.append(asset_table)
    elements.append(Spacer(1, 20))
    
    # Transaction History
    elements.append(Paragraph(f"Historique des Transactions {year}", heading_style))
    
    if transactions:
        tx_data = [["Date", "Type", "Actif", "Quantité", "Prix EUR", "Valeur EUR", "Frais"]]
        
        for tx in transactions[:50]:  # Limit to 50 transactions in PDF
            # Use Paragraph for text wrapping in first columns
            date_cell = Paragraph(tx.get("date", ""), cell_style)
            type_cell = Paragraph(tx.get("type", ""), cell_style)
            asset_cell = Paragraph(tx.get("asset", ""), cell_style)
            
            tx_data.append([
                date_cell,
                type_cell,
                asset_cell,
                f"{tx.get('amount', 0):,.2f}",
                f"{tx.get('price_eur', 0):,.4f}",
                f"{tx.get('value_eur', 0):,.2f}",
                f"{tx.get('fees', 0):,.2f}"
            ])
        
        if len(transactions) > 50:
            tx_data.append([Paragraph("...", cell_style), Paragraph(f"et {len(transactions) - 50} autres transactions", cell_style), "", "", "", "", ""])
        
        tx_table = Table(tx_data, colWidths=[2.2*cm, 2.5*cm, 2*cm, 2.3*cm, 2.3*cm, 2.3*cm, 2*cm])
        tx_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6366f1')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('ALIGN', (0, 0), (1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f5f3ff')),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#1a1a2e')),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e7ff')),
            ('TOPPADDING', (0, 1), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
        ]))
        elements.append(tx_table)
    else:
        elements.append(Paragraph(f"Aucune transaction enregistrée pour l'année {year}.", normal_style))
    
    elements.append(Spacer(1, 30))
    
    # Footer note
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#64748b'),
        alignment=TA_CENTER
    )
    elements.append(Paragraph(
        "Ce document est généré automatiquement par CryptoTrack. "
        "Il est fourni à titre indicatif et ne constitue pas un conseil fiscal. "
        "Consultez un professionnel pour vos déclarations officielles.",
        footer_style
    ))
    elements.append(Paragraph(
        f"Méthode de calcul: FIFO (First In, First Out) - Devise: EUR",
        footer_style
    ))
    
    # Build PDF
    doc.build(elements)
    
    buffer.seek(0)
    filename = f"rapport_fiscal_crypto_{year}_{current_user['username']}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "CryptoTrack API v2.0", "status": "running"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
