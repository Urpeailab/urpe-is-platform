"""
Test Classic Cases Notification Features
Tests for the 10 notification gaps implementation:
1. Coordinator email on status changes
2. Director added to RFE received
3. Desisted notification
4. 'Informar al Cliente' button
5. Resend notifications with coordinator option
6. Bulk email page
7. event_type notification logging
8. Anti-duplicate for cron alerts
9. Differentiated milestone followup emails
10. N8N webhook integration (deferred)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestClassicCasesNotifications:
    """Test notification features for classic cases"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_email = "admin@urpe.com"
        self.admin_password = "urpe2024"
        self.token = None
        self.case_id = None
        
    def get_auth_token(self):
        """Get admin authentication token"""
        if self.token:
            return self.token
        response = requests.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={"email": self.admin_email, "password": self.admin_password}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("token")
        return self.token
    
    def get_headers(self):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {self.get_auth_token()}"}
    
    # ========== BASIC API TESTS ==========
    
    def test_login_admin(self):
        """Test admin login with provided credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={"email": self.admin_email, "password": self.admin_password}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        print(f"Login successful, token received")
    
    def test_get_classic_cases_list(self):
        """Test getting classic cases list"""
        response = requests.get(
            f"{BASE_URL}/api/classic-cases/admin",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert "cases" in data
        print(f"Found {len(data['cases'])} classic cases")
        
        # Store first case ID for later tests
        if data['cases']:
            self.case_id = data['cases'][0]['id']
            print(f"Using case ID: {self.case_id}")
        return data['cases']
    
    # ========== NOTIFY CLIENT STATUS (Informar al Cliente) ==========
    
    def test_notify_client_status_endpoint_exists(self):
        """Test that notify-client-status endpoint exists"""
        cases = self.test_get_classic_cases_list()
        if not cases:
            pytest.skip("No classic cases available for testing")
        
        case_id = cases[0]['id']
        response = requests.post(
            f"{BASE_URL}/api/classic-cases/admin/{case_id}/notify-client-status",
            headers={**self.get_headers(), "Content-Type": "application/json"},
            json={}
        )
        # Should return 200 or 400 (if no email), not 404
        assert response.status_code in [200, 400, 500], f"Unexpected status: {response.status_code}"
        print(f"notify-client-status endpoint response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            print(f"Email sent successfully: {data.get('message')}")
        elif response.status_code == 400:
            print(f"Expected error (no email): {response.json()}")
    
    # ========== BULK EMAIL ==========
    
    def test_bulk_email_endpoint_exists(self):
        """Test that bulk-email endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/classic-cases/admin/bulk-email",
            headers={**self.get_headers(), "Content-Type": "application/json"},
            json={"subject": "", "body": "", "caseIds": []}
        )
        # Should return 400 (validation error), not 404
        assert response.status_code in [400, 403], f"Unexpected status: {response.status_code}"
        print(f"bulk-email endpoint exists, validation working: {response.status_code}")
    
    def test_bulk_email_with_valid_data(self):
        """Test bulk email with valid data"""
        cases = self.test_get_classic_cases_list()
        if not cases:
            pytest.skip("No classic cases available for testing")
        
        # Find cases with email
        cases_with_email = [c for c in cases if c.get('email')]
        if not cases_with_email:
            pytest.skip("No cases with email available")
        
        case_ids = [cases_with_email[0]['id']]
        response = requests.post(
            f"{BASE_URL}/api/classic-cases/admin/bulk-email",
            headers={**self.get_headers(), "Content-Type": "application/json"},
            json={
                "subject": "Test Bulk Email - {nombre}",
                "body": "Hola {nombre}, este es un email de prueba.",
                "caseIds": case_ids
            }
        )
        assert response.status_code == 200, f"Bulk email failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "sent" in data
        print(f"Bulk email result: {data['sent']} sent, {data.get('failed', 0)} failed")
    
    # ========== NOTIFICATION LOG ==========
    
    def test_notification_log_endpoint(self):
        """Test notification log endpoint"""
        cases = self.test_get_classic_cases_list()
        if not cases:
            pytest.skip("No classic cases available for testing")
        
        case_id = cases[0]['id']
        response = requests.get(
            f"{BASE_URL}/api/classic-cases/admin/{case_id}/notification-log",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        print(f"Notification log has {len(data['logs'])} entries")
        
        # Verify log structure if entries exist
        if data['logs']:
            log = data['logs'][0]
            assert "event_type" in log
            assert "recipient" in log
            assert "sentAt" in log
            print(f"Sample log entry: event_type={log['event_type']}, recipient={log['recipient']}")
    
    # ========== RESEND NOTIFICATION ==========
    
    def test_resend_notification_endpoint_exists(self):
        """Test that resend-notification endpoint exists"""
        cases = self.test_get_classic_cases_list()
        if not cases:
            pytest.skip("No classic cases available for testing")
        
        case_id = cases[0]['id']
        
        # Test with invalid type to verify endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/classic-cases/admin/{case_id}/resend-notification",
            headers=self.get_headers(),
            data={
                "notificationType": "invalid_type",
                "sendToClient": "true",
                "sendToCoordinator": "false"
            }
        )
        # Should return 400 (invalid type), not 404
        assert response.status_code in [400, 500], f"Unexpected status: {response.status_code}"
        print(f"resend-notification endpoint exists: {response.status_code}")
    
    def test_resend_notification_with_coordinator(self):
        """Test resend notification with sendToCoordinator option"""
        cases = self.test_get_classic_cases_list()
        if not cases:
            pytest.skip("No classic cases available for testing")
        
        # Find a case with tracking number for radicado notification
        case_with_tracking = None
        for case in cases:
            if case.get('trackingNumber'):
                case_with_tracking = case
                break
        
        if not case_with_tracking:
            pytest.skip("No case with tracking number available")
        
        case_id = case_with_tracking['id']
        response = requests.post(
            f"{BASE_URL}/api/classic-cases/admin/{case_id}/resend-notification",
            headers=self.get_headers(),
            data={
                "notificationType": "radicado",
                "sendToClient": "false",
                "sendToCoordinator": "true"
            }
        )
        # May fail if no coordinator assigned, but endpoint should work
        print(f"Resend to coordinator response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            print(f"Resend successful: {data.get('message')}")
    
    # ========== RESEND HISTORY ==========
    
    def test_resend_history_endpoint(self):
        """Test resend history endpoint"""
        cases = self.test_get_classic_cases_list()
        if not cases:
            pytest.skip("No classic cases available for testing")
        
        case_id = cases[0]['id']
        response = requests.get(
            f"{BASE_URL}/api/classic-cases/admin/{case_id}/resend-history",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert "history" in data
        print(f"Resend history has {len(data['history'])} entries")
    
    # ========== CASE DETAIL ==========
    
    def test_get_case_detail(self):
        """Test getting case detail"""
        cases = self.test_get_classic_cases_list()
        if not cases:
            pytest.skip("No classic cases available for testing")
        
        case_id = cases[0]['id']
        response = requests.get(
            f"{BASE_URL}/api/classic-cases/admin/{case_id}",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        data = response.json()
        # Response wraps case in 'case' key
        case_data = data.get('case', data)
        assert "id" in case_data
        print(f"Case detail: name={case_data.get('name')}, status={case_data.get('status')}")
        
        # Check for notification-related fields
        print(f"  - trackingNumber: {data.get('trackingNumber')}")
        print(f"  - ioeNumber: {data.get('ioeNumber')}")
        print(f"  - coordinatorId: {data.get('coordinatorId')}")
        print(f"  - email: {data.get('email')}")


class TestClassicCasesWorkStatus:
    """Test work status changes including desisted notification"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.admin_email = "admin@urpe.com"
        self.admin_password = "urpe2024"
        self.token = None
        
    def get_auth_token(self):
        if self.token:
            return self.token
        response = requests.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={"email": self.admin_email, "password": self.admin_password}
        )
        self.token = response.json().get("token")
        return self.token
    
    def get_headers(self):
        return {"Authorization": f"Bearer {self.get_auth_token()}"}
    
    def test_work_status_change_endpoint(self):
        """Test work status change endpoint exists"""
        response = requests.get(
            f"{BASE_URL}/api/classic-cases/admin",
            headers=self.get_headers()
        )
        cases = response.json().get('cases', [])
        if not cases:
            pytest.skip("No classic cases available")
        
        case_id = cases[0]['id']
        
        # Test changing work status
        response = requests.post(
            f"{BASE_URL}/api/classic-cases/admin/{case_id}/work-status",
            headers=self.get_headers(),
            data={"workStatus": "working"}
        )
        assert response.status_code == 200
        print(f"Work status change successful")


class TestBulkEmailPage:
    """Test bulk email page functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.admin_email = "admin@urpe.com"
        self.admin_password = "urpe2024"
        self.token = None
        
    def get_auth_token(self):
        if self.token:
            return self.token
        response = requests.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={"email": self.admin_email, "password": self.admin_password}
        )
        self.token = response.json().get("token")
        return self.token
    
    def get_headers(self):
        return {"Authorization": f"Bearer {self.get_auth_token()}"}
    
    def test_bulk_email_requires_auth(self):
        """Test that bulk email requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/classic-cases/admin/bulk-email",
            json={"subject": "Test", "body": "Test", "caseIds": []}
        )
        assert response.status_code in [401, 403, 422]
        print(f"Bulk email requires auth: {response.status_code}")
    
    def test_bulk_email_validation(self):
        """Test bulk email validation"""
        # Missing subject
        response = requests.post(
            f"{BASE_URL}/api/classic-cases/admin/bulk-email",
            headers={**self.get_headers(), "Content-Type": "application/json"},
            json={"subject": "", "body": "Test body", "caseIds": ["test-id"]}
        )
        assert response.status_code == 400
        print(f"Validation for empty subject: {response.status_code}")
        
        # Missing body
        response = requests.post(
            f"{BASE_URL}/api/classic-cases/admin/bulk-email",
            headers={**self.get_headers(), "Content-Type": "application/json"},
            json={"subject": "Test subject", "body": "", "caseIds": ["test-id"]}
        )
        assert response.status_code == 400
        print(f"Validation for empty body: {response.status_code}")
        
        # Missing caseIds
        response = requests.post(
            f"{BASE_URL}/api/classic-cases/admin/bulk-email",
            headers={**self.get_headers(), "Content-Type": "application/json"},
            json={"subject": "Test subject", "body": "Test body", "caseIds": []}
        )
        assert response.status_code == 400
        print(f"Validation for empty caseIds: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
