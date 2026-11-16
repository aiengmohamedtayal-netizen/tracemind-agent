from app.services.pso_optimizer import exhaustive_best_action, optimize_actions


def test_pso_returns_valid_discrete_selection():
    actions = [
        {"action_id": "a", "estimated_cost_usd": 10, "mitigation_efficacy_pct": 70, "sla_risk_score": 5, "execution_latency_sec": 10},
        {"action_id": "b", "estimated_cost_usd": 35, "mitigation_efficacy_pct": 85, "sla_risk_score": 15, "execution_latency_sec": 30},
    ]
    result = optimize_actions(actions, swarm_size=20, max_iterations=20, inertia_weight=.72, cognitive_coeff=1.49, social_coeff=1.49, random_seed=42).payload
    assert result["selected_action"]["action_id"] in {"a", "b"}
    assert sum(action["is_selected"] for action in result["candidate_actions"]) == 1
    assert len(result["convergence_history"]) == 20
    assert exhaustive_best_action(actions) in {0, 1}
