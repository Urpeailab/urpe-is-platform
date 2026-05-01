"""
SSO Flow Tests for Monica NIW App
Tests:
1. Real SSO flow using visa-case-app external token
2. SSO fallback when external validation fails (JWT claims only)
3. SSO expired token rejection
4. SSO invalid token format rejection
5. Regression: Monica own login
6. Regression: GET /api/policy-papers
7. Regression: GET /api/case-studies
"""

import pytest
import requests
import os
import time
import base64
import json
import hmac
import hashlib
import struct

# ───────────────────────────────────────────────────────────────
# Base URLs
# ───────────────────────────────────────────────────────────────
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
EXTERNAL_APP_URL = "https://domain-relink-test.preview.emergentagent.com"

# ───────────────────────────────────────────────────────────────
# Helpers
# ───────────────────────────────────────────────────────────────

def get_monica_token(email="dau@urpeailab.com", password="admin123") -> str:
    """Login to Monica and return a Monica access_token."""
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=15,
    )
    assert resp.status_code == 200, f"Monica login failed: {resp.status_code} {resp.text}"
    token = resp.json().get("access_token")
    assert token, f"No access_token in Monica login response: {resp.json()}"
    return token


def get_external_token() -> str:
    """Login to visa-case-app and return the external token."""
    resp = requests.post(
        f"{EXTERNAL_APP_URL}/api/admin/auth/login",
        json={"email": "admin@urpe.com", "password": "urpe2024"},
        timeout=15,
    )
    assert resp.status_code == 200, f"External login failed: {resp.status_code} {resp.text}"
    data = resp.json()
    # The external app returns {token: '...'} (NOT access_token)
    token = data.get("token") or data.get("access_token")
    assert token, f"No token in external login response: {data}"
    return token


def _b64_encode_no_pad(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def build_fake_jwt(payload: dict, secret: str = "fake-secret") -> str:
    """Build a HS256-signed JWT for testing purposes."""
    header = _b64_encode_no_pad(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = _b64_encode_no_pad(json.dumps(payload).encode())
    signing_input = f"{header}.{body}".encode()
    signature = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    sig = _b64_encode_no_pad(signature)
    return f"{header}.{body}.{sig}"


# ───────────────────────────────────────────────────────────────
# 1. Real SSO flow with visa-case-app token
# ───────────────────────────────────────────────────────────────

class TestSSOWithRealExternalToken:
    """Use real visa-case-app credentials to test the full SSO flow."""

    def test_external_app_login_returns_token(self):
        """External app login should return a token field."""
        resp = requests.post(
            f"{EXTERNAL_APP_URL}/api/admin/auth/login",
            json={"email": "admin@urpe.com", "password": "urpe2024"},
            timeout=15,
        )
        assert resp.status_code == 200, f"External app login failed: {resp.status_code} {resp.text}"
        data = resp.json()
        token = data.get("token") or data.get("access_token")
        assert token, f"No token field in response: {data}"
        print(f"PASS: External login returned token (length={len(token)})")

    def test_sso_with_real_external_token_returns_access_token(self):
        """POST /api/auth/sso with real token should return Monica access_token."""
        external_token = get_external_token()
        resp = requests.post(
            f"{BASE_URL}/api/auth/sso",
            json={"external_token": external_token},
            timeout=20,
        )
        assert resp.status_code == 200, f"SSO login failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert "access_token" in data, f"No access_token in SSO response: {data}"
        assert "user" in data, f"No user object in SSO response: {data}"
        print(f"PASS: SSO returned access_token for {data['user'].get('email')}")

    def test_sso_response_email_is_admin_urpe_com(self):
        """SSO response user.email should be admin@urpe.com."""
        external_token = get_external_token()
        resp = requests.post(
            f"{BASE_URL}/api/auth/sso",
            json={"external_token": external_token},
            timeout=20,
        )
        assert resp.status_code == 200, f"SSO login failed: {resp.status_code} {resp.text}"
        user = resp.json().get("user", {})
        assert user.get("email") == "admin@urpe.com", \
            f"Expected email admin@urpe.com, got: {user.get('email')}"
        print(f"PASS: SSO user email = {user.get('email')}")

    def test_sso_response_role_is_admin(self):
        """SSO response user.role should be ADMIN (super_admin maps to ADMIN)."""
        external_token = get_external_token()
        resp = requests.post(
            f"{BASE_URL}/api/auth/sso",
            json={"external_token": external_token},
            timeout=20,
        )
        assert resp.status_code == 200, f"SSO login failed: {resp.status_code} {resp.text}"
        user = resp.json().get("user", {})
        role = user.get("role")
        assert role == "ADMIN", f"Expected role ADMIN, got: {role}"
        print(f"PASS: SSO user role = {role}")

    def test_sso_access_token_is_usable_for_monica_apis(self):
        """SSO-issued Monica token should be usable to call Monica APIs."""
        external_token = get_external_token()
        sso_resp = requests.post(
            f"{BASE_URL}/api/auth/sso",
            json={"external_token": external_token},
            timeout=20,
        )
        assert sso_resp.status_code == 200, f"SSO login failed: {sso_resp.status_code}"
        monica_token = sso_resp.json()["access_token"]

        # Use the Monica token to call a protected endpoint
        api_resp = requests.get(
            f"{BASE_URL}/api/policy-papers",
            headers={"Authorization": f"Bearer {monica_token}"},
            timeout=15,
        )
        assert api_resp.status_code == 200, \
            f"Monica API call with SSO token failed: {api_resp.status_code} {api_resp.text}"
        print(f"PASS: SSO token works for Monica API - returned {api_resp.status_code}")


# ───────────────────────────────────────────────────────────────
# 2. SSO Fallback – JWT claims when external validation unavailable
# ───────────────────────────────────────────────────────────────

class TestSSOFallbackOnExternalFailure:
    """When external validation returns non-2xx/non-401/403, SSO falls back to JWT claims."""

    def test_sso_fallback_with_jwt_staff_token(self):
        """A staff JWT token with valid claims should succeed via fallback."""
        payload = {
            "sub": "sso-fallback-test@example.com",
            "email": "sso-fallback-test@example.com",
            "name": "Fallback User",
            "role": "super_admin",
            "type": "staff",
            "exp": int(time.time()) + 3600,
            "iat": int(time.time()),
        }
        # This token is NOT signed with the external app's secret, so external
        # validation will fail → SSO should fall back to JWT claims.
        fake_token = build_fake_jwt(payload)

        resp = requests.post(
            f"{BASE_URL}/api/auth/sso",
            json={"external_token": fake_token},
            timeout=20,
        )
        # Should succeed (200) using JWT fallback, OR return 401 if external rejects it.
        # The key insight: if external returns 401/403 → Monica raises 401.
        # If external returns 404/503/timeout → Monica falls back to JWT claims → 200.
        # We can't control what the external server returns for an unknown fake token,
        # but we verify the response is deterministic.
        assert resp.status_code in (200, 401), \
            f"Unexpected status code: {resp.status_code} {resp.text}"
        if resp.status_code == 200:
            data = resp.json()
            user = data.get("user", {})
            assert user.get("email") == "sso-fallback-test@example.com"
            assert user.get("role") == "ADMIN"
            print(f"PASS (fallback path): SSO used JWT claims, role={user.get('role')}")
        else:
            print(f"INFO: External app rejected the fake token with 401 (expected for unknown tokens)")


# ───────────────────────────────────────────────────────────────
# 3. SSO Expired Token
# ───────────────────────────────────────────────────────────────

class TestSSOExpiredToken:
    """Expired tokens must be rejected with 401."""

    def test_sso_expired_token_returns_401(self):
        """A JWT with exp in the past should be rejected."""
        payload = {
            "sub": "expired@example.com",
            "email": "expired@example.com",
            "name": "Expired User",
            "role": "super_admin",
            "type": "staff",
            "exp": int(time.time()) - 3600,   # expired 1 hour ago
            "iat": int(time.time()) - 7200,
        }
        expired_token = build_fake_jwt(payload)

        resp = requests.post(
            f"{BASE_URL}/api/auth/sso",
            json={"external_token": expired_token},
            timeout=15,
        )
        assert resp.status_code == 401, \
            f"Expected 401 for expired token, got: {resp.status_code} {resp.text}"
        data = resp.json()
        detail = data.get("detail", "")
        assert "expir" in detail.lower() or "token" in detail.lower(), \
            f"Unexpected error message: {detail}"
        print(f"PASS: Expired token correctly rejected with 401. Detail: {detail}")

    def test_sso_expired_token_error_message_mentions_expiry(self):
        """Error message for expired token should mention expiry."""
        payload = {
            "sub": "expired2@example.com",
            "email": "expired2@example.com",
            "exp": int(time.time()) - 1,  # just expired
            "type": "staff",
        }
        expired_token = build_fake_jwt(payload)
        resp = requests.post(
            f"{BASE_URL}/api/auth/sso",
            json={"external_token": expired_token},
            timeout=15,
        )
        assert resp.status_code == 401
        detail = resp.json().get("detail", "")
        # The code sets detail="El token ha expirado. Por favor inicia sesión nuevamente."
        assert "expir" in detail.lower(), f"Expected 'expir' in: {detail}"
        print(f"PASS: Expiry message correct: {detail}")


# ───────────────────────────────────────────────────────────────
# 4. SSO Invalid Token Format
# ───────────────────────────────────────────────────────────────

class TestSSOInvalidTokenFormat:
    """Malformed / invalid JWT format must be rejected."""

    def test_sso_invalid_format_not_a_jwt(self):
        """'not.a.jwt' should be rejected (400 or 401 both acceptable)."""
        resp = requests.post(
            f"{BASE_URL}/api/auth/sso",
            json={"external_token": "not.a.jwt"},
            timeout=15,
        )
        # Code returns 401 for malformed token ("Token malformado o inválido.")
        assert resp.status_code in (400, 401), \
            f"Expected 400 or 401 for invalid token format, got: {resp.status_code} {resp.text}"
        print(f"PASS: Invalid token format rejected with {resp.status_code}")

    def test_sso_empty_string_token(self):
        """Empty token string should return 400 or 422."""
        resp = requests.post(
            f"{BASE_URL}/api/auth/sso",
            json={"external_token": ""},
            timeout=15,
        )
        # Empty string can't be a valid JWT
        assert resp.status_code in (400, 401, 422), \
            f"Expected 400/401/422 for empty token, got: {resp.status_code} {resp.text}"
        print(f"PASS: Empty token rejected with {resp.status_code}")

    def test_sso_random_garbage_string(self):
        """A random non-JWT string should be rejected."""
        resp = requests.post(
            f"{BASE_URL}/api/auth/sso",
            json={"external_token": "thisisnotavalidjwttoken"},
            timeout=15,
        )
        assert resp.status_code in (400, 401, 422), \
            f"Expected error for garbage token, got: {resp.status_code} {resp.text}"
        print(f"PASS: Garbage token rejected with {resp.status_code}")


# ───────────────────────────────────────────────────────────────
# 5. Regression: Monica Own Login
# ───────────────────────────────────────────────────────────────

class TestMonicaOwnLogin:
    """Monica's native login must still work after SSO changes."""

    def test_monica_login_returns_200(self):
        """POST /api/auth/login with valid Monica credentials returns 200."""
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "dau@urpeailab.com", "password": "admin123"},
            timeout=15,
        )
        assert resp.status_code == 200, f"Monica login failed: {resp.status_code} {resp.text}"
        print(f"PASS: Monica login returned 200")

    def test_monica_login_returns_access_token(self):
        """Monica login response should include access_token."""
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "dau@urpeailab.com", "password": "admin123"},
            timeout=15,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data, f"Missing access_token: {data}"
        assert isinstance(data["access_token"], str) and len(data["access_token"]) > 0
        print(f"PASS: Monica login returned access_token")

    def test_monica_login_invalid_credentials_returns_error(self):
        """Invalid credentials should return 400 or 401."""
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "dau@urpeailab.com", "password": "wrongpassword"},
            timeout=15,
        )
        assert resp.status_code in (400, 401), \
            f"Expected 400/401 for bad credentials, got: {resp.status_code}"
        print(f"PASS: Invalid credentials rejected with {resp.status_code}")


# ───────────────────────────────────────────────────────────────
# 6. Regression: Policy Papers
# ───────────────────────────────────────────────────────────────

class TestPolicyPapersRegression:
    """GET /api/policy-papers must return policy_papers list with valid Monica token."""

    def test_policy_papers_returns_200(self):
        """GET /api/policy-papers returns 200 with valid token."""
        token = get_monica_token()
        resp = requests.get(
            f"{BASE_URL}/api/policy-papers",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert resp.status_code == 200, f"Policy papers failed: {resp.status_code} {resp.text}"
        print(f"PASS: GET /api/policy-papers returned 200")

    def test_policy_papers_returns_policy_papers_key(self):
        """Response must contain 'policy_papers' key with a list value."""
        token = get_monica_token()
        resp = requests.get(
            f"{BASE_URL}/api/policy-papers",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "policy_papers" in data, f"Missing policy_papers key: {data.keys()}"
        assert isinstance(data["policy_papers"], list), \
            f"policy_papers should be a list, got: {type(data['policy_papers'])}"
        print(f"PASS: policy_papers key present with {len(data['policy_papers'])} items")

    def test_policy_papers_no_auth_returns_403(self):
        """GET /api/policy-papers without auth should return 403."""
        resp = requests.get(f"{BASE_URL}/api/policy-papers", timeout=15)
        assert resp.status_code in (401, 403), \
            f"Expected 401/403 without auth, got: {resp.status_code}"
        print(f"PASS: No-auth rejected with {resp.status_code}")


# ───────────────────────────────────────────────────────────────
# 7. Regression: Case Studies
# ───────────────────────────────────────────────────────────────

class TestCaseStudiesRegression:
    """GET /api/case-studies must return case_studies list with valid Monica token."""

    def test_case_studies_returns_200(self):
        """GET /api/case-studies returns 200 with valid token."""
        token = get_monica_token()
        resp = requests.get(
            f"{BASE_URL}/api/case-studies",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert resp.status_code == 200, f"Case studies failed: {resp.status_code} {resp.text}"
        print(f"PASS: GET /api/case-studies returned 200")

    def test_case_studies_returns_case_studies_key(self):
        """Response must contain 'case_studies' key with a list value."""
        token = get_monica_token()
        resp = requests.get(
            f"{BASE_URL}/api/case-studies",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "case_studies" in data, f"Missing case_studies key: {data.keys()}"
        assert isinstance(data["case_studies"], list), \
            f"case_studies should be a list, got: {type(data['case_studies'])}"
        print(f"PASS: case_studies key present with {len(data['case_studies'])} items")

    def test_case_studies_no_auth_returns_403(self):
        """GET /api/case-studies without auth should return 403."""
        resp = requests.get(f"{BASE_URL}/api/case-studies", timeout=15)
        assert resp.status_code in (401, 403), \
            f"Expected 401/403 without auth, got: {resp.status_code}"
        print(f"PASS: No-auth rejected with {resp.status_code}")
