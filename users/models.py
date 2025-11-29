import uuid
from decimal import Decimal

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.translation import gettext_lazy as _


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
        default=Decimal('10000.00'),  # Default starting cash: $10,000
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text=_("Available cash balance for trading")
    )

    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

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

    class Meta:
        verbose_name = _("Support Request")
        verbose_name_plural = _("Support Requests")
        ordering = ["-created_at"]

    def __str__(self):
        return f"Support Request: {self.subject} ({self.get_status_display()})"

    def mark_as_resolved(self):
        """Mark the support request as resolved."""
        from django.utils import timezone

        self.status = "resolved"
        self.resolved_at = timezone.now()
        self.save()
