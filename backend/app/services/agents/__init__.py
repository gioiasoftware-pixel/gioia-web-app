"""
Agent system per sistema multi-agent.
Ogni agent è specializzato per un task specifico.
"""
from .base_agent import BaseAgent
from .router_agent import RouterAgent
from .query_agent import QueryAgent
from .movement_agent import MovementAgent
from .analytics_agent import AnalyticsAgent

__all__ = [
    "BaseAgent",
    "RouterAgent",
    "QueryAgent",
    "MovementAgent",
    "AnalyticsAgent",
]

