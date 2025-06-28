import pytest
from unittest.mock import patch, MagicMock
from flask import session, url_for
import uuid

from src.models import Tenant, User
from src.controller import app as flask_app # Import the app from controller

# Use the client fixture from conftest.py
# Use the db_session fixture from conftest.py

@pytest.fixture(autouse=True)
def mock_auth_get_user(monkeypatch):
    """Auto-mock auth.get_user() to return None by default for most tests,
       as @login_required relies on session, not this directly for protection logic.
       Specific tests can override this mock if they need to simulate MSAL's user object.
    """
    mock_user = MagicMock()
    mock_user.return_value = None # Default to no user from MSAL's perspective
    monkeypatch.setattr('src.controller.auth.get_user', mock_user)


def test_auth_redirect_new_tenant_and_new_user(client, db_session):
    mock_claims = {
        "oid": "new_azure_user_oid_001",
        "tid": "new_azure_tenant_id_001",
        "preferred_username": "newuser@newtenant.com",
        "name": "New User One"
    }
    # Patch auth.complete_log_in to simulate successful Azure AD login
    # and auth.get_id_token_claims to return our mock claims
    with patch('src.controller.auth.complete_log_in', return_value={"id_token_claims": mock_claims}) as mock_complete_login, \
         patch('src.controller.auth.get_id_token_claims', return_value=mock_claims) as mock_get_claims:

        response = client.get(url_for('auth_redirect')) # Assuming REDIRECT_PATH is default /auth/redirect

        assert response.status_code == 302 # Should redirect after login
        assert response.location == url_for('index', _external=False) # Redirects to index

        # Verify session variables
        with client.session_transaction() as sess:
            assert sess.get("user_id") is not None
            assert sess.get("tenant_id") is not None
            assert sess.get("user_name") == "New User One"
            user_id_in_session = sess["user_id"]
            tenant_id_in_session = sess["tenant_id"]

        # Verify database entries
        tenant = Tenant.query.filter_by(azure_tenant_id="new_azure_tenant_id_001").first()
        assert tenant is not None
        assert str(tenant.id) == tenant_id_in_session
        assert tenant.name == "Tenant new_azur" # Default naming convention

        user = User.query.filter_by(azure_user_oid="new_azure_user_oid_001").first()
        assert user is not None
        assert str(user.id) == user_id_in_session
        assert user.tenant_id == tenant.id
        assert user.email == "newuser@newtenant.com"
        assert user.name == "New User One"

        mock_complete_login.assert_called_once()
        mock_get_claims.assert_called_once()


def test_auth_redirect_existing_tenant_new_user(client, db_session, new_tenant):
    existing_tenant_azure_id = "existing_tid_for_new_user"
    tenant = new_tenant(azure_tenant_id=existing_tenant_azure_id, name="Existing Tenant Corp")

    initial_user_count = User.query.filter_by(tenant_id=tenant.id).count()

    mock_claims = {
        "oid": "new_user_for_existing_tenant_oid_002",
        "tid": existing_tenant_azure_id, # Existing tenant
        "preferred_username": "anotheruser@existingtenant.com",
        "name": "Another User"
    }
    with patch('src.controller.auth.complete_log_in', return_value={"id_token_claims": mock_claims}), \
         patch('src.controller.auth.get_id_token_claims', return_value=mock_claims):

        response = client.get(url_for('auth_redirect'))

        assert response.status_code == 302
        assert response.location == url_for('index')

        with client.session_transaction() as sess:
            assert sess.get("tenant_id") == str(tenant.id) # Should match existing tenant
            assert sess.get("user_name") == "Another User"
            user_id_in_session = sess["user_id"]

        # Verify new user in DB, associated with existing tenant
        new_user_in_db = User.query.filter_by(azure_user_oid="new_user_for_existing_tenant_oid_002").first()
        assert new_user_in_db is not None
        assert str(new_user_in_db.id) == user_id_in_session
        assert new_user_in_db.tenant_id == tenant.id
        assert new_user_in_db.email == "anotheruser@existingtenant.com"

        assert User.query.filter_by(tenant_id=tenant.id).count() == initial_user_count + 1


def test_auth_redirect_existing_tenant_and_existing_user_update_name(client, db_session, new_tenant, new_user):
    azure_tenant_id_for_update = "tid_for_user_update"
    azure_user_oid_for_update = "oid_for_user_update"

    tenant = new_tenant(azure_tenant_id=azure_tenant_id_for_update, name="Update Test Tenant")
    user = new_user(
        tenant=tenant,
        azure_user_oid=azure_user_oid_for_update,
        email="original.email@update.com",
        name="Original Name"
    )
    original_user_id = user.id
    original_user_email = user.email

    mock_claims_updated = {
        "oid": azure_user_oid_for_update, # Same user OID
        "tid": azure_tenant_id_for_update, # Same tenant TID
        "preferred_username": "original.email@update.com", # Email might or might not change, here it's same
        "name": "Updated Name From Azure" # Name updated
    }

    with patch('src.controller.auth.complete_log_in', return_value={"id_token_claims": mock_claims_updated}), \
         patch('src.controller.auth.get_id_token_claims', return_value=mock_claims_updated):

        response = client.get(url_for('auth_redirect'))
        assert response.status_code == 302

        with client.session_transaction() as sess:
            assert sess.get("user_id") == str(original_user_id)
            assert sess.get("tenant_id") == str(tenant.id)
            assert sess.get("user_name") == "Updated Name From Azure"

        updated_user_in_db = User.query.get(original_user_id)
        assert updated_user_in_db is not None
        assert updated_user_in_db.name == "Updated Name From Azure"
        assert updated_user_in_db.email == original_user_email # Email didn't change in this claim set

def test_auth_redirect_login_error_from_msal(client):
    error_payload = {
        "error": "access_denied",
        "error_description": "User cancelled the login."
    }
    with patch('src.controller.auth.complete_log_in', return_value=error_payload):
        response = client.get(url_for('auth_redirect'))
        assert response.status_code == 200 # Not a redirect
        assert b"Login Error: User cancelled the login." in response.data

def test_auth_redirect_missing_claims(client):
    # Missing OID
    mock_claims_no_oid = {
        "tid": "some_tid",
        "preferred_username": "user@tenant.com",
        "name": "User"
    }
    with patch('src.controller.auth.complete_log_in', return_value={"id_token_claims": mock_claims_no_oid}), \
         patch('src.controller.auth.get_id_token_claims', return_value=mock_claims_no_oid):
        response = client.get(url_for('auth_redirect'))
        assert response.status_code == 400
        assert b"Missing OID or TID in token claims." in response.data

    # Missing TID
    mock_claims_no_tid = {
        "oid": "some_oid",
        "preferred_username": "user@tenant.com",
        "name": "User"
    }
    with patch('src.controller.auth.complete_log_in', return_value={"id_token_claims": mock_claims_no_tid}), \
         patch('src.controller.auth.get_id_token_claims', return_value=mock_claims_no_tid):
        response = client.get(url_for('auth_redirect'))
        assert response.status_code == 400
        assert b"Missing OID or TID in token claims." in response.data


def test_login_route_redirects_to_msal_template(client):
    # Mock auth.log_in from MSAL identity library
    # It's expected to return a dictionary of parameters for render_template
    mock_login_params = {
        "login_uri": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?...",
        "data": {
            "client_id": "test_client_id",
            "response_type": "code",
            # ... other MSAL parameters
        }
    }
    with patch('src.controller.auth.log_in', return_value=mock_login_params) as mock_msal_login:
        response = client.get(url_for('login'))
        assert response.status_code == 200
        # Check that the template 'auth_login.html' is rendered
        # (difficult to check template name directly without more complex setup)
        # Instead, check if some content specific to auth_login.html is present,
        # like "Redirecting to Microsoft Login..." if auth_uri_form_data is passed.
        assert b"Redirecting to Microsoft Login..." in response.data
        mock_msal_login.assert_called_once()
        # Verify redirect_uri passed to log_in contains the correct path
        args, kwargs = mock_msal_login.call_args
        assert kwargs.get('redirect_uri').endswith(url_for('auth_redirect', _external=False))


def test_logout_route_redirects(client):
    # Mock auth.log_out from MSAL identity library
    ms_logout_url = "https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=http%3A%2F%2Flocalhost%2F"
    with patch('src.controller.auth.log_out', return_value=ms_logout_url) as mock_msal_logout:
        # Simulate a logged-in user by setting session variables
        with client.session_transaction() as sess:
            sess['user_id'] = str(uuid.uuid4())
            sess['tenant_id'] = str(uuid.uuid4())
            sess['user_name'] = 'Test User for Logout'

        response = client.get(url_for('logout'))
        assert response.status_code == 302 # Should be a redirect
        assert response.location == ms_logout_url
        mock_msal_logout.assert_called_once()
        # Also check that session is cleared (partially, MSAL handles its own session parts)
        # Our app specific session keys should be gone if logout clears them.
        # The current controller.py logout doesn't explicitly clear session, it relies on MSAL.
        # This might be an area for improvement if local session data needs explicit clearing.
        # For now, just test the redirect.


# Test the @login_required decorator
def test_login_required_decorator_no_session(client):
    # Access a route protected by @login_required (e.g., index)
    response = client.get(url_for('index'))
    assert response.status_code == 302 # Redirect to login
    assert url_for('login') in response.location # Check it redirects to login
    assert 'next=%2F' in response.location or 'next=http%3A%2F%2Flocalhost%2F' in response.location # Check for next param

def test_login_required_decorator_with_session(client):
    with client.session_transaction() as sess:
        sess['user_id'] = str(uuid.uuid4())
        sess['tenant_id'] = str(uuid.uuid4())
        sess['user_name'] = 'Logged In User'

    # At this point, auth.get_user() is mocked to return None by default via autouse fixture.
    # The @login_required decorator checks session variables, so this should pass.
    response = client.get(url_for('index'))
    assert response.status_code == 200 # Should access the page
    assert b"Welcome, Logged In User!" in response.data # Assuming wbr.html shows this

# Example of a test that might need auth.get_user() to return something
# def test_index_page_with_msal_user_info(client, monkeypatch):
#     mock_msal_user_claims = {"name": "MSAL User", "preferred_username": "msal@example.com"}
#     monkeypatch.setattr('src.controller.auth.get_user', lambda: mock_msal_user_claims)

#     with client.session_transaction() as sess:
#         sess['user_id'] = str(uuid.uuid4()) # Still need our session for @login_required
#         sess['tenant_id'] = str(uuid.uuid4())
#         # user_name in session might take precedence depending on template logic
#         sess['user_name'] = 'Session User'

#     response = client.get(url_for('index'))
#     assert response.status_code == 200
#     # Depending on how wbr.html template prioritizes, it might show 'Session User' or 'MSAL User'
#     # The current template uses 'user_name_from_session'
#     assert b"Welcome, Session User!" in response.data
#     # If template logic changed to use auth.get_user().get('name'), this would be different.
#     # assert b"Welcome, MSAL User!" in response.data
#     # This highlights that template logic and session management are tightly coupled.
#     # For now, the @login_required is session-based.
#     # The display name in wbr.html is also session-based ("user_name_from_session").
#     # So, overriding auth.get_user() for the index display might not change output unless template changes.
#     pass
