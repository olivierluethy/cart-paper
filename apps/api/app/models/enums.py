from __future__ import annotations

import enum


class BookStatus(str, enum.Enum):
    draft = "draft"
    published = "published"


class HighlightColor(str, enum.Enum):
    yellow = "yellow"
    green = "green"
    blue = "blue"
    pink = "pink"
    red = "red"
    purple = "purple"
    black = "black"


class AttachmentKind(str, enum.Enum):
    link = "link"
    image = "image"
    quote = "quote"
    file = "file"


class NotificationType(str, enum.Enum):
    comment_reply = "comment_reply"
    book_comment = "book_comment"
    book_rating = "book_rating"
    invite_accepted = "invite_accepted"


class SourceType(str, enum.Enum):
    pdf = "pdf"
    docx = "docx"


class ConversionStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    converted = "converted"
    low_confidence = "low_confidence"
    failed = "failed"


class OAuthProvider(str, enum.Enum):
    google = "google"
    facebook = "facebook"
