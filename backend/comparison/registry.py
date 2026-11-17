"""Format registry. Add e.g. CSV/DOCX services here later."""
from .services.json_service import JSONComparisonService
from .services.service import XMLComparisonService
from .services.text_service import TextComparisonService

SERVICES = {
    XMLComparisonService.format_name: XMLComparisonService,
    JSONComparisonService.format_name: JSONComparisonService,
    TextComparisonService.format_name: TextComparisonService,
}
