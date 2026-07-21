"""Digital worker team collaboration module (V15-04).

Provides schema, repository, and service for multi-employee collaboration:
- Create a collaboration task with a goal + employee list
- Auto-assign subtasks by keyword-based skill matching
- Execute subtasks in parallel (mock) honoring dependencies
- Generate a collaboration report with contribution stats and efficiency gain
"""

from app.collaboration.schemas import (
    CollaborationReport,
    CollaborationStatus,
    CollaborationTask,
    Contribution,
    CreateCollaborationRequest,
    SplitStrategy,
    SubTask,
    SubTaskStatus,
    collaboration_to_dict,
    report_to_dict,
    subtask_to_dict,
)
from app.collaboration.repository import (
    CollaborationRepository,
    InMemoryCollaborationRepository,
)
from app.collaboration.service import CollaborationService

__all__ = [
    "CollaborationReport",
    "CollaborationRepository",
    "CollaborationService",
    "CollaborationStatus",
    "CollaborationTask",
    "Contribution",
    "CreateCollaborationRequest",
    "InMemoryCollaborationRepository",
    "SplitStrategy",
    "SubTask",
    "SubTaskStatus",
    "collaboration_to_dict",
    "report_to_dict",
    "subtask_to_dict",
]
