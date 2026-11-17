from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class PSOResult:
    payload: dict


def action_fitness(action: dict) -> float:
    """0–100 fitness = benefit - normalized investigation cost - risk - latency.

    Benefit comes from measured event characteristics in the action catalog. Cost, risk,
    and latency are fixed catalog metadata normalized by the catalog maxima.
    """
    return round(
        0.60 * action["mitigation_efficacy_pct"]
        - 0.18 * min(100.0, action["estimated_cost_usd"] * 2)
        - 0.15 * action["sla_risk_score"]
        - 0.07 * min(100.0, action["execution_latency_sec"]),
        4,
    )


def exhaustive_best_action(actions: list[dict]) -> int:
    """Small deterministic baseline used by tests; PSO is not claimed to guarantee this result."""
    return max(range(len(actions)), key=lambda index: (action_fitness(actions[index]), -index))


def optimize_actions(actions: list[dict], *, swarm_size: int, max_iterations: int, inertia_weight: float, cognitive_coeff: float, social_coeff: float, random_seed: int) -> PSOResult:
    if not actions:
        raise ValueError("At least one candidate action is required.")
    rng = np.random.default_rng(random_seed)
    action_count = len(actions)
    positions = rng.integers(0, 2, size=(swarm_size, action_count), endpoint=False)
    for row in positions:
        if not row.any():
            row[rng.integers(action_count)] = 1
    velocities = rng.uniform(-1.0, 1.0, size=(swarm_size, action_count))
    personal_best_positions = positions.copy()
    personal_best_scores = np.array([_position_fitness(position, actions) for position in positions])
    best_particle = int(np.argmax(personal_best_scores))
    global_best = personal_best_positions[best_particle].copy()
    global_best_score = float(personal_best_scores[best_particle])
    history: list[dict] = []
    # None means the global best came from the initial swarm position and was never improved.
    converged_at: int | None = None

    for iteration in range(1, max_iterations + 1):
        r1 = rng.random(size=(swarm_size, action_count))
        r2 = rng.random(size=(swarm_size, action_count))
        velocities = (
            inertia_weight * velocities
            + cognitive_coeff * r1 * (personal_best_positions - positions)
            + social_coeff * r2 * (global_best - positions)
        )
        probabilities = 1.0 / (1.0 + np.exp(-np.clip(velocities, -20, 20)))
        positions = (rng.random(size=(swarm_size, action_count)) < probabilities).astype(int)
        for row in positions:
            _enforce_constraints(row, actions)
        scores = np.array([_position_fitness(position, actions) for position in positions])
        improved = scores > personal_best_scores
        personal_best_positions[improved] = positions[improved]
        personal_best_scores[improved] = scores[improved]
        best_particle = int(np.argmax(personal_best_scores))
        if personal_best_scores[best_particle] > global_best_score:
            global_best_score = float(personal_best_scores[best_particle])
            global_best = personal_best_positions[best_particle].copy()
            converged_at = iteration
        unique_positions = len({tuple(row) for row in positions})
        history.append({
            "iteration": iteration,
            "global_best_fitness": round(global_best_score, 4),
            "swarm_mean_fitness": round(float(scores.mean()), 4),
            "swarm_diversity": round(unique_positions / swarm_size, 4),
        })

    selected_index = max((index for index, enabled in enumerate(global_best) if enabled), key=lambda index: (action_fitness(actions[index]), -index))
    evaluated_actions = [
        {**action, "composite_fitness": action_fitness(action), "is_selected": index == selected_index}
        for index, action in enumerate(actions)
    ]
    selected = evaluated_actions[selected_index]
    baseline_index = max(range(len(actions)), key=lambda index: actions[index]["estimated_cost_usd"])
    baseline_cost = actions[baseline_index]["estimated_cost_usd"]
    optimized_cost = selected["estimated_cost_usd"]
    return PSOResult({
        "algorithm": "ParticleSwarmOptimization",
        "swarm_size": swarm_size,
        "max_iterations": max_iterations,
        "inertia_weight": inertia_weight,
        "cognitive_coeff": cognitive_coeff,
        "social_coeff": social_coeff,
        "converged_at_iteration": converged_at,
        "best_fitness_score": round(selected["composite_fitness"], 4),
        "baseline_cost_usd": baseline_cost,
        "optimized_cost_usd": optimized_cost,
        "estimated_savings_pct": round(((baseline_cost - optimized_cost) / baseline_cost * 100) if baseline_cost else 0.0, 2),
        "selected_action": selected,
        "candidate_actions": evaluated_actions,
        "convergence_history": history,
        "optimal_weights": {"mitigation_weight": 0.60, "cost_weight": 0.18, "sla_safety_weight": 0.15, "speed_weight": 0.07},
    })


def _enforce_constraints(position: np.ndarray, actions: list[dict]) -> None:
    selected = np.flatnonzero(position)
    if len(selected) == 0:
        position[0] = 1
        return
    # A two-action, $50 analysis budget prevents noisy over-selection in the binary encoding.
    ranked = sorted(selected, key=lambda index: action_fitness(actions[int(index)]), reverse=True)
    retained: list[int] = []
    cost = 0.0
    for index in ranked:
        action_cost = actions[int(index)]["estimated_cost_usd"]
        if len(retained) < 2 and cost + action_cost <= 50:
            retained.append(int(index))
            cost += action_cost
    position[:] = 0
    position[retained or [ranked[0]]] = 1


def _position_fitness(position: np.ndarray, actions: list[dict]) -> float:
    indexes = np.flatnonzero(position)
    if len(indexes) == 0:
        return -100.0
    # NOTE: The fitness of a position is the best single-action fitness within that position.
    # This means the PSO searches for the globally best single action across the binary solution space.
    # This is intentional for demonstrative purposes — the exhaustive baseline in tests (exhaustive_best_action)
    # independently verifies the same result. The binary encoding supports up to 2 actions per budget
    # constraint (_enforce_constraints), but the fitness remains max-based to maintain a clear,
    # verifiable objective function. See docs/validation/ for the PSO design rationale.
    return max(action_fitness(actions[int(index)]) for index in indexes)
