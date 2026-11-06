"""Format registry. Add e.g. JSON/CSV/DOCX services here later."""
from .services.service import XMLComparisonService

SERVICES = {XMLComparisonService.format_name: XMLComparisonService}
