import contextlib

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import SupportRequest, User, UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for UserProfile model."""

    class Meta:
        model = UserProfile
        fields = [
            "company",
            "job_title",
            "website",
            "linkedin_url",
            "twitter_url",
            "github_url",
            "timezone",
            "language",
            "receive_notifications",
            "receive_marketing_emails",
            "profile_visibility",
        ]


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model with profile information."""

    profile = UserProfileSerializer(read_only=True)
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone_number",
            "date_of_birth",
            "bio",
            "avatar",
            "is_verified",
            "is_active",
            "created_at",
            "updated_at",
            "profile",
        ]
        read_only_fields = ["id", "is_verified", "created_at", "updated_at"]


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""

    password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )
    password_confirm = serializers.CharField(
        write_only=True, style={"input_type": "password"}
    )

    class Meta:
        model = User
        fields = [
            "email",
            "password",
            "password_confirm",
            "first_name",
            "last_name",
            "phone_number",
            "date_of_birth",
        ]

    def validate(self, attrs):
        """Validate that passwords match."""
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": _("Password fields didn't match.")}
            )
        return attrs

    def create(self, validated_data):
        """Create a new user with encrypted password."""
        validated_data.pop("password_confirm", None)
        return User.objects.create_user(**validated_data)


class UserLoginSerializer(serializers.Serializer):
    """Serializer for user login."""

    email = serializers.EmailField()
    password = serializers.CharField(
        style={"input_type": "password"}, trim_whitespace=False
    )

    def validate(self, attrs):
        """Validate and authenticate the user."""
        email = attrs.get("email")
        password = attrs.get("password")

        if email and password:
            user = authenticate(
                request=self.context.get("request"), username=email, password=password
            )

            if not user:
                raise serializers.ValidationError(
                    _("Unable to log in with provided credentials."),
                    code="authorization",
                )

            if not user.is_active:
                raise serializers.ValidationError(
                    _("User account is disabled."), code="authorization"
                )

            attrs["user"] = user
            return attrs
        raise serializers.ValidationError(
            _('Must include "email" and "password".'), code="authorization"
        )


class PasswordChangeSerializer(serializers.Serializer):
    """Serializer for changing password."""

    old_password = serializers.CharField(
        style={"input_type": "password"}, trim_whitespace=False
    )
    new_password = serializers.CharField(
        validators=[validate_password],
        style={"input_type": "password"},
        trim_whitespace=False,
    )
    new_password_confirm = serializers.CharField(
        style={"input_type": "password"}, trim_whitespace=False
    )

    def validate_old_password(self, value):
        """Validate that the old password is correct."""
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError(
                _("Your old password was entered incorrectly.")
            )
        return value

    def validate(self, attrs):
        """Validate that new passwords match."""
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": _("Password fields didn't match.")}
            )
        return attrs

    def save(self, **kwargs):
        """Save the new password."""
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save()
        return user


class PasswordResetSerializer(serializers.Serializer):
    """Serializer for password reset request."""

    email = serializers.EmailField()

    def validate_email(self, value):
        """Validate that a user with this email exists."""
        with contextlib.suppress(BaseException):
            User.objects.get(email=value, is_active=True)
        return value


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Serializer for password reset confirmation."""

    new_password = serializers.CharField(
        validators=[validate_password], style={"input_type": "password"}
    )
    new_password_confirm = serializers.CharField(style={"input_type": "password"})

    def validate(self, attrs):
        """Validate that passwords match."""
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": _("Password fields didn't match.")}
            )
        return attrs


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user information."""

    profile = UserProfileSerializer(required=False)

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "phone_number",
            "date_of_birth",
            "bio",
            "avatar",
            "profile",
        ]

    def update(self, instance, validated_data):
        """Update user and profile information."""
        profile_data = validated_data.pop("profile", None)

        # Update user fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update profile fields if provided
        if profile_data:
            profile = instance.profile
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()

        return instance


class UserListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for user lists."""

    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "avatar",
            "is_verified",
            "created_at",
        ]


class SupportRequestSerializer(serializers.ModelSerializer):
    """Serializer for SupportRequest model."""

    class Meta:
        model = SupportRequest
        fields = [
            "id",
            "email",
            "subject",
            "message",
            "status",
            "priority",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "created_at", "updated_at"]

    def create(self, validated_data):
        """Create a support request and associate with user if authenticated."""
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["user"] = request.user
            # Use user's email if not provided
            if not validated_data.get("email"):
                validated_data["email"] = request.user.email
        return super().create(validated_data)
