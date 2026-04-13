"""Activity logging helper."""
from datetime import datetime, timezone
from uuid import uuid4

class ActivityLog:
    """Helper class for creating activity log entries."""
    
    @staticmethod
    def create_log(staff_id: str, action: str, resource: str, resource_id: str = None, details: dict = None):
        """
        Create an activity log entry.
        
        Args:
            staff_id: ID of the staff member performing the action
            action: Type of action (create, update, delete, etc.)
            resource: Resource type (visa_case, user, payment, etc.)
            resource_id: ID of the resource being acted upon
            details: Additional details about the action
        """
        return {
            'id': str(uuid4()),
            'staffId': staff_id,
            'action': action,
            'resource': resource,
            'resourceId': resource_id,
            'details': details or {},
            'timestamp': datetime.now(timezone.utc)
        }
