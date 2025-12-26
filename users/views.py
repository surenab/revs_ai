import contextlib

from django.conf import settings
from django.contrib.auth import login, logout
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.translation import gettext_lazy as _
from rest_framework import generics, permissions, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from .models import Notification, User
from .serializers import (
    NotificationSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetSerializer,
    SupportRequestSerializer,
    UserListSerializer,
    UserLoginSerializer,
    UserRegistrationSerializer,
    UserSerializer,
    UserUpdateSerializer,
)


class UserRegistrationView(generics.CreateAPIView):
    """API view for user registration."""

    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        """Create a new user and return user data with token."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Create token for the user
        token, _created = Token.objects.get_or_create(user=user)

        # Return user data with token
        user_serializer = UserSerializer(user)
        return Response(
            {
                "user": user_serializer.data,
                "token": token.key,
                "message": _("User registered successfully."),
            },
            status=status.HTTP_201_CREATED,
        )


class UserLoginView(generics.GenericAPIView):
    """API view for user login."""

    serializer_class = UserLoginSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        """Authenticate user and return token."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        # Update last login IP
        user.last_login_ip = self.get_client_ip(request)
        user.save(update_fields=["last_login_ip"])

        # Login user
        login(request, user)

        # Get or create token
        token, _created = Token.objects.get_or_create(user=user)

        # Return user data with token
        user_serializer = UserSerializer(user)
        return Response(
            {
                "user": user_serializer.data,
                "token": token.key,
                "message": _("Login successful."),
            },
            status=status.HTTP_200_OK,
        )

    def get_client_ip(self, request):
        """Get the client's IP address."""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0]
        else:
            ip = request.META.get("REMOTE_ADDR")
        return ip


class UserLogoutView(generics.GenericAPIView):
    """API view for user logout."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        """Logout user and delete token."""
        with contextlib.suppress(BaseException):
            # Delete the user's token
            request.user.auth_token.delete()

        # Logout user
        logout(request)

        return Response({"message": _("Logout successful.")}, status=status.HTTP_200_OK)


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for managing users."""

    queryset = User.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        """Return appropriate serializer class based on action."""
        if self.action == "list":
            return UserListSerializer
        if self.action in ["update", "partial_update"]:
            return UserUpdateSerializer
        return UserSerializer

    def get_queryset(self):
        """Filter queryset based on user permissions."""
        if self.request.user.is_staff:
            return User.objects.all()
        return User.objects.filter(id=self.request.user.id)

    @action(detail=False, methods=["get", "put", "patch"])
    def me(self, request):
        """Get or update current user's profile."""
        if request.method == "GET":
            serializer = UserSerializer(request.user)
            return Response(serializer.data)

        if request.method in ["PUT", "PATCH"]:
            serializer = UserUpdateSerializer(
                request.user, data=request.data, partial=(request.method == "PATCH")
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()

            # Create notification
            create_notification(
                user=request.user,
                notification_type="profile_updated",
                title="Profile Updated",
                message="Your profile has been updated successfully.",
            )

            # Return updated user data
            user_serializer = UserSerializer(request.user)
            return Response(
                {
                    "user": user_serializer.data,
                    "message": _("Profile updated successfully."),
                }
            )
        return None

    @action(detail=False, methods=["post"])
    def change_password(self, request):
        """Change user's password."""
        serializer = PasswordChangeSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Create notification
        create_notification(
            user=request.user,
            notification_type="password_changed",
            title="Password Changed",
            message="Your password has been changed successfully. Please login again.",
        )

        # Delete all tokens to force re-login
        Token.objects.filter(user=request.user).delete()

        return Response(
            {"message": _("Password changed successfully. Please login again.")}
        )

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAdminUser])
    def verify_user(self, request, pk=None):
        """Verify a user account (admin only)."""
        user = self.get_object()
        user.is_verified = True
        user.save(update_fields=["is_verified"])

        return Response({"message": _("User verified successfully.")})

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAdminUser])
    def deactivate_user(self, request, pk=None):
        """Deactivate a user account (admin only)."""
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=["is_active"])

        # Delete user's tokens
        Token.objects.filter(user=user).delete()

        return Response({"message": _("User deactivated successfully.")})


class PasswordResetView(generics.GenericAPIView):
    """API view for password reset request."""

    serializer_class = PasswordResetSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        """Send password reset email."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]

        try:
            user = User.objects.get(email=email, is_active=True)

            # Generate password reset token
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))

            # Create reset URL (you'll need to implement the frontend route)
            reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}/"

            # Send email (you'll need to create the template)
            context = {
                "user": user,
                "reset_url": reset_url,
                "site_name": getattr(settings, "SITE_NAME", "Your Site"),
            }

            subject = _("Password Reset Request")
            message = render_to_string("users/password_reset_email.txt", context)

            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )

        except User.DoesNotExist:
            # Don't reveal whether the email exists or not
            pass

        return Response(
            {
                "message": _(
                    "If an account with this email exists, a password reset link has been sent."
                )
            }
        )


class PasswordResetConfirmView(generics.GenericAPIView):
    """API view for password reset confirmation."""

    serializer_class = PasswordResetConfirmSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, uid, token, *args, **kwargs):
        """Reset password with token."""
        try:
            # Decode user ID
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)

            # Verify token
            if not default_token_generator.check_token(user, token):
                return Response(
                    {"error": _("Invalid or expired token.")},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate and save new password
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            user.set_password(serializer.validated_data["new_password"])
            user.save()

            # Delete all tokens to force re-login
            Token.objects.filter(user=user).delete()

            return Response(
                {
                    "message": _(
                        "Password reset successfully. Please login with your new password."
                    )
                }
            )

        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {"error": _("Invalid token.")}, status=status.HTTP_400_BAD_REQUEST
            )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def create_support_request(request):
    """Create a new support request."""
    serializer = SupportRequestSerializer(
        data=request.data, context={"request": request}
    )
    if serializer.is_valid():
        support_request = serializer.save()
        return Response(
            {
                "message": _(
                    "Support request submitted successfully. We'll get back to you soon."
                ),
                "id": str(support_request.id),
            },
            status=status.HTTP_201_CREATED,
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Notification helper function
def create_notification(
    user,
    notification_type,
    title,
    message,
    related_object_type=None,
    related_object_id=None,
    metadata=None,
):
    """Helper function to create a notification for a user."""
    return Notification.objects.create(
        user=user,
        type=notification_type,
        title=title,
        message=message,
        related_object_type=related_object_type,
        related_object_id=related_object_id,
        metadata=metadata or {},
    )


class NotificationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing user notifications."""

    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return notifications for the current user."""
        return Notification.objects.filter(user=self.request.user)

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        """Get count of unread notifications."""
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"count": count})

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        """Mark a notification as read."""
        notification = self.get_object()
        notification.mark_as_read()
        return Response({"message": _("Notification marked as read")})

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        """Mark all notifications as read for the current user."""
        updated = Notification.objects.filter(user=request.user, is_read=False).update(
            is_read=True, read_at=timezone.now()
        )
        return Response(
            {"message": _("All notifications marked as read"), "updated": updated}
        )
