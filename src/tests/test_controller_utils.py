import pytest
import json
from cryptography.fernet import Fernet, InvalidToken

# Assuming conftest.py sets up necessary environment vars for controller import
# or that controller utils can be imported without full app context for these specific functions.
from src.controller import encrypt_connection_details, decrypt_connection_details, connection_fernet
from src.app_config import config as app_cfg # To potentially re-init fernet with test key if needed

# Test Fernet Initialization (indirectly, by checking if connection_fernet is available)
def test_fernet_initialized():
    assert connection_fernet is not None, "Fernet object 'connection_fernet' in controller should be initialized."
    # Check if it's using the key from app_config (or a test override if conftest does that)
    # This is more of an integration check of app_config and controller init
    # For a direct check, one might re-initialize a local Fernet with config.WBR_CONNECTION_ENCRYPTION_KEY
    # and see if it matches, but that's too much detail for this test.
    # Simply ensuring it's not None implies it initialized.

def test_encrypt_decrypt_connection_details_valid():
    original_details = {
        "host": "test_host.db.internal",
        "port": 5439,
        "username": "test_user",
        "password": "TestPassword123!",
        "dbname": "testdb",
        "sslmode": "require"
    }

    encrypted_str = encrypt_connection_details(original_details)
    assert encrypted_str is not None
    assert isinstance(encrypted_str, str)
    assert encrypted_str != json.dumps(original_details) # Ensure it's not plaintext

    decrypted_details = decrypt_connection_details(encrypted_str)
    assert decrypted_details is not None
    assert isinstance(decrypted_details, dict)
    assert decrypted_details == original_details

def test_encrypt_decrypt_empty_details():
    original_details = {}
    encrypted_str = encrypt_connection_details(original_details)
    assert encrypted_str is not None

    decrypted_details = decrypt_connection_details(encrypted_str)
    assert decrypted_details == original_details

def test_encrypt_decrypt_with_various_data_types():
    original_details = {
        "string_key": "string_value",
        "int_key": 12345,
        "float_key": 123.45,
        "bool_key_true": True,
        "bool_key_false": False,
        "null_key": None,
        "list_key": [1, "two", 3.0, True, None],
        "nested_dict_key": {
            "nested_str": "abc",
            "nested_int": 789
        }
    }
    encrypted_str = encrypt_connection_details(original_details)
    assert encrypted_str is not None

    decrypted_details = decrypt_connection_details(encrypted_str)
    assert decrypted_details == original_details

def test_decrypt_invalid_token():
    invalid_encrypted_str = "this_is_not_a_valid_fernet_token"
    with pytest.raises(InvalidToken): # Fernet raises InvalidToken for malformed or incorrect key
        decrypt_connection_details(invalid_encrypted_str)

def test_decrypt_tampered_token():
    original_details = {"sensitive_data": "secret_value"}
    encrypted_str = encrypt_connection_details(original_details)

    # Simulate tampering: Fernet tokens are base64 encoded.
    # A simple tampering might be to change a character.
    # This often results in InvalidToken or other decryption errors.
    # Note: Fernet provides authenticity, so tampering should be detected.
    if len(encrypted_str) > 10:
        tampered_str = encrypted_str[:-10] + "xxxxxxxxxx" # Replace last 10 chars
        if tampered_str == encrypted_str: # ensure it actually changed
             tampered_str = encrypted_str[1:] + "A"

        with pytest.raises(InvalidToken): # Or potentially other cryptography errors
            decrypt_connection_details(tampered_str)
    else:
        pytest.skip("Encrypted string too short to reliably test tampering this way.")


# What if connection_fernet was not initialized? (e.g. bad key)
# This is harder to test directly here without manipulating the global 'connection_fernet'
# in controller.py. The controller already logs an error if Fernet fails to init.
# We can simulate by temporarily setting connection_fernet to None if possible,
# or by testing a helper function that takes fernet_instance as an arg.

# For now, the existing tests cover the main success and failure paths assuming
# connection_fernet is correctly initialized. The RuntimeError for uninitialized
# fernet is tested by the functions themselves.

def test_encrypt_runtime_error_if_fernet_none(monkeypatch):
    # Temporarily make the global connection_fernet None for this test
    monkeypatch.setattr('src.controller.connection_fernet', None)
    with pytest.raises(RuntimeError, match="Connection encryption service is not available."):
        encrypt_connection_details({"data": "test"})

def test_decrypt_runtime_error_if_fernet_none(monkeypatch):
    monkeypatch.setattr('src.controller.connection_fernet', None)
    with pytest.raises(RuntimeError, match="Connection encryption service is not available."):
        decrypt_connection_details("dummy_encrypted_string")

# Note: The WBR_CONNECTION_ENCRYPTION_KEY in app_config.py has a default value
# and the conftest.py sets an OS environ override for tests.
# This ensures 'connection_fernet' in controller.py should initialize correctly
# during the test session.
# The RuntimeError tests above simulate it failing *after* initial import,
# which is a bit artificial but tests the check within the functions.
# A more realistic test for initialization failure would be to check logs
# or app startup behavior if the key is truly invalid from the start,
# but that's more of an integration/app-level test.
