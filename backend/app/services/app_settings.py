import logging
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

SETTINGS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
)
"""


async def ensure_settings_table(session: AsyncSession) -> None:
    await session.execute(sql_text(SETTINGS_TABLE_SQL))
    await session.commit()


async def get_app_setting(session: AsyncSession, key: str) -> str | None:
    await ensure_settings_table(session)
    result = await session.execute(
        sql_text("SELECT value FROM app_settings WHERE key = :key"),
        {"key": key},
    )
    row = result.fetchone()
    return row[0] if row else None


async def set_app_setting(session: AsyncSession, key: str, value: str) -> None:
    await ensure_settings_table(session)
    await session.execute(
        sql_text(
            """
            INSERT INTO app_settings (key, value, updated_at)
            VALUES (:key, :value, NOW())
            ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value, updated_at = NOW()
            """
        ),
        {"key": key, "value": value},
    )
    await session.commit()
