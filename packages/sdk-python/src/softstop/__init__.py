"""softstop — Python client for SoftStop authorize-only pressure permits."""

from softstop.agent import (
    BeforeContactAllowed,
    BeforeContactBlocked,
    BeforeContactResult,
    before_contact,
    wrap_user_facing_tool,
)
from softstop.client import SoftStop
from softstop._http import SoftStopHttpError

# Deprecated alias
GovernorClient = SoftStop

__all__ = [
    "SoftStop",
    "GovernorClient",
    "SoftStopHttpError",
    "before_contact",
    "wrap_user_facing_tool",
    "BeforeContactResult",
    "BeforeContactAllowed",
    "BeforeContactBlocked",
]

__version__ = "0.2.1"
