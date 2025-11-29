from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    PasswordResetConfirmView,
    PasswordResetView,
    UserLoginView,
    UserLogoutView,
    UserRegistrationView,
    UserViewSet,
    create_support_request,
)

app_name = "users"

urlpatterns = [
    # Authentication endpoints
    path("auth/register/", UserRegistrationView.as_view(), name="register"),
    path("auth/login/", UserLoginView.as_view(), name="login"),
    path("auth/logout/", UserLogoutView.as_view(), name="logout"),
    # Password reset endpoints
    path("auth/password-reset/", PasswordResetView.as_view(), name="password_reset"),
    path(
        "auth/password-reset-confirm/<str:uid>/<str:token>/",
        PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
]

# Create router for ViewSets
router = DefaultRouter()
router.register(r"users", UserViewSet)

# Add router URLs after specific routes
urlpatterns += [
    # User management endpoints (includes ViewSet routes)
    path("", include(router.urls)),
]
