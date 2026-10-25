from enum import Enum

from pydantic import BaseModel, Field


class Direction(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class RiskRequest(BaseModel):
    pair: str
    equity: float = Field(gt=0)
    risk_percent: float = Field(gt=0, le=100)
    entry: float = Field(gt=0)
    stop_loss: float = Field(gt=0)
    take_profit: float = Field(gt=0)


class RiskResult(BaseModel):
    pair: str
    risk_amount: float
    stop_distance: float
    potential_reward_distance: float
    reward_to_risk: float
    estimated_position_units: None = None
    position_size_note: str


class TradeCreate(BaseModel):
    pair: str
    direction: Direction
    entry: float = Field(gt=0)
    stop_loss: float = Field(gt=0)
    take_profit: float = Field(gt=0)
    position_units: float = Field(gt=0)
    simulated_equity: float = Field(gt=0)


class TradeClose(BaseModel):
    exit_price: float = Field(gt=0)


class Trade(BaseModel):
    id: int
    pair: str
    direction: Direction
    entry: float
    stop_loss: float
    take_profit: float
    position_units: float
    simulated_equity: float
    status: str
    entry_time: str
    exit_time: str | None
    exit_price: float | None
    simulated_pnl: float | None
    pnl_currency: str | None


class WatchlistItem(BaseModel):
    pair: str
