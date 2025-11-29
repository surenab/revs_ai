from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from .models import SupportRequest, User, UserProfile


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Custom admin for the User model."""

    # Fields to display in the user list
    list_display = (
        "email",
        "first_name",
        "last_name",
        "is_active",
        "is_staff",
        "is_verified",
        "created_at",
    )

    # Fields to filter by in the admin sidebar
    list_filter = (
        "is_active",
        "is_staff",
        "is_superuser",
        "is_verified",
        "created_at",
        "last_login",
    )

    # Fields to search by
    search_fields = ("email", "first_name", "last_name", "phone_number")

    # Default ordering
    ordering = ("-created_at",)

    # Fields that are read-only
    readonly_fields = ("id", "created_at", "updated_at", "last_login", "last_login_ip")

    # Fieldsets for the user detail/edit page
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            _("Personal info"),
            {
                "fields": (
                    "first_name",
                    "last_name",
                    "phone_number",
                    "date_of_birth",
                    "bio",
                    "avatar",
                )
            },
        ),
        (
            _("Permissions"),
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "is_verified",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        (
            _("Important dates"),
            {
                "fields": ("last_login", "created_at", "updated_at", "last_login_ip"),
                "classes": ("collapse",),
            },
        ),
        (_("System Info"), {"fields": ("id",), "classes": ("collapse",)}),
    )

    # Fieldsets for adding a new user
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "password1",
                    "password2",
                    "first_name",
                    "last_name",
                    "is_active",
                    "is_staff",
                ),
            },
        ),
    )

    # Remove username from the form since we're using email
    filter_horizontal = (
        "groups",
        "user_permissions",
    )


class UserProfileInline(admin.StackedInline):
    """Inline admin for UserProfile."""

    model = UserProfile
    can_delete = False
    verbose_name_plural = _("Profile Information")

    fieldsets = (
        (
            _("Professional Information"),
            {"fields": ("company", "job_title", "website")},
        ),
        (
            _("Social Media"),
            {
                "fields": ("linkedin_url", "twitter_url", "github_url"),
                "classes": ("collapse",),
            },
        ),
        (
            _("Preferences"),
            {
                "fields": (
                    "timezone",
                    "language",
                    "receive_notifications",
                    "receive_marketing_emails",
                    "profile_visibility",
                ),
                "classes": ("collapse",),
            },
        ),
    )


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """Admin for UserProfile model."""

    list_display = (
        "user",
        "company",
        "job_title",
        "timezone",
        "profile_visibility",
        "created_at",
    )

    list_filter = (
        "profile_visibility",
        "receive_notifications",
        "receive_marketing_emails",
        "timezone",
        "language",
    )

    search_fields = (
        "user__email",
        "user__first_name",
        "user__last_name",
        "company",
        "job_title",
    )

    readonly_fields = ("created_at", "updated_at")

    fieldsets = (
        (_("User"), {"fields": ("user",)}),
        (
            _("Professional Information"),
            {"fields": ("company", "job_title", "website")},
        ),
        (
            _("Social Media"),
            {
                "fields": ("linkedin_url", "twitter_url", "github_url"),
                "classes": ("collapse",),
            },
        ),
        (
            _("Preferences"),
            {
                "fields": (
                    "timezone",
                    "language",
                    "receive_notifications",
                    "receive_marketing_emails",
                    "profile_visibility",
                )
            },
        ),
        (
            _("Timestamps"),
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )


# Add UserProfile inline to UserAdmin
UserAdmin.inlines = [UserProfileInline]


@admin.register(SupportRequest)
class SupportRequestAdmin(admin.ModelAdmin):
    """Admin for SupportRequest model."""

    list_display = (
        "subject",
        "email",
        "user",
        "status",
        "priority",
        "created_at",
        "updated_at",
    )

    list_filter = (
        "status",
        "priority",
        "created_at",
        "updated_at",
    )

    search_fields = (
        "subject",
        "message",
        "email",
        "user__email",
        "user__first_name",
        "user__last_name",
    )

    readonly_fields = ("id", "created_at", "updated_at", "resolved_at")

    fieldsets = (
        (
            _("Request Information"),
            {"fields": ("id", "user", "email", "subject", "message")},
        ),
        (
            _("Status & Priority"),
            {"fields": ("status", "priority", "resolved_at")},
        ),
        (
            _("Admin Notes"),
            {"fields": ("admin_notes",), "classes": ("collapse",)},
        ),
        (
            _("Timestamps"),
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )

    actions = ["mark_as_resolved", "mark_as_in_progress", "mark_as_closed"]

    def mark_as_resolved(self, request, queryset):
        """Mark selected support requests as resolved."""

        count = queryset.update(status="resolved", resolved_at=timezone.now())
        self.message_user(request, f"{count} support request(s) marked as resolved.")

    mark_as_resolved.short_description = _("Mark selected requests as resolved")

    def mark_as_in_progress(self, request, queryset):
        """Mark selected support requests as in progress."""
        count = queryset.update(status="in_progress")
        self.message_user(request, f"{count} support request(s) marked as in progress.")

    mark_as_in_progress.short_description = _("Mark selected requests as in progress")

    def mark_as_closed(self, request, queryset):
        """Mark selected support requests as closed."""
        count = queryset.update(status="closed")
        self.message_user(request, f"{count} support request(s) marked as closed.")

    mark_as_closed.short_description = _("Mark selected requests as closed")
