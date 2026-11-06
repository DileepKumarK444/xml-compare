from dataclasses import dataclass


@dataclass(frozen=True)
class CompareOptions:
    ignore_whitespace: bool = True   # insignificant whitespace
    ignore_comments: bool = False    # XML comments
    ignore_order: bool = False       # element order is significant by default
