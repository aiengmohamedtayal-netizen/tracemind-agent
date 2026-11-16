"""Initial schema for new local installations."""
from alembic import op
import sqlalchemy as sa

revision = "0000_initial"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("analysis_runs", sa.Column("run_id", sa.String(64), primary_key=True), sa.Column("dataset_name", sa.String(255), nullable=False), sa.Column("file_format", sa.String(8), nullable=False), sa.Column("status", sa.String(16), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("total_events", sa.Integer(), nullable=False), sa.Column("anomaly_count", sa.Integer(), nullable=False), sa.Column("result_json", sa.JSON(), nullable=False))
    op.create_index("ix_analysis_runs_status", "analysis_runs", ["status"])
    op.create_index("ix_analysis_runs_created_at", "analysis_runs", ["created_at"])
    op.create_table("event_records", sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True), sa.Column("run_id", sa.String(64), sa.ForeignKey("analysis_runs.run_id", ondelete="CASCADE"), nullable=False), sa.Column("event_id", sa.String(255), nullable=False), sa.Column("is_anomaly", sa.Boolean(), nullable=False), sa.Column("anomaly_score", sa.Float(), nullable=False), sa.Column("event_json", sa.JSON(), nullable=False), sa.UniqueConstraint("run_id", "event_id"))
    op.create_index("ix_event_records_run_id", "event_records", ["run_id"])
    op.create_index("ix_event_records_event_id", "event_records", ["event_id"])
    op.create_index("ix_event_records_run_anomaly", "event_records", ["run_id", "is_anomaly"])

def downgrade():
    op.drop_table("event_records")
    op.drop_table("analysis_runs")
