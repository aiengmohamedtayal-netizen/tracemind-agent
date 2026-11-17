from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{(tmp_path / 'tracemind-test.db').as_posix()}")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000")
    import app.core.config as config_module
    config_module.get_settings.cache_clear()
    import app.api.routes as routes_module
    import app.db.database as database_module
    import app.db.models as models_module
    import app.db.repository as repository_module
    import app.main as main_module
    for module in (database_module, models_module, repository_module, routes_module, main_module):
        importlib.reload(module)
    from app.db.database import Base, engine
    Base.metadata.create_all(bind=engine)
    with TestClient(main_module.app) as test_client:
        yield test_client


@pytest.fixture()
def valid_events():
    return [
        {"event_id": "evt-1", "timestamp": "2026-11-01T08:00:00Z", "service": "auth", "event_type": "LOGIN", "source_ip": "10.0.0.1", "latency_ms": 30, "error_rate": 0.01, "cpu_pct": 25, "memory_mb": 512, "payload_bytes": 256, "status_code": 200},
        {"event_id": "evt-2", "timestamp": "2026-11-01T08:01:00Z", "service": "auth", "event_type": "LOGIN", "source_ip": "10.0.0.1", "latency_ms": 32, "error_rate": 0.01, "cpu_pct": 26, "memory_mb": 514, "payload_bytes": 260, "status_code": 200},
        {"event_id": "evt-3", "timestamp": "2026-11-01T08:02:00Z", "service": "payments", "event_type": "CHARGE", "source_ip": "10.0.0.2", "latency_ms": 2200, "error_rate": 0.70, "cpu_pct": 98, "memory_mb": 4096, "payload_bytes": 40960, "status_code": 503},
        {"event_id": "evt-4", "timestamp": "2026-11-01T08:03:00Z", "service": "auth", "event_type": "LOGIN", "source_ip": "10.0.0.1", "latency_ms": 35, "error_rate": 0.02, "cpu_pct": 28, "memory_mb": 520, "payload_bytes": 280, "status_code": 200},
        {"event_id": "evt-5", "timestamp": "2026-11-01T08:04:00Z", "service": "auth", "event_type": "LOGIN", "source_ip": "10.0.0.1", "latency_ms": 31, "error_rate": 0.01, "cpu_pct": 24, "memory_mb": 510, "payload_bytes": 255, "status_code": 200},
    ]
