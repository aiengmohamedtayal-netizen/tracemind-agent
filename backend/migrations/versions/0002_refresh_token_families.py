"""Add refresh token family tracking for reuse response."""
from alembic import op
import sqlalchemy as sa
import uuid

revision = "0002_refresh_families"
down_revision = "0001_auth_ownership"
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table("refresh_tokens") as batch:
        batch.add_column(sa.Column("family_id", sa.String(36), nullable=True))
    bind = op.get_bind()
    for row in bind.execute(sa.text("SELECT id FROM refresh_tokens WHERE family_id IS NULL")):
        bind.execute(sa.text("UPDATE refresh_tokens SET family_id=:family WHERE id=:id"), {"family": str(uuid.uuid4()), "id": row.id})
    with op.batch_alter_table("refresh_tokens") as batch:
        batch.alter_column("family_id", existing_type=sa.String(36), nullable=False)
        batch.create_index("ix_refresh_tokens_family_id", ["family_id"])

def downgrade():
    with op.batch_alter_table("refresh_tokens") as batch:
        batch.drop_index("ix_refresh_tokens_family_id")
        batch.drop_column("family_id")
