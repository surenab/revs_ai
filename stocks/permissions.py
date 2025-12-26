from rest_framework import permissions


class IsAdminRole(permissions.BasePermission):
    """
    Permission class to check if user has admin role.
    Only users with role='admin' can access the view.
    """

    def has_permission(self, request, view):
        """Check if the user has admin role."""
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "role")
            and request.user.role == "admin"
        )
