import datetime
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship, sessionmaker, declarative_base
from sqlalchemy.dialects.postgresql import UUID
import uuid as py_uuid

Base = declarative_base()

class Tenant(Base):
    __tablename__ = 'tenants'
    id = Column(UUID(as_uuid=True), primary_key=True, default=py_uuid.uuid4)
    azure_tenant_id = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=True) # Optional: Can be synced from Azure AD or set by user
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    users = relationship("User", back_populates="tenant")
    wbr_connections = relationship("WBRConnection", back_populates="tenant", cascade="all, delete-orphan")
    wbr_configurations = relationship("WBRConfiguration", back_populates="tenant", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Tenant(id='{self.id}', azure_tenant_id='{self.azure_tenant_id}', name='{self.name}')>"

class User(Base):
    __tablename__ = 'users'
    id = Column(UUID(as_uuid=True), primary_key=True, default=py_uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id'), nullable=False, index=True)
    azure_user_oid = Column(String(255), unique=True, nullable=False, index=True) # OID from Azure AD token
    email = Column(String(255), nullable=True, index=True) # UPN or email claim
    name = Column(String(255), nullable=True) # Display name claim
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    tenant = relationship("Tenant", back_populates="users")
    wbr_configurations = relationship("WBRConfiguration", back_populates="user")

    def __repr__(self):
        return f"<User(id='{self.id}', azure_user_oid='{self.azure_user_oid}', email='{self.email}')>"

class WBRConnection(Base):
    __tablename__ = 'wbr_connections'
    id = Column(UUID(as_uuid=True), primary_key=True, default=py_uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id'), nullable=False, index=True)
    connection_name = Column(String(255), nullable=False)
    connection_type = Column(String(50), nullable=False) # 'postgres', 'snowflake', etc.
    config_details_encrypted = Column(Text, nullable=False) # Encrypted JSON string of connection params
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    tenant = relationship("Tenant", back_populates="wbr_connections")

    __table_args__ = (
        UniqueConstraint('tenant_id', 'connection_name', name='uq_tenant_connection_name'),
    )

    def __repr__(self):
        return f"<WBRConnection(id='{self.id}', tenant_id='{self.tenant_id}', name='{self.connection_name}')>"


class WBRConfiguration(Base):
    __tablename__ = 'wbr_configurations'
    id = Column(UUID(as_uuid=True), primary_key=True, default=py_uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id'), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, index=True) # User who created/owns this config
    name = Column(String(255), nullable=False) # e.g., "Weekly Sales Review"
    configuration_yaml = Column(Text, nullable=False) # The actual YAML content
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    tenant = relationship("Tenant", back_populates="wbr_configurations")
    user = relationship("User", back_populates="wbr_configurations")

    def __repr__(self):
        return f"<WBRConfiguration(id='{self.id}', tenant_id='{self.tenant_id}', name='{self.name}')>"


# Example usage for setting up the engine (adjust as needed, typically in your app setup)
# DATABASE_URL = os.getenv("APP_DATABASE_URL", "postgresql://user:password@host:port/database")
# engine = create_engine(DATABASE_URL)
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# def init_db():
#     Base.metadata.create_all(bind=engine)
from sqlalchemy import UniqueConstraint
