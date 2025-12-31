"""
Management command to fix PeriodicTask entries with invalid schedule dictionaries.
"""

from django.core.management.base import BaseCommand
from django_celery_beat.models import PeriodicTask


class Command(BaseCommand):
    help = "Fix PeriodicTask entries with invalid dictionary schedules"

    def add_arguments(self, parser):
        parser.add_argument(
            "--delete-invalid",
            action="store_true",
            help="Delete PeriodicTask entries with invalid schedules instead of fixing them",
        )

    def handle(self, *args, **options):
        self.stdout.write("Checking for PeriodicTask entries with invalid schedules...")

        # Get all periodic tasks
        all_tasks = PeriodicTask.objects.all()
        fixed_count = 0
        deleted_count = 0
        error_count = 0

        for task in all_tasks:
            try:
                # Try to access the schedule - this will fail if it's a dict
                # We'll catch the error and fix it
                try:
                    # This will raise an error if schedule is invalid
                    _ = task.schedule
                except (AttributeError, TypeError, ValueError) as e:
                    self.stdout.write(
                        self.style.WARNING(
                            f"Found invalid schedule in task: {task.name} - {e!s}"
                        )
                    )

                    if options["delete_invalid"]:
                        task.delete()
                        deleted_count += 1
                        self.stdout.write(self.style.SUCCESS(f"  Deleted: {task.name}"))
                    else:
                        # Try to fix by disabling the task
                        task.enabled = False
                        task.save()
                        fixed_count += 1
                        self.stdout.write(
                            self.style.WARNING(
                                f"  Disabled: {task.name} (please recreate with proper schedule)"
                            )
                        )

            except (ValueError, AttributeError, KeyError, TypeError, OSError) as e:
                error_count += 1
                self.stdout.write(
                    self.style.ERROR(f"Error processing task {task.name}: {e!s}")
                )

        self.stdout.write("\n" + "=" * 50)
        if options["delete_invalid"]:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Deleted {deleted_count} invalid PeriodicTask entries"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Disabled {fixed_count} invalid PeriodicTask entries"
                )
            )
        if error_count > 0:
            self.stdout.write(
                self.style.ERROR(f"Encountered {error_count} errors during processing")
            )

        self.stdout.write("\nNext steps:")
        self.stdout.write("1. Run: python manage.py setup_periodic_tasks --clear")
        self.stdout.write(
            "2. This will recreate all periodic tasks with proper schedules"
        )
        self.stdout.write(
            "3. Restart Celery Beat: celery -A config beat --loglevel=info"
        )
