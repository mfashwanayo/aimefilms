from __future__ import annotations

from typing import Any

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import DATABASE_URL, DB_POOL_MAX_SIZE, DB_POOL_MIN_SIZE

_pool: ConnectionPool | None = None


def open_pool() -> None:
    """Open a bounded PostgreSQL connection pool once per API process."""
    global _pool
    if _pool is not None:
        return
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured. Set it in the backend environment.")

    pool = ConnectionPool(
        conninfo=DATABASE_URL,
        min_size=DB_POOL_MIN_SIZE,
        max_size=DB_POOL_MAX_SIZE,
        kwargs={"row_factory": dict_row, "sslmode": "require", "connect_timeout": 10},
        open=False,
        timeout=10,
    )
    pool.open(wait=True, timeout=10)
    _pool = pool


def db() -> Any:
    """Borrow one connection; use as a context manager in routes."""
    if _pool is None:
        raise RuntimeError("Database pool is not open. The API startup sequence has not completed.")
    return _pool.connection()


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
