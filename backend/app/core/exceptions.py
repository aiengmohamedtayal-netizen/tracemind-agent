class DomainError(Exception):
    """Expected business error safe to return to an API consumer."""


class ValidationError(DomainError):
    pass


class NotFoundError(DomainError):
    pass
