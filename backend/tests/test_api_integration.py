import json


def test_health_and_complete_analysis_lifecycle(client, valid_events):
    account = client.post("/api/auth/register", json={"email": "integration@example.com", "password": "correct horse battery staple"}).json()
    auth = {"Authorization": f"Bearer {account['access_token']}"}
    assert client.get("/api/health").json()["database"] == "sqlite_connected"
    submitted = client.post("/api/analyze", json={"dataset_name": "fixture.json", "format": "JSON", "content": json.dumps(valid_events), "config": {"contamination": .2, "n_estimators": 50, "swarm_size": 20, "max_iterations": 10, "inertia_weight": .72, "cognitive_coeff": 1.49, "social_coeff": 1.49}}, headers=auth)
    assert submitted.status_code == 200, submitted.text
    report = submitted.json()
    assert report["status"] == "completed"
    assert len(report["events"]) == len(valid_events)
    assert report["agent_recommendation"]["agent_version"] == "2.0.0-deterministic-state-machine"
    trace = report["agent_recommendation"]["decision_trace"]
    assert trace["selected_intention"]["status"] == "selected"
    assert trace["selected_intention"]["action_id"] == report["pso_optimization"]["selected_action"]["action_id"]
    assert all(plan["advisory_only"] for plan in trace["candidate_plans"])
    run_id = report["run_id"]
    assert client.get("/api/history", headers=auth).json()["runs"][0]["run_id"] == run_id
    assert client.get(f"/api/history/{run_id}", headers=auth).json()["run_id"] == run_id
    assert len(client.get(f"/api/history/{run_id}/events", headers=auth).json()["events"]) == len(valid_events)
    assert client.delete(f"/api/history/{run_id}", headers=auth).status_code == 204
    assert client.get(f"/api/history/{run_id}", headers=auth).status_code == 404


def test_invalid_data_is_reported_without_persistence(client, valid_events):
    account = client.post("/api/auth/register", json={"email": "invalid@example.com", "password": "correct horse battery staple"}).json()
    auth = {"Authorization": f"Bearer {account['access_token']}"}
    invalid = valid_events[:2]
    invalid[0].pop("timestamp")
    response = client.post("/api/analyze", json={"dataset_name": "invalid.json", "format": "JSON", "content": json.dumps(invalid)}, headers=auth)
    assert response.status_code == 422
    assert "missing fields" in response.json()["detail"]
    assert client.get("/api/history", headers=auth).json() == {"runs": [], "limit": 20, "offset": 0}


def test_multipart_csv_submission_matches_frontend_contract(client, valid_events):
    account = client.post("/api/auth/register", json={"email": "upload@example.com", "password": "correct horse battery staple"}).json()
    auth = {"Authorization": f"Bearer {account['access_token']}"}
    header = "event_id,timestamp,service,latency_ms,error_rate,cpu_pct,memory_mb,payload_bytes,status_code"
    rows = [",".join(str(event[field]) for field in header.split(",")) for event in valid_events]
    response = client.post(
        "/api/analyze",
        data={"dataset_name": "frontend-upload.csv", "format": "CSV", "contamination": "0.2", "n_estimators": "50", "swarm_size": "20", "max_iterations": "10", "inertia_weight": "0.72", "cognitive_coeff": "1.49", "social_coeff": "1.49"},
        files={"file": ("frontend-upload.csv", "\n".join([header, *rows]), "text/csv")},
        headers=auth,
    )
    assert response.status_code == 200, response.text
    assert response.json()["file_format"] == "CSV"
