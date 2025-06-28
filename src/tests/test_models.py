import pytest
from sqlalchemy.exc import IntegrityError
import uuid

# Assuming conftest.py is in the same directory or pytest path is configured
from src.models import Tenant, User, WBRConnection, WBRConfiguration
from src.controller import encrypt_connection_details # For testing WBRConnection

# Test Tenant Model
def test_create_tenant(db_session):
    tenant = Tenant(azure_tenant_id="azure_tid_test_001", name="Main Corp")
    db_session.add(tenant)
    db_session.commit()

    retrieved_tenant = Tenant.query.get(tenant.id)
    assert retrieved_tenant is not None
    assert retrieved_tenant.azure_tenant_id == "azure_tid_test_001"
    assert retrieved_tenant.name == "Main Corp"
    assert isinstance(retrieved_tenant.id, uuid.UUID)

def test_tenant_azure_tenant_id_unique(db_session, new_tenant):
    # First tenant created by fixture new_tenant with default azure_tenant_id
    tenant1 = new_tenant(azure_tenant_id="unique_azure_tid_1")

    with pytest.raises(IntegrityError):
        tenant2 = Tenant(azure_tenant_id="unique_azure_tid_1", name="Another Corp")
        db_session.add(tenant2)
        db_session.commit()
    db_session.rollback()

def test_tenant_relationships(db_session, new_tenant, new_user):
    tenant = new_tenant(azure_tenant_id="tenant_with_users")
    user1 = new_user(tenant=tenant, azure_user_oid="user_oid_1_for_tenant")
    user2 = new_user(tenant=tenant, azure_user_oid="user_oid_2_for_tenant", email="user2@tenant.com")

    retrieved_tenant = Tenant.query.get(tenant.id)
    assert len(retrieved_tenant.users) == 2
    assert user1 in retrieved_tenant.users
    assert user2 in retrieved_tenant.users

# Test User Model
def test_create_user(db_session, new_tenant):
    tenant = new_tenant(azure_tenant_id="tenant_for_user_test")
    user = User(
        tenant_id=tenant.id,
        azure_user_oid="azure_user_oid_test_002",
        email="user@example.com",
        name="John Doe"
    )
    db_session.add(user)
    db_session.commit()

    retrieved_user = User.query.get(user.id)
    assert retrieved_user is not None
    assert retrieved_user.tenant_id == tenant.id
    assert retrieved_user.azure_user_oid == "azure_user_oid_test_002"
    assert retrieved_user.email == "user@example.com"
    assert retrieved_user.name == "John Doe"
    assert retrieved_user.tenant == tenant
    assert isinstance(retrieved_user.id, uuid.UUID)

def test_user_azure_user_oid_unique(db_session, new_user):
    # First user created by fixture
    user1 = new_user(azure_user_oid="unique_user_oid_1")

    # Create another tenant for the second user to ensure uniqueness is on azure_user_oid itself
    # not tenant_id + azure_user_oid (though that might be a valid alternative design)
    # The current model has azure_user_oid as unique across all users.

    # tenant2 = Tenant(azure_tenant_id="another_tenant_for_user_uniqueness", name="Tenant B")
    # db_session.add(tenant2)
    # db_session.commit()

    with pytest.raises(IntegrityError):
        user2 = User(
            tenant_id=user1.tenant_id, # Can be same or different tenant, oid must be unique
            azure_user_oid="unique_user_oid_1", # Same OID
            email="anotheruser@example.com"
        )
        db_session.add(user2)
        db_session.commit()
    db_session.rollback()

# Test WBRConnection Model
def test_create_wbr_connection(db_session, new_tenant):
    tenant = new_tenant(azure_tenant_id="tenant_for_wbr_conn")
    connection_details = {"host": "localhost", "port": 5432, "user": "dbuser"}
    encrypted_details = encrypt_connection_details(connection_details) # Using function from controller

    conn = WBRConnection(
        tenant_id=tenant.id,
        connection_name="MyProdDB",
        connection_type="postgres",
        config_details_encrypted=encrypted_details
    )
    db_session.add(conn)
    db_session.commit()

    retrieved_conn = WBRConnection.query.get(conn.id)
    assert retrieved_conn is not None
    assert retrieved_conn.tenant_id == tenant.id
    assert retrieved_conn.connection_name == "MyProdDB"
    assert retrieved_conn.connection_type == "postgres"
    assert retrieved_conn.config_details_encrypted == encrypted_details
    # Decryption test would be separate, focusing on the encrypt/decrypt functions themselves

def test_wbr_connection_unique_constraint(db_session, new_tenant):
    tenant = new_tenant(azure_tenant_id="tenant_for_conn_unique")
    conn_details = encrypt_connection_details({"detail": "value"})

    conn1 = WBRConnection(
        tenant_id=tenant.id,
        connection_name="SharedConnName",
        connection_type="type1",
        config_details_encrypted=conn_details
    )
    db_session.add(conn1)
    db_session.commit()

    with pytest.raises(IntegrityError):
        conn2 = WBRConnection(
            tenant_id=tenant.id, # Same tenant
            connection_name="SharedConnName", # Same name
            connection_type="type2", # Different type, but name+tenant is the constraint
            config_details_encrypted=conn_details
        )
        db_session.add(conn2)
        db_session.commit()
    db_session.rollback()


# Test WBRConfiguration Model
def test_create_wbr_configuration(db_session, new_user):
    user_obj = new_user() # This user is associated with a tenant via new_user fixture

    config = WBRConfiguration(
        tenant_id=user_obj.tenant_id,
        user_id=user_obj.id,
        name="Weekly Sales Report Config",
        configuration_yaml="setup:\n  title: Sales WBR"
    )
    db_session.add(config)
    db_session.commit()

    retrieved_config = WBRConfiguration.query.get(config.id)
    assert retrieved_config is not None
    assert retrieved_config.tenant_id == user_obj.tenant_id
    assert retrieved_config.user_id == user_obj.id
    assert retrieved_config.name == "Weekly Sales Report Config"
    assert retrieved_config.configuration_yaml == "setup:\n  title: Sales WBR"
    assert retrieved_config.tenant == user_obj.tenant
    assert retrieved_config.user == user_obj

def test_model_repr(db_session, new_tenant, new_user):
    tenant = new_tenant(azure_tenant_id="repr_tenant_id", name="ReprTenant")
    user = new_user(tenant=tenant, azure_user_oid="repr_user_oid", email="repr@tenant.com", name="Repr User")

    conn_details = encrypt_connection_details({"repr": "conn"})
    wbr_conn = WBRConnection(tenant_id=tenant.id, connection_name="ReprConnection", connection_type="repr", config_details_encrypted=conn_details)
    db_session.add(wbr_conn)

    wbr_config = WBRConfiguration(tenant_id=tenant.id, user_id=user.id, name="ReprWBRConfig", configuration_yaml="repr: yaml")
    db_session.add(wbr_config)
    db_session.commit()

    assert "ReprTenant" in repr(tenant)
    assert "repr@tenant.com" in repr(user)
    assert "ReprConnection" in repr(wbr_conn)
    assert "ReprWBRConfig" in repr(wbr_config)
