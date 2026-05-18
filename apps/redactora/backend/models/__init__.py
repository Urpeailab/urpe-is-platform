"""
Models package for Monica NIW
"""
from .self_petition_v2 import SelfPetitionV2Session, SelfPetitionV2Letter
from .business_plan import (
    BusinessPlan,
    BusinessPlanInput,
    NIWSection,
    NIWInProgress,
    ProjectNameSelection,
    EditSectionRequest,
    AIEditRequest,
    AIEditResponse
)

__all__ = [
    # Self Petition V2
    'SelfPetitionV2Session',
    'SelfPetitionV2Letter',
    # Business Plans / NIW
    'BusinessPlan',
    'BusinessPlanInput',
    'NIWSection',
    'NIWInProgress',
    'ProjectNameSelection',
    'EditSectionRequest',
    'AIEditRequest',
    'AIEditResponse'
]

