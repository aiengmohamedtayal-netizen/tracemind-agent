def signup(client, email):
    response = client.post("/api/auth/register", json={"email": email, "password": "correct horse battery staple"})
    assert response.status_code == 201, response.text
    return response.json()


def test_auth_rotation_logout_and_resource_isolation(client, valid_events):
    import json

    from fastapi.testclient import TestClient
    alice = signup(client, "alice@example.com")
    bob_client = TestClient(client.app)
    bob = signup(bob_client, "bob@example.com")
    assert client.get("/api/history").status_code == 401
    aheaders = {"Authorization": f"Bearer {alice['access_token']}"}
    bheaders = {"Authorization": f"Bearer {bob['access_token']}"}
    payload = {"dataset_name": "private.json", "format": "JSON", "content": json.dumps(valid_events)}
    created = client.post("/api/analyze", json=payload, headers=aheaders)
    assert created.status_code == 200, created.text
    run_id = created.json()["run_id"]
    assert bob_client.get("/api/history", headers=bheaders).json() == {"runs": []}
    assert bob_client.get(f"/api/history/{run_id}", headers=bheaders).status_code == 404
    assert bob_client.get(f"/api/history/{run_id}/events", headers=bheaders).status_code == 404
    assert bob_client.delete(f"/api/history/{run_id}", headers=bheaders).status_code == 404
    assert client.delete(f"/api/history/{run_id}", headers=aheaders).status_code == 204
    assert client.get("/api/history", headers=aheaders).json() == {"runs": []}
    rotated = client.post("/api/auth/refresh")
    assert rotated.status_code == 200
    assert client.cookies.get("tracemind_refresh", domain="testserver.local", path="/api/auth")
    assert client.post("/api/auth/refresh", cookies={"tracemind_refresh": ""}).status_code == 401
    assert client.post("/api/auth/logout", headers=aheaders).status_code == 204
    assert client.post("/api/auth/refresh").status_code == 401
    bob_client.close()


def test_duplicate_registration_and_wrong_password(client):
    signup(client, "unique@example.com")
    assert client.post("/api/auth/register", json={"email": "unique@example.com", "password": "correct horse battery staple"}).status_code == 409
    assert client.post("/api/auth/login", json={"email": "unique@example.com", "password": "wrong password value"}).status_code == 401


def test_refresh_token_reuse_revokes_active_family(client):
    signup(client, "rotation@example.com")
    original = client.cookies.get("tracemind_refresh", domain="testserver.local", path="/api/auth")
    first = client.post("/api/auth/refresh")
    assert first.status_code == 200
    rotated = client.cookies.get("tracemind_refresh", domain="testserver.local", path="/api/auth")
    assert rotated and rotated != original
    replay = client.post("/api/auth/refresh", cookies={"tracemind_refresh": original})
    assert replay.status_code == 401
    assert "reuse detected" in replay.json()["detail"]
    assert client.post("/api/auth/refresh", cookies={"tracemind_refresh": rotated}).status_code == 401


def test_legacy_ownerless_runs_remain_inaccessible(client):
    from datetime import UTC, datetime
    from app.db.database import SessionLocal
    from app.db.models import AnalysisRunModel

    signup(client, "legacy-reader@example.com")
    with SessionLocal() as session:
        session.add(AnalysisRunModel(
            run_id="legacy-ownerless", dataset_name="historical.json", file_format="JSON",
            status="completed", created_at=datetime.now(UTC), total_events=0, anomaly_count=0,
            result_json={"run_id": "legacy-ownerless"}, owner_id=None,
        ))
        session.commit()
    token = client.post("/api/auth/login", json={"email": "legacy-reader@example.com", "password": "correct horse battery staple"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert all(run["run_id"] != "legacy-ownerless" for run in client.get("/api/history", headers=headers).json()["runs"])
    assert client.get("/api/history/legacy-ownerless", headers=headers).status_code == 404
    assert client.delete("/api/history/legacy-ownerless", headers=headers).status_code == 404


def test_production_settings_reject_missing_or_short_jwt_secret():
    import secrets
    import pytest
    from pydantic import ValidationError
    from app.core.config import Settings

    with pytest.raises(ValidationError):
        Settings(app_env="production", jwt_secret="local-development-secret-change-before-deploy-32chars")
    with pytest.raises(ValidationError):
        Settings(app_env="production", jwt_secret="short")
    with pytest.raises(ValidationError):
        Settings(app_env="production", jwt_secret="a" * 48)
    with pytest.raises(ValidationError):
        Settings(app_env="production", jwt_secret="x" * 48, cors_origins=["*"])
    production_secret = secrets.token_urlsafe(48)
    assert Settings(app_env="production", jwt_secret=production_secret).jwt_secret == production_secret


def test_concurrent_refresh_requests_do_not_leave_multiple_live_tokens(client):
    from concurrent.futures import ThreadPoolExecutor
    from http.cookies import SimpleCookie
    from fastapi.testclient import TestClient

    signup(client, "parallel-refresh@example.com")
    original = client.cookies.get("tracemind_refresh", domain="testserver.local", path="/api/auth")
    app = client.app
    def refresh_once():
        with TestClient(app) as parallel_client:
            return parallel_client.post("/api/auth/refresh", cookies={"tracemind_refresh": original})
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: refresh_once(), range(2)))
    assert all(response.status_code in (200, 401) for response in responses)
    assert sum(response.status_code == 200 for response in responses) == 1
    winner = next(response for response in responses if response.status_code == 200)
    rotated_cookie = SimpleCookie(winner.headers["set-cookie"])["tracemind_refresh"].value
    assert client.post("/api/auth/refresh", cookies={"tracemind_refresh": rotated_cookie}).status_code == 401
