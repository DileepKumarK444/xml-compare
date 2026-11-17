class ParseError(Exception):
    """A document could not be parsed. Shared by every format's parser."""

    def __init__(self, message: str, line: int | None = None):
        super().__init__(message)
        self.message = message
        self.line = line
