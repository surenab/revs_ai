"""
Management command to run a bot simulation.

Usage:
    python manage.py run_simulation <simulation_id>
    python manage.py run_simulation <simulation_id> --async  # Use Celery if available
    python manage.py run_simulation <simulation_id> --threads 8  # Use 8 parallel threads
    python manage.py run_simulation <simulation_id> --threads 1  # Sequential execution
"""

from django.core.management.base import BaseCommand, CommandError

from bot_simulations.models import BotSimulationRun
from bot_simulations.tasks import run_bot_simulation


class Command(BaseCommand):
    help = "Run a bot simulation by ID"

    def add_arguments(self, parser):
        parser.add_argument(
            "simulation_id",
            type=str,
            help="UUID of the simulation to run",
        )
        parser.add_argument(
            "--async",
            action="store_true",
            help="Run simulation asynchronously using Celery (if available)",
        )
        parser.add_argument(
            "--threads",
            type=int,
            default=4,
            help="Number of parallel threads for synchronous execution (default: 4). Use 1 for sequential execution.",
        )

    def handle(self, *args, **options):
        simulation_id = options["simulation_id"]
        use_async = options["async"]

        try:
            simulation_run = BotSimulationRun.objects.get(id=simulation_id)
        except BotSimulationRun.DoesNotExist as e:
            msg = f"Simulation {simulation_id} not found"
            raise CommandError(msg) from e

        if simulation_run.status not in ["pending", "paused"]:
            msg = (
                f"Simulation is {simulation_run.status}, cannot start. "
                "Only pending or paused simulations can be started."
            )
            raise CommandError(msg)

        self.stdout.write(
            self.style.SUCCESS(f"Starting simulation: {simulation_run.name}")
        )

        if use_async:
            # Try to use Celery
            try:
                from bot_simulations.tasks import run_bot_simulation_task

                run_bot_simulation_task.delay(str(simulation_run.id))
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Simulation task queued in Celery: {simulation_run.id}"
                    )
                )
            except (ConnectionError, TimeoutError, OSError, RuntimeError) as e:
                # Celery connection errors (Redis not running, network issues, etc.)
                self.stdout.write(
                    self.style.WARNING(
                        f"Failed to queue Celery task (Redis may not be running): {e}"
                    )
                )
                self.stdout.write(
                    self.style.WARNING("Falling back to synchronous execution...")
                )
                # Fall through to synchronous execution
                use_async = False

        if not use_async:
            # Run synchronously
            num_threads = options.get("threads", 4)
            self.stdout.write(
                f"Running simulation synchronously with {num_threads} thread(s)..."
            )
            try:
                result = run_bot_simulation(
                    str(simulation_run.id), max_workers=num_threads
                )
                if result.get("status") == "completed":
                    self.stdout.write(
                        self.style.SUCCESS("Simulation completed successfully!")
                    )
                elif result.get("status") == "paused":
                    self.stdout.write(self.style.WARNING("Simulation was paused"))
                elif result.get("status") == "cancelled":
                    self.stdout.write(self.style.WARNING("Simulation was cancelled"))
                else:
                    self.stdout.write(
                        self.style.ERROR(
                            f"Simulation failed: {result.get('message', 'Unknown error')}"
                        )
                    )
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error running simulation: {e}"))
                msg = f"Simulation failed: {e}"
                raise CommandError(msg) from e
