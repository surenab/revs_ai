"""
Comprehensive tests for User API endpoints.
"""

from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.test import TestCase
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient, APITestCase

from .models import User, UserProfile


class UserModelTest(TestCase):
    """Test User and UserProfile models."""

    def setUp(self):
        """Set up test data."""
        self.user_data = {
            "email": "test@example.com",
            "password": "testpass123",
            "first_name": "Test",
            "last_name": "User",
        }

    def test_create_user(self):
        """Test creating a user."""
        user = User.objects.create_user(**self.user_data)

        assert user.email == self.user_data["email"]
        assert user.first_name == self.user_data["first_name"]
        assert user.last_name == self.user_data["last_name"]
        assert user.check_password(self.user_data["password"])
        assert user.is_active
        assert not user.is_staff
        assert not user.is_superuser

    def test_create_superuser(self):
        """Test creating a superuser."""
        user = User.objects.create_superuser(
            email="admin@example.com", password="adminpass123"
        )

        assert user.email == "admin@example.com"
        assert user.is_active
        assert user.is_staff
        assert user.is_superuser

    def test_user_str_method(self):
        """Test user string representation."""
        user = User.objects.create_user(**self.user_data)
        assert str(user) == self.user_data["email"]

    def test_user_full_name(self):
        """Test user full name methods."""
        user = User.objects.create_user(**self.user_data)

        expected_full_name = (
            f"{self.user_data['first_name']} {self.user_data['last_name']}"
        )
        assert user.get_full_name() == expected_full_name
        assert user.full_name == expected_full_name
        assert user.get_short_name() == self.user_data["first_name"]

    def test_user_profile_creation(self):
        """Test that UserProfile is automatically created."""
        user = User.objects.create_user(**self.user_data)

        assert hasattr(user, "profile")
        assert isinstance(user.profile, UserProfile)
        assert user.profile.user == user

    def test_user_profile_str_method(self):
        """Test user profile string representation."""
        user = User.objects.create_user(**self.user_data)
        expected_str = f"{user.email}'s Profile"
        assert str(user.profile) == expected_str


class UserRegistrationAPITest(APITestCase):
    """Test user registration API endpoint."""

    def setUp(self):
        """Set up test client."""
        self.client = APIClient()
        self.register_url = reverse("users:register")
        self.valid_user_data = {
            "email": "newuser@example.com",
            "password": "newpass123",
            "password_confirm": "newpass123",
            "first_name": "New",
            "last_name": "User",
        }

    def test_user_registration_success(self):
        """Test successful user registration."""
        response = self.client.post(self.register_url, self.valid_user_data)

        assert response.status_code == status.HTTP_201_CREATED
        assert "user" in response.data
        assert "token" in response.data
        assert "message" in response.data

        # Check user was created
        assert User.objects.filter(email=self.valid_user_data["email"]).exists()

        # Check token was created
        user = User.objects.get(email=self.valid_user_data["email"])
        assert Token.objects.filter(user=user).exists()

    def test_user_registration_password_mismatch(self):
        """Test registration with password mismatch."""
        data = self.valid_user_data.copy()
        data["password_confirm"] = "differentpass"

        response = self.client.post(self.register_url, data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "password_confirm" in response.data

    def test_user_registration_duplicate_email(self):
        """Test registration with duplicate email."""
        # Create first user
        User.objects.create_user(
            email=self.valid_user_data["email"], password="password123"
        )

        response = self.client.post(self.register_url, self.valid_user_data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_user_registration_invalid_email(self):
        """Test registration with invalid email."""
        data = self.valid_user_data.copy()
        data["email"] = "invalid-email"

        response = self.client.post(self.register_url, data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "email" in response.data

    def test_user_registration_missing_fields(self):
        """Test registration with missing required fields."""
        response = self.client.post(self.register_url, {})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "email" in response.data
        assert "password" in response.data


class UserLoginAPITest(APITestCase):
    """Test user login API endpoint."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.login_url = reverse("users:login")
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
            first_name="Test",
            last_name="User",
        )

    def test_user_login_success(self):
        """Test successful user login."""
        data = {"email": "test@example.com", "password": "testpass123"}

        response = self.client.post(self.login_url, data)

        assert response.status_code == status.HTTP_200_OK
        assert "user" in response.data
        assert "token" in response.data
        assert "message" in response.data

        # Check token was created
        assert Token.objects.filter(user=self.user).exists()

    def test_user_login_invalid_credentials(self):
        """Test login with invalid credentials."""
        data = {"email": "test@example.com", "password": "wrongpassword"}

        response = self.client.post(self.login_url, data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_user_login_inactive_user(self):
        """Test login with inactive user."""
        self.user.is_active = False
        self.user.save()

        data = {"email": "test@example.com", "password": "testpass123"}

        response = self.client.post(self.login_url, data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_user_login_missing_fields(self):
        """Test login with missing fields."""
        response = self.client.post(self.login_url, {})

        assert response.status_code == status.HTTP_400_BAD_REQUEST


class UserLogoutAPITest(APITestCase):
    """Test user logout API endpoint."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.logout_url = reverse("users:logout")
        self.user = User.objects.create_user(
            email="test@example.com", password="testpass123"
        )
        self.token = Token.objects.create(user=self.user)

    def test_user_logout_success(self):
        """Test successful user logout."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        response = self.client.post(self.logout_url)

        assert response.status_code == status.HTTP_200_OK
        assert "message" in response.data

        # Check token was deleted
        assert not Token.objects.filter(user=self.user).exists()

    def test_user_logout_unauthenticated(self):
        """Test logout without authentication."""
        response = self.client.post(self.logout_url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class UserViewSetTest(APITestCase):
    """Test UserViewSet endpoints."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()

        # Create regular user
        self.user = User.objects.create_user(
            email="user@example.com",
            password="userpass123",
            first_name="Regular",
            last_name="User",
        )
        self.user_token = Token.objects.create(user=self.user)

        # Create staff user
        self.staff_user = User.objects.create_user(
            email="staff@example.com",
            password="staffpass123",
            first_name="Staff",
            last_name="User",
            is_staff=True,
        )
        self.staff_token = Token.objects.create(user=self.staff_user)

        # Create admin user
        self.admin_user = User.objects.create_superuser(
            email="admin@example.com",
            password="adminpass123",
            first_name="Admin",
            last_name="User",
        )
        self.admin_token = Token.objects.create(user=self.admin_user)

    def test_user_me_get(self):
        """Test getting current user profile."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.user_token.key}")

        url = reverse("users:user-me")
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["email"] == self.user.email
        assert "profile" in response.data

    def test_user_me_update(self):
        """Test updating current user profile."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.user_token.key}")

        url = reverse("users:user-me")
        data = {
            "first_name": "Updated",
            "bio": "Updated bio",
            "profile": {"company": "Test Company", "job_title": "Developer"},
        }

        response = self.client.patch(url, data, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["user"]["first_name"] == "Updated"

        # Check database was updated
        self.user.refresh_from_db()
        assert self.user.first_name == "Updated"
        assert self.user.bio == "Updated bio"
        assert self.user.profile.company == "Test Company"

    def test_user_me_unauthenticated(self):
        """Test accessing user profile without authentication."""
        url = reverse("users:user-me")
        response = self.client.get(url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_change_password_success(self):
        """Test successful password change."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.user_token.key}")

        url = reverse("users:user-change-password")
        data = {
            "old_password": "userpass123",
            "new_password": "newpass123",
            "new_password_confirm": "newpass123",
        }

        response = self.client.post(url, data)

        assert response.status_code == status.HTTP_200_OK
        assert "message" in response.data

        # Check password was changed
        self.user.refresh_from_db()
        assert self.user.check_password("newpass123")

        # Check token was deleted (user needs to re-login)
        assert not Token.objects.filter(user=self.user).exists()

    def test_change_password_wrong_old_password(self):
        """Test password change with wrong old password."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.user_token.key}")

        url = reverse("users:user-change-password")
        data = {
            "old_password": "wrongpass",
            "new_password": "newpass123",
            "new_password_confirm": "newpass123",
        }

        response = self.client.post(url, data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "old_password" in response.data

    def test_change_password_mismatch(self):
        """Test password change with password mismatch."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.user_token.key}")

        url = reverse("users:user-change-password")
        data = {
            "old_password": "userpass123",
            "new_password": "newpass123",
            "new_password_confirm": "differentpass",
        }

        response = self.client.post(url, data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "new_password_confirm" in response.data

    def test_user_list_staff_only(self):
        """Test that only staff can list users."""
        # Test with regular user
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.user_token.key}")

        url = reverse("users:user-list")
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        # Regular user should only see themselves
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["email"] == self.user.email

    def test_user_list_staff_access(self):
        """Test that staff can list all users."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.staff_token.key}")

        url = reverse("users:user-list")
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        # Staff should see all users
        assert len(response.data["results"]) >= 3

    def test_verify_user_admin_only(self):
        """Test that only admin can verify users."""
        # Test with regular user
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.user_token.key}")

        url = reverse("users:user-verify-user", kwargs={"pk": self.user.pk})
        response = self.client.post(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

        # Test with admin
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.admin_token.key}")

        response = self.client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert "message" in response.data

        # Check user was verified
        self.user.refresh_from_db()
        assert self.user.is_verified

    def test_deactivate_user_admin_only(self):
        """Test that only admin can deactivate users."""
        # Test with regular user
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.user_token.key}")

        url = reverse("users:user-deactivate-user", kwargs={"pk": self.staff_user.pk})
        response = self.client.post(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

        # Test with admin
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.admin_token.key}")

        response = self.client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert "message" in response.data

        # Check user was deactivated
        self.staff_user.refresh_from_db()
        assert not self.staff_user.is_active

        # Check user's tokens were deleted
        assert not Token.objects.filter(user=self.staff_user).exists()


class PasswordResetAPITest(APITestCase):
    """Test password reset API endpoints."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="test@example.com", password="testpass123"
        )
        self.password_reset_url = reverse("users:password_reset")

    def test_password_reset_request_success(self):
        """Test successful password reset request."""
        data = {"email": "test@example.com"}

        response = self.client.post(self.password_reset_url, data)

        assert response.status_code == status.HTTP_200_OK
        assert "message" in response.data

        # Check email was sent
        assert len(mail.outbox) == 1
        assert "Password Reset Request" in mail.outbox[0].subject

    def test_password_reset_request_nonexistent_email(self):
        """Test password reset request with nonexistent email."""
        data = {"email": "nonexistent@example.com"}

        response = self.client.post(self.password_reset_url, data)

        # Should still return success for security reasons
        assert response.status_code == status.HTTP_200_OK

        # But no email should be sent
        assert len(mail.outbox) == 0

    def test_password_reset_confirm_success(self):
        """Test successful password reset confirmation."""
        # Generate token and uid
        token = default_token_generator.make_token(self.user)
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))

        url = reverse(
            "users:password_reset_confirm", kwargs={"uid": uid, "token": token}
        )
        data = {
            "new_password": "newpassword123",
            "new_password_confirm": "newpassword123",
        }

        response = self.client.post(url, data)

        assert response.status_code == status.HTTP_200_OK
        assert "message" in response.data

        # Check password was changed
        self.user.refresh_from_db()
        assert self.user.check_password("newpassword123")

        # Check tokens were deleted
        assert not Token.objects.filter(user=self.user).exists()

    def test_password_reset_confirm_invalid_token(self):
        """Test password reset confirmation with invalid token."""
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))

        url = reverse(
            "users:password_reset_confirm",
            kwargs={"uid": uid, "token": "invalid-token"},
        )
        data = {
            "new_password": "newpassword123",
            "new_password_confirm": "newpassword123",
        }

        response = self.client.post(url, data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in response.data

    def test_password_reset_confirm_password_mismatch(self):
        """Test password reset confirmation with password mismatch."""
        token = default_token_generator.make_token(self.user)
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))

        url = reverse(
            "users:password_reset_confirm", kwargs={"uid": uid, "token": token}
        )
        data = {
            "new_password": "newpassword123",
            "new_password_confirm": "differentpassword",
        }

        response = self.client.post(url, data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "new_password_confirm" in response.data


class UserAPIPermissionsTest(APITestCase):
    """Test API permissions and access control."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()

        self.user1 = User.objects.create_user(
            email="user1@example.com", password="pass123"
        )
        self.user2 = User.objects.create_user(
            email="user2@example.com", password="pass123"
        )

        self.token1 = Token.objects.create(user=self.user1)
        self.token2 = Token.objects.create(user=self.user2)

    def test_user_cannot_access_other_user_detail(self):
        """Test that users cannot access other users' details."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token1.key}")

        url = reverse("users:user-detail", kwargs={"pk": self.user2.pk})
        response = self.client.get(url)

        # Should return 404 because user can only see themselves
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_user_cannot_update_other_user(self):
        """Test that users cannot update other users."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token1.key}")

        url = reverse("users:user-detail", kwargs={"pk": self.user2.pk})
        data = {"first_name": "Hacked"}

        response = self.client.patch(url, data)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_unauthenticated_access_denied(self):
        """Test that unauthenticated users cannot access protected endpoints."""
        endpoints = [
            reverse("users:user-list"),
            reverse("users:user-me"),
            reverse("users:user-change-password"),
        ]

        for endpoint in endpoints:
            response = self.client.get(endpoint)
            assert response.status_code == status.HTTP_401_UNAUTHORIZED


class UserAPIIntegrationTest(APITestCase):
    """Integration tests for complete user workflows."""

    def setUp(self):
        """Set up test client."""
        self.client = APIClient()

    def test_complete_user_registration_and_login_flow(self):
        """Test complete user registration and login workflow."""
        # 1. Register user
        register_data = {
            "email": "integration@example.com",
            "password": "integrationpass123",
            "password_confirm": "integrationpass123",
            "first_name": "Integration",
            "last_name": "Test",
        }

        register_url = reverse("users:register")
        register_response = self.client.post(register_url, register_data)

        assert register_response.status_code == status.HTTP_201_CREATED
        registration_token = register_response.data["token"]

        # 2. Use token to access protected endpoint
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {registration_token}")

        me_url = reverse("users:user-me")
        me_response = self.client.get(me_url)

        assert me_response.status_code == status.HTTP_200_OK
        assert me_response.data["email"] == register_data["email"]

        # 3. Update profile
        update_data = {
            "bio": "Integration test user",
            "profile": {"company": "Test Corp", "job_title": "Tester"},
        }

        update_response = self.client.patch(me_url, update_data, format="json")

        assert update_response.status_code == status.HTTP_200_OK
        assert update_response.data["user"]["bio"] == "Integration test user"

        # 4. Change password
        password_url = reverse("users:user-change-password")
        password_data = {
            "old_password": "integrationpass123",
            "new_password": "newintegrationpass123",
            "new_password_confirm": "newintegrationpass123",
        }

        password_response = self.client.post(password_url, password_data)

        assert password_response.status_code == status.HTTP_200_OK

        # 5. Login with new password (need to clear credentials first)
        self.client.credentials()  # Clear old token

        login_url = reverse("users:login")
        login_data = {
            "email": "integration@example.com",
            "password": "newintegrationpass123",
        }

        login_response = self.client.post(login_url, login_data)

        assert login_response.status_code == status.HTTP_200_OK
        assert "token" in login_response.data

        # 6. Logout
        new_token = login_response.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {new_token}")

        logout_url = reverse("users:logout")
        logout_response = self.client.post(logout_url)

        assert logout_response.status_code == status.HTTP_200_OK

    def test_admin_user_management_workflow(self):
        """Test admin user management workflow."""
        # Create admin user
        admin = User.objects.create_superuser(
            email="admin@example.com", password="adminpass123"
        )
        admin_token = Token.objects.create(user=admin)

        # Create regular user
        user = User.objects.create_user(
            email="regular@example.com", password="regularpass123"
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {admin_token.key}")

        # 1. List all users
        list_url = reverse("users:user-list")
        list_response = self.client.get(list_url)

        assert list_response.status_code == status.HTTP_200_OK
        assert len(list_response.data["results"]) >= 2

        # 2. Verify user
        verify_url = reverse("users:user-verify-user", kwargs={"pk": user.pk})
        verify_response = self.client.post(verify_url)

        assert verify_response.status_code == status.HTTP_200_OK

        user.refresh_from_db()
        assert user.is_verified

        # 3. Deactivate user
        deactivate_url = reverse("users:user-deactivate-user", kwargs={"pk": user.pk})
        deactivate_response = self.client.post(deactivate_url)

        assert deactivate_response.status_code == status.HTTP_200_OK

        user.refresh_from_db()
        assert not user.is_active
