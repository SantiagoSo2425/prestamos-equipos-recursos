"""Esquema inicial: usuarios, categorías, recursos, préstamos y movimientos.

Revision ID: 0001
Revises:
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

user_role = pg.ENUM("SOLICITANTE", "RESPONSABLE", "COORDINACION", name="user_role", create_type=False)
requester_type = pg.ENUM("ESTUDIANTE", "DOCENTE", name="requester_type", create_type=False)
resource_status = pg.ENUM("ACTIVO", "EN_REVISION", "DADO_DE_BAJA", name="resource_status", create_type=False)
loan_status = pg.ENUM(
    "PENDIENTE", "APROBADA", "RECHAZADA", "CANCELADA", "ACTIVA", "DEVUELTA",
    name="loan_status", create_type=False,
)
item_condition = pg.ENUM("BUENO", "CON_DANO", name="item_condition", create_type=False)


def upgrade() -> None:
    # Necesaria para combinar igualdad (resource_id) y rangos en la restricción EXCLUDE.
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    for e in (user_role, requester_type, resource_status, loan_status, item_condition):
        e.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String(50), nullable=False, unique=True),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("institutional_id", sa.String(20), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("requester_type", requester_type, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("(role = 'SOLICITANTE') = (requester_type IS NOT NULL)", name="users_requester_type_ck"),
        sa.CheckConstraint("username ~ '^[a-z0-9._]{3,50}$'", name="users_username_ck"),
    )

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(50), nullable=False, unique=True),
        sa.Column("max_loan_hours", sa.Integer, nullable=False),
        sa.CheckConstraint("max_loan_hours > 0", name="categories_max_hours_ck"),
    )

    op.create_table(
        "resources",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("code", sa.String(20), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category_id", sa.Integer, sa.ForeignKey("categories.id"), nullable=False),
        sa.Column("status", resource_status, nullable=False, server_default="ACTIVO"),
        sa.Column("teacher_only", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(r"code ~ '^[A-Z]{3,5}-\d{3,4}$'", name="resources_code_ck"),
        sa.CheckConstraint("description IS NULL OR char_length(description) <= 1000", name="resources_description_ck"),
    )
    op.create_index("ix_resources_category_id", "resources", ["category_id"])
    op.create_index("ix_resources_status", "resources", ["status"])

    op.create_table(
        "loans",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("resource_id", sa.Integer, sa.ForeignKey("resources.id"), nullable=False),
        sa.Column("requester_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("purpose", sa.String(500), nullable=False),
        sa.Column("status", loan_status, nullable=False, server_default="PENDIENTE"),
        sa.Column("rejection_reason", sa.String(500), nullable=True),
        sa.Column("approved_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("checkout_condition", sa.String(500), nullable=True),
        sa.Column("received_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("return_condition", item_condition, nullable=True),
        sa.Column("return_notes", sa.String(1000), nullable=True),
        sa.Column("is_late", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("end_at > start_at", name="loans_period_ck"),
        sa.CheckConstraint("char_length(purpose) >= 10", name="loans_purpose_ck"),
        sa.CheckConstraint("status <> 'RECHAZADA' OR rejection_reason IS NOT NULL", name="loans_rejection_ck"),
        sa.CheckConstraint("status NOT IN ('ACTIVA','DEVUELTA') OR delivered_at IS NOT NULL", name="loans_delivered_ck"),
        sa.CheckConstraint(
            "status <> 'DEVUELTA' OR (returned_at IS NOT NULL AND return_condition IS NOT NULL)",
            name="loans_returned_ck",
        ),
    )
    op.execute(
        "ALTER TABLE loans ADD CONSTRAINT loans_no_overlap "
        "EXCLUDE USING gist (resource_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&) "
        "WHERE (status IN ('APROBADA','ACTIVA'))"
    )
    op.create_index("ix_loans_resource_status", "loans", ["resource_id", "status"])
    op.create_index("ix_loans_requester_status", "loans", ["requester_id", "status"])
    op.create_index("ix_loans_status_end", "loans", ["status", "end_at"])
    op.create_index("ix_loans_created_at", "loans", ["created_at"])

    op.create_table(
        "loan_movements",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("loan_id", sa.Integer, sa.ForeignKey("loans.id"), nullable=False),
        sa.Column("actor_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("from_status", loan_status, nullable=True),
        sa.Column("to_status", loan_status, nullable=False),
        sa.Column("note", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_loan_movements_loan_created", "loan_movements", ["loan_id", "created_at"])


def downgrade() -> None:
    op.drop_table("loan_movements")
    op.drop_table("loans")
    op.drop_table("resources")
    op.drop_table("categories")
    op.drop_table("users")
    for name in ("item_condition", "loan_status", "resource_status", "requester_type", "user_role"):
        op.execute(f"DROP TYPE IF EXISTS {name}")
