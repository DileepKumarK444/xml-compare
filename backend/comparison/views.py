from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .registry import SERVICES
from .serializers import CompareRequestSerializer, ValidateRequestSerializer
from .services.options import CompareOptions
from .services.errors import ParseError
from .services.xml_validator import XMLValidator


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok", "formats": sorted(SERVICES)})


class CompareView(APIView):
    """POST /api/compare/<format>/ — files are processed in memory only."""

    def post(self, request, fmt: str = "xml"):
        service_cls = SERVICES.get(fmt)
        if service_cls is None:
            return Response({"error": f"Unsupported format '{fmt}'."}, status=status.HTTP_404_NOT_FOUND)

        ser = CompareRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        options = CompareOptions(d["ignore_whitespace"], d["ignore_comments"], d["ignore_order"])
        try:
            result = service_cls().compare(
                d["original_file"].read(), d["modified_file"].read(), options,
                original_name=d["original_file"].name, modified_name=d["modified_file"].name,
            )
        except ParseError as exc:
            return Response({"error": exc.message, "line": exc.line}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)


class ValidateView(APIView):
    """POST /api/validate/xml/ — well-formedness plus optional XSD validation, in memory only."""

    def post(self, request, fmt: str = "xml"):
        if fmt != "xml":
            return Response({"error": f"Unsupported format '{fmt}'."}, status=status.HTTP_404_NOT_FOUND)
        ser = ValidateRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        schema = d.get("schema_file")
        try:
            result = XMLValidator().validate(
                d["xml_file"].read(), schema.read() if schema else None,
                xml_name=d["xml_file"].name, schema_name=schema.name if schema else "schema.xsd",
            )
        except ParseError as exc:
            return Response({"error": exc.message, "line": exc.line}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)
