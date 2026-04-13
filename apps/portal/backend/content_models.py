# Content Models - Templates and Advisors
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List

class EligibilityTemplateModel:
    """Eligibility template model"""
    
    @staticmethod
    def create_template(
        name: str,
        profession: str,
        language: str,
        content: Dict,
        created_by: str
    ) -> Dict[str, Any]:
        """Create new eligibility template"""
        return {
            '_id': str(uuid.uuid4()),
            'name': name,
            'profession': profession,
            'language': language,
            'content': content,
            'createdBy': created_by,
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow(),
            'isActive': True,
            'usageCount': 0
        }
    
    @staticmethod
    def serialize(template: Dict[str, Any]) -> Dict[str, Any]:
        """Serialize template for JSON response"""
        template_copy = template.copy()
        
        if 'createdAt' in template_copy and isinstance(template_copy['createdAt'], datetime):
            template_copy['createdAt'] = template_copy['createdAt'].isoformat()
        if 'updatedAt' in template_copy and isinstance(template_copy['updatedAt'], datetime):
            template_copy['updatedAt'] = template_copy['updatedAt'].isoformat()
        
        return template_copy


class AdvisorModel:
    """Advisor model"""
    
    @staticmethod
    def create_advisor(
        name: str,
        email: str,
        phone: str,
        title: str,
        bio: Dict[str, str],
        specialties: List[str],
        years_experience: int,
        created_by: str,
        photo: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create new advisor"""
        return {
            '_id': str(uuid.uuid4()),
            'name': name,
            'email': email.lower(),
            'phone': phone,
            'photo': photo,
            'title': title,
            'bio': bio,
            'specialties': specialties,
            'experience': {
                'years': years_experience,
                'clientsHelped': 0
            },
            'availability': 'available',
            'assignedUsers': [],
            'stats': {
                'totalCases': 0,
                'activeCases': 0,
                'successRate': 0,
                'averageResponseTime': 0
            },
            'createdBy': created_by,
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow(),
            'isActive': True
        }
    
    @staticmethod
    def serialize(advisor: Dict[str, Any]) -> Dict[str, Any]:
        """Serialize advisor for JSON response"""
        advisor_copy = advisor.copy()
        
        if 'createdAt' in advisor_copy and isinstance(advisor_copy['createdAt'], datetime):
            advisor_copy['createdAt'] = advisor_copy['createdAt'].isoformat()
        if 'updatedAt' in advisor_copy and isinstance(advisor_copy['updatedAt'], datetime):
            advisor_copy['updatedAt'] = advisor_copy['updatedAt'].isoformat()
        
        return advisor_copy


def serialize_user_for_admin(user: Dict[str, Any]) -> Dict[str, Any]:
    """Serialize user for admin view (includes more details)"""
    user_copy = user.copy()
    
    # Convert datetime fields
    datetime_fields = ['createdAt', 'updatedAt']
    for field in datetime_fields:
        if field in user_copy and user_copy[field] and isinstance(user_copy[field], datetime):
            user_copy[field] = user_copy[field].isoformat()
    
    # Convert nested datetime fields
    if 'assignedAdvisor' in user_copy and user_copy['assignedAdvisor']:
        if 'assignedAt' in user_copy['assignedAdvisor']:
            if isinstance(user_copy['assignedAdvisor']['assignedAt'], datetime):
                user_copy['assignedAdvisor']['assignedAt'] = user_copy['assignedAdvisor']['assignedAt'].isoformat()
    
    if 'eligibilityReport' in user_copy and user_copy['eligibilityReport']:
        if 'lastUpdatedAt' in user_copy['eligibilityReport']:
            if isinstance(user_copy['eligibilityReport']['lastUpdatedAt'], datetime):
                user_copy['eligibilityReport']['lastUpdatedAt'] = user_copy['eligibilityReport']['lastUpdatedAt'].isoformat()
    
    return user_copy
