"""Add accounts and nullable ownership; existing rows stay ownerless."""
from alembic import op
import sqlalchemy as sa

revision = "0001_auth_ownership"
down_revision = "0000_initial"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("users", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("email", sa.String(320), nullable=False), sa.Column("password_hash", sa.String(255), nullable=False), sa.Column("role", sa.String(32), nullable=False, server_default="user"), sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("email", name="uq_users_email"))
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_table("refresh_tokens", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("token_hash", sa.String(64), nullable=False, unique=True), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False), sa.Column("revoked_at", sa.DateTime(timezone=True)), sa.Column("replaced_by_id", sa.Integer(), sa.ForeignKey("refresh_tokens.id")))
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    with op.batch_alter_table("analysis_runs") as batch:
        batch.add_column(sa.Column("owner_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_analysis_runs_owner", "users", ["owner_id"], ["id"], ondelete="CASCADE")
        batch.create_index("ix_analysis_runs_owner_id", ["owner_id"])

def downgrade():
    with op.batch_alter_table("analysis_runs") as batch:
        batch.drop_index("ix_analysis_runs_owner_id")
        batch.drop_constraint("fk_analysis_runs_owner", type_="foreignkey")
        batch.drop_column("owner_id")
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
