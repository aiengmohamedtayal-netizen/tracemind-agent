from __future__ import annotations

from datetime import datetime

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.db.models import AnalysisRunModel, EventRecordModel


class AnalysisRepository:
    """Persistence boundary for analysis reports and their event-level records."""

    def save_completed_run(self, session: Session, result: dict, *, owner_id: int) -> None:
        run = AnalysisRunModel(
            run_id=result["run_id"],
            dataset_name=result["dataset_name"],
            file_format=result["file_format"],
            status=result["status"],
            created_at=datetime.fromisoformat(result["created_at"].replace("Z", "+00:00")),
            total_events=result["isolation_forest"]["total_events"],
            anomaly_count=result["isolation_forest"]["anomalous_events_count"],
            result_json=result,
            owner_id=owner_id,
        )
        session.add(run)
        session.flush()
        event_rows = [
            {
                "run_id": run.run_id,
                "event_id": event["event_id"],
                "is_anomaly": event["is_anomaly"],
                "anomaly_score": event["anomaly_score"],
                "event_json": event,
            }
            for event in result["events"]
        ]
        if event_rows:
            session.execute(insert(EventRecordModel), event_rows)

    def list_runs(self, session: Session, owner_id: int, limit: int = 20, offset: int = 0) -> list[dict]:
        runs = session.scalars(
            select(AnalysisRunModel)
            .where(AnalysisRunModel.owner_id == owner_id)
            .order_by(AnalysisRunModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        ).all()
        return [run.result_json for run in runs]

    def get_run(self, session: Session, run_id: str, owner_id: int) -> dict:
        run = session.scalar(select(AnalysisRunModel).where(AnalysisRunModel.run_id == run_id, AnalysisRunModel.owner_id == owner_id))
        if run is None:
            raise NotFoundError(f"Analysis run '{run_id}' was not found.")
        return run.result_json

    def get_events(self, session: Session, run_id: str, owner_id: int) -> list[dict]:
        self.get_run(session, run_id, owner_id)
        events = session.scalars(
            select(EventRecordModel).where(EventRecordModel.run_id == run_id).order_by(EventRecordModel.id)
        ).all()
        return [event.event_json for event in events]

    def delete_run(self, session: Session, run_id: str, owner_id: int) -> None:
        run = session.scalar(select(AnalysisRunModel).where(AnalysisRunModel.run_id == run_id, AnalysisRunModel.owner_id == owner_id))
        if run is None:
            raise NotFoundError(f"Analysis run '{run_id}' was not found.")
        session.delete(run)
