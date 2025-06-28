import pytest
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import sessionmaker

# Temporarily add src to sys.path for imports if tests are run directly
# For a real project, better structure or tools like tox/nox would handle this
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


@pytest.fixture(scope='session')
def app():
    """Create and configure a new app instance for each test session."""
    flask_app = Flask(__name__,
                      static_url_path='',
                      static_folder='../web/static', # Relative to tests directory
                      template_folder='../web/templates') # Relative to tests directory

    flask_app.config["SECRET_KEY"] = "test_secret_key"
    flask_app.config["SESSION_TYPE"] = "filesystem" # Or 'memory' if available and simple
    flask_app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:" # Use in-memory SQLite for tests
    flask_app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    flask_app.config["TESTING"] = True

    # To silence the warning about WBR_CONNECTION_ENCRYPTION_KEY if controller is imported implicitly
    os.environ['WBR_CONNECTION_ENCRYPTION_KEY'] = 'test_fernet_key_123456789012345='
    # To silence warnings about Azure creds if controller is imported
    os.environ['AZURE_CLIENT_ID'] = 'test_client_id'
    os.environ['AZURE_CLIENT_SECRET'] = 'test_client_secret'


    # Initialize extensions if they are part of the app factory pattern
    # For now, assuming direct initialization in controller.py or here if needed
    # from flask_session import Session
    # Session(flask_app)

    # db_instance = SQLAlchemy(flask_app) # This would be the global db from controller

    # To avoid circular imports or re-initialization issues with db from controller,
    # we might need a more sophisticated app factory pattern.
    # For now, let's assume we can get the db instance from the main app or re-init here.

    # This is tricky. If controller.py initializes db, importing it will try to use its config.
    # We need to ensure our test config is used.
    # One way:
    from src.controller import db as main_db, app as main_app

    with flask_app.app_context():
        main_db.init_app(flask_app) # Re-init with test app's config
        main_db.create_all()

    yield flask_app

    with flask_app.app_context():
        main_db.drop_all()


@pytest.fixture()
def client(app):
    """A test client for the app."""
    return app.test_client()


@pytest.fixture()
def db_session(app):
    """A database session for interacting with the test database."""
    from src.controller import db as main_db # Get the SQLAlchemy instance from the app

    # Using the app's db.session directly is often fine for tests
    # if the app context is managed correctly.
    with app.app_context():
        yield main_db.session
        main_db.session.remove() # Clean up session
        # No need to drop tables here, as the 'app' fixture handles session-wide drop.
        # For per-test isolation if needed, you might clear data from tables or use transactions.
        # For simplicity, relying on in-memory DB being fresh for each test function if app fixture is function-scoped.
        # If app fixture is session-scoped, then data needs careful handling per test.
        # Let's assume we want fresh tables for each test for now, needs app fixture to be function scoped
        # or manual cleanup here.
        # For now, with session-scoped app fixture, we'll just ensure session is clean.
        # Data clearing should be handled by individual tests if they modify data and expect isolation.
        # A common pattern is to use a transaction that's rolled back.

        # Re-evaluating: for in-memory SQLite with session-scoped app fixture,
        # tables persist. We need to clear data or recreate tables per test, or use transactions.
        # Let's try clearing all data from tables for each test using this db_session fixture.
        for table in reversed(main_db.metadata.sorted_tables):
            main_db.session.execute(table.delete())
        main_db.session.commit()

# If app fixture becomes function-scoped for true test isolation:
# @pytest.fixture(scope='function')
# def app(): ...
# then db_session doesn't need to clear tables, as drop_all/create_all handles it.
# For now, keeping app session-scoped and db_session clears data.

# For models:
from src import models as app_models

@pytest.fixture
def new_tenant(db_session):
    def _new_tenant(azure_tenant_id="test_azure_tid_123", name="Test Tenant"):
        tenant = app_models.Tenant(azure_tenant_id=azure_tenant_id, name=name)
        db_session.add(tenant)
        db_session.commit()
        return tenant
    return _new_tenant

@pytest.fixture
def new_user(db_session, new_tenant):
    def _new_user(tenant=None, azure_user_oid="test_azure_oid_abc", email="test@example.com", name="Test User"):
        if tenant is None:
            tenant = new_tenant()
        user = app_models.User(
            tenant_id=tenant.id,
            azure_user_oid=azure_user_oid,
            email=email,
            name=name
        )
        db_session.add(user)
        db_session.commit()
        return user
    return _new_user
