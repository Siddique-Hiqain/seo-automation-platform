from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


class CredentialConfigurationError(RuntimeError):
    pass


class CredentialDecryptionError(RuntimeError):
    pass


class CredentialCipher:
    def __init__(self, key: str):
        if not key:
            raise CredentialConfigurationError(
                "WORDPRESS_CREDENTIALS_KEY is not configured. Generate a Fernet key before connecting WordPress."
            )
        try:
            self._fernet = Fernet(key.encode("ascii"))
        except (ValueError, TypeError) as exc:
            raise CredentialConfigurationError(
                "WORDPRESS_CREDENTIALS_KEY must be a valid Fernet key."
            ) from exc

    def encrypt(self, value: str) -> str:
        return self._fernet.encrypt(value.encode("utf-8")).decode("ascii")

    def decrypt(self, value: str) -> str:
        try:
            return self._fernet.decrypt(value.encode("ascii")).decode("utf-8")
        except (InvalidToken, ValueError, UnicodeError) as exc:
            raise CredentialDecryptionError("Stored WordPress credentials could not be decrypted.") from exc


def get_credential_cipher() -> CredentialCipher:
    return CredentialCipher(settings.wordpress_credentials_key)
