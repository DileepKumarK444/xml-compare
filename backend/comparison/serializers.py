from django.conf import settings
from rest_framework import serializers


def _bool(default):
    return serializers.BooleanField(required=False, default=default)


class CompareRequestSerializer(serializers.Serializer):
    original_file = serializers.FileField()
    modified_file = serializers.FileField()
    ignore_whitespace = _bool(True)
    ignore_comments = _bool(False)
    ignore_order = _bool(False)

    def _check(self, f):
        if f.size > settings.MAX_XML_BYTES:
            raise serializers.ValidationError("File is too large.")
        if f.size == 0:
            raise serializers.ValidationError("File is empty.")
        return f

    def validate_original_file(self, f):
        return self._check(f)

    def validate_modified_file(self, f):
        return self._check(f)
