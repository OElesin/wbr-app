import os
from dotenv import load_dotenv

load_dotenv() # Load environment variables from .env file if it exists

class AppConfig:
    # Azure AD Configuration
    CLIENT_ID = os.getenv("AZURE_CLIENT_ID")
    CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET")
    AUTHORITY = os.getenv("AZURE_AUTHORITY", "https://login.microsoftonline.com/common") # Default to multi-tenant

    # Application Details
    REDIRECT_PATH = os.getenv("AZURE_REDIRECT_PATH", "/auth/redirect") # The path component of the redirect URI
    SCOPES = os.getenv("AZURE_SCOPES", "User.ReadBasic.All openid email profile").split() # Default scopes
    SESSION_TYPE = os.getenv("SESSION_TYPE", "filesystem") # Flask-Session type
    SESSION_FILE_DIR = os.getenv("SESSION_FILE_DIR", "./.flask_session/") # For filesystem sessions
    SESSION_PERMANENT = os.getenv("SESSION_PERMANENT", "False").lower() == "true"

    # Flask App Secret Key (IMPORTANT: Change this in production!)
    # Generate a good one using: import secrets; secrets.token_hex(16)
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "a_very_default_and_insecure_secret_key")

    # Application's own database (PostgreSQL recommended)
    # Example: postgresql://wbruser:wbrpassword@localhost:5432/wbr_db
    APP_DATABASE_URL = os.getenv("APP_DATABASE_URL", "sqlite:///./wbr_app_dev.db") # Default to SQLite for easy local dev

    # WBR Connection Encryption Key (IMPORTANT: Change this and keep it secret)
    # Generate a good one using: from cryptography.fernet import Fernet; Fernet.generate_key().decode()
    WBR_CONNECTION_ENCRYPTION_KEY = os.getenv("WBR_CONNECTION_ENCRYPTION_KEY", "default_encryption_key_32_bytes_") # Must be 32 url-safe base64-encoded bytes

    # Sanity checks for critical configurations
    if not CLIENT_ID:
        raise ValueError("AZURE_CLIENT_ID is not set. Please set it in your environment or .env file.")
    if not CLIENT_SECRET:
        raise ValueError("AZURE_CLIENT_SECRET is not set. Please set it in your environment or .env file.")
    if not FLASK_SECRET_KEY or FLASK_SECRET_KEY == "a_very_default_and_insecure_secret_key":
        print("WARNING: FLASK_SECRET_KEY is not set or is using a default insecure value. Please set a strong secret key in production.")
    if not WBR_CONNECTION_ENCRYPTION_KEY or WBR_CONNECTION_ENCRYPTION_KEY == "default_encryption_key_32_bytes_":
        print("WARNING: WBR_CONNECTION_ENCRYPTION_KEY is not set or is using a default insecure value. Please set a strong encryption key for WBR connections.")


# Instantiate the config
config = AppConfig()

if __name__ == "__main__":
    # Helper to print out the loaded configuration for verification
    print("Loaded Application Configuration:")
    for key, value in AppConfig.__dict__.items():
        if not key.startswith("__") and not callable(value):
            print(f"{key}: {value}")

    # Test encryption key length if it's the default (Fernet expects 32 url-safe base64-encoded bytes)
    from cryptography.fernet import Fernet
    try:
        Fernet(config.WBR_CONNECTION_ENCRYPTION_KEY.encode())
        print("WBR_CONNECTION_ENCRYPTION_KEY is valid for Fernet.")
    except Exception as e:
        print(f"ERROR: WBR_CONNECTION_ENCRYPTION_KEY is NOT valid for Fernet: {e}")
        print("Please generate a valid key using: from cryptography.fernet import Fernet; Fernet.generate_key().decode()")

    print("\nEnsure AZURE_CLIENT_ID and AZURE_CLIENT_SECRET are correctly set for your Azure AD App Registration.")
    print(f"Redirect URI in Azure AD should be like: <your_app_base_url>{config.REDIRECT_PATH}")
