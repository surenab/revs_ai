import uuid
from decimal import Decimal

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords


class UserManager(BaseUserManager):
    """Custom user manager for creating users and superusers."""

    def create_user(self, email, password=None, **extra_fields):
        """Create and return a regular user with an email and password."""
        if not email:
            raise ValueError(_("The Email field must be set"))

        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Create and return a superuser with an email and password."""
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("role", "admin")

        if extra_fields.get("is_staff") is not True:
            raise ValueError(_("Superuser must have is_staff=True."))
        if extra_fields.get("is_superuser") is not True:
            raise ValueError(_("Superuser must have is_superuser=True."))

        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    """
    Custom User model that uses email as the unique identifier
    instead of username.
    """

    # Remove username field and use email as unique identifier
    username = None
    email = models.EmailField(_("email address"), unique=True)

    # Additional user fields
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(_("first name"), max_length=150, blank=True)
    last_name = models.CharField(_("last name"), max_length=150, blank=True)
    phone_number = models.CharField(_("phone number"), max_length=20, blank=True)
    date_of_birth = models.DateField(_("date of birth"), null=True, blank=True)

    # Profile information
    bio = models.TextField(_("bio"), max_length=500, blank=True)
    avatar = models.ImageField(_("avatar"), upload_to="avatars/", null=True, blank=True)

    # Account status fields
    is_verified = models.BooleanField(_("verified"), default=False)
    is_active = models.BooleanField(_("active"), default=True)

    # User role for permissions
    ROLE_CHOICES = [
        ("user", _("User")),
        ("admin", _("Admin")),
    ]
    role = models.CharField(
        _("role"),
        max_length=20,
        choices=ROLE_CHOICES,
        default="user",
        help_text=_("User role determines access permissions"),
    )

    # Timestamps
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)
    last_login_ip = models.GenericIPAddressField(
        _("last login IP"), null=True, blank=True
    )

    # Use email as the unique identifier
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    # History tracking
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("User")
        verbose_name_plural = _("Users")
        ordering = ["-created_at"]

    def __str__(self):
        return self.email

    def get_full_name(self):
        """Return the first_name plus the last_name, with a space in between."""
        full_name = f"{self.first_name} {self.last_name}"
        return full_name.strip()

    def get_short_name(self):
        """Return the short name for the user."""
        return self.first_name

    @property
    def full_name(self):
        """Property to get full name."""
        return self.get_full_name()


class UserProfile(models.Model):
    """
    Extended user profile for additional information.
    This allows for better separation of concerns.
    """

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")

    # Professional information
    company = models.CharField(_("company"), max_length=100, blank=True)
    job_title = models.CharField(_("job title"), max_length=100, blank=True)
    website = models.URLField(_("website"), blank=True)

    # Social media links
    linkedin_url = models.URLField(_("LinkedIn URL"), blank=True)
    twitter_url = models.URLField(_("Twitter URL"), blank=True)
    github_url = models.URLField(_("GitHub URL"), blank=True)

    # Preferences
    timezone = models.CharField(_("timezone"), max_length=50, default="UTC")
    language = models.CharField(_("language"), max_length=10, default="en")
    receive_notifications = models.BooleanField(
        _("receive notifications"), default=True
    )
    receive_marketing_emails = models.BooleanField(
        _("receive marketing emails"), default=False
    )

    # Privacy settings
    profile_visibility = models.CharField(
        _("profile visibility"),
        max_length=20,
        choices=[
            ("public", _("Public")),
            ("private", _("Private")),
            ("friends", _("Friends Only")),
        ],
        default="public",
    )

    # Portfolio cash balance
    cash = models.DecimalField(
        _("cash balance"),
        max_digits=15,
        decimal_places=2,
        default=Decimal(0),  # Default starting cash: $0
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text=_("Available cash balance for trading"),
    )

    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    # History tracking
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("User Profile")
        verbose_name_plural = _("User Profiles")

    def __str__(self):
        return f"{self.user.email}'s Profile"


# Signal to create user profile automatically
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Create a UserProfile when a new User is created."""
    if created:
        UserProfile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """Save the UserProfile when the User is saved."""
    if hasattr(instance, "profile"):
        instance.profile.save()


@receiver(post_save, sender=User)
def set_admin_role_for_staff(sender, instance, **kwargs):
    """Automatically set role='admin' for Django admin users (is_staff or is_superuser)."""
    if (instance.is_staff or instance.is_superuser) and instance.role != "admin":
        instance.role = "admin"
        # Avoid infinite loop by using update instead of save
        User.objects.filter(pk=instance.pk).update(role="admin")


class SupportRequest(models.Model):
    """
    Model for storing user support requests.
    """

    STATUS_CHOICES = [
        ("pending", _("Pending")),
        ("in_progress", _("In Progress")),
        ("resolved", _("Resolved")),
        ("closed", _("Closed")),
    ]

    PRIORITY_CHOICES = [
        ("low", _("Low")),
        ("medium", _("Medium")),
        ("high", _("High")),
        ("urgent", _("Urgent")),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="support_requests",
        null=True,
        blank=True,
        help_text=_("User who submitted the request (optional for anonymous requests)"),
    )
    email = models.EmailField(_("email address"), help_text=_("Contact email"))
    subject = models.CharField(_("subject"), max_length=200)
    message = models.TextField(_("message"), max_length=2000)
    status = models.CharField(
        _("status"),
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )
    priority = models.CharField(
        _("priority"),
        max_length=20,
        choices=PRIORITY_CHOICES,
        default="medium",
    )
    admin_notes = models.TextField(
        _("admin notes"), blank=True, help_text=_("Internal notes for admin use")
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)
    resolved_at = models.DateTimeField(_("resolved at"), null=True, blank=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Support Request")
        verbose_name_plural = _("Support Requests")
        ordering = ["-created_at"]

    def __str__(self):
        return f"Support Request: {self.subject} ({self.get_status_display()})"

    def mark_as_resolved(self):
        """Mark the support request as resolved."""

        self.status = "resolved"
        self.resolved_at = timezone.now()
        self.save()


class Notification(models.Model):
    """
    Model for storing user notifications.
    """

    TYPE_CHOICES = [
        ("bot_created", _("Bot Created")),
        ("bot_updated", _("Bot Updated")),
        ("bot_deleted", _("Bot Deleted")),
        ("bot_activated", _("Bot Activated")),
        ("bot_deactivated", _("Bot Deactivated")),
        ("bot_executed", _("Bot Executed")),
        ("bot_execution_complete", _("Bot Execution Complete")),
        ("bot_trade_executed", _("Bot Trade Executed")),
        ("account_updated", _("Account Updated")),
        ("password_changed", _("Password Changed")),
        ("profile_updated", _("Profile Updated")),
        ("order_filled", _("Order Filled")),
        ("order_partial", _("Order Partially Filled")),
        ("order_cancelled", _("Order Cancelled")),
        ("system", _("System Notification")),
        ("other", _("Other")),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications",
        help_text=_("User who receives this notification"),
    )
    type = models.CharField(
        _("type"),
        max_length=50,
        choices=TYPE_CHOICES,
        default="other",
        help_text=_("Type of notification"),
    )
    title = models.CharField(
        _("title"), max_length=200, help_text=_("Notification title")
    )
    message = models.TextField(_("message"), help_text=_("Notification message"))
    is_read = models.BooleanField(
        _("is read"),
        default=False,
        help_text=_("Whether the notification has been read"),
    )
    # Optional link to related object
    related_object_type = models.CharField(
        _("related object type"),
        max_length=50,
        blank=True,
        null=True,
        help_text=_("Type of related object (e.g., 'bot', 'order')"),
    )
    related_object_id = models.UUIDField(
        _("related object id"),
        null=True,
        blank=True,
        help_text=_("ID of related object"),
    )
    # Additional data as JSON
    metadata = models.JSONField(
        _("metadata"),
        default=dict,
        blank=True,
        help_text=_("Additional notification data"),
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    read_at = models.DateTimeField(_("read at"), null=True, blank=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Notification")
        verbose_name_plural = _("Notifications")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_read", "-created_at"]),
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        return f"Notification: {self.title} ({self.user.email})"

    def mark_as_read(self):
        """Mark the notification as read."""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=["is_read", "read_at"])
