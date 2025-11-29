"""
Management command to set up periodic tasks for stock data synchronization.
"""
from django.core.management.base import BaseCommand
from django_celery_beat.models import PeriodicTask, IntervalSchedule, CrontabSchedule
import json


class Command(BaseCommand):
    help = 'Set up periodic tasks for stock data synchronization'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing periodic tasks before creating new ones',
        )

    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write("Clearing existing periodic tasks...")
            PeriodicTask.objects.filter(
                name__startswith='Stock Data:'
            ).delete()
            self.stdout.write(self.style.SUCCESS("✓ Cleared existing tasks"))

        self.stdout.write("Setting up periodic tasks for stock data synchronization...")

        # Create schedules
        hourly_schedule, created = IntervalSchedule.objects.get_or_create(
            every=1,
            period=IntervalSchedule.HOURS,
        )

        # Market open schedule (9:30 AM EST, Monday-Friday)
        market_open_schedule, created = CrontabSchedule.objects.get_or_create(
            minute=30,
            hour=9,
            day_of_week='1,2,3,4,5',  # Monday to Friday
            day_of_month='*',
            month_of_year='*',
            timezone='America/New_York'
        )

        # Market close schedule (4:00 PM EST, Monday-Friday)
        market_close_schedule, created = CrontabSchedule.objects.get_or_create(
            minute=0,
            hour=16,
            day_of_week='1,2,3,4,5',  # Monday to Friday
            day_of_month='*',
            month_of_year='*',
            timezone='America/New_York'
        )

        # Midday schedule (12:00 PM EST, Monday-Friday)
        midday_schedule, created = CrontabSchedule.objects.get_or_create(
            minute=0,
            hour=12,
            day_of_week='1,2,3,4,5',  # Monday to Friday
            day_of_month='*',
            month_of_year='*',
            timezone='America/New_York'
        )

        # After market close schedule (4:30 PM EST, Monday-Friday)
        after_market_close_schedule, created = CrontabSchedule.objects.get_or_create(
            minute=30,
            hour=16,
            day_of_week='1,2,3,4,5',  # Monday to Friday
            day_of_month='*',
            month_of_year='*',
            timezone='America/New_York'
        )

        # Later after market close schedule (5:00 PM EST, Monday-Friday) for intraday sync
        late_after_market_schedule, created = CrontabSchedule.objects.get_or_create(
            minute=0,
            hour=17,
            day_of_week='1,2,3,4,5',  # Monday to Friday
            day_of_month='*',
            month_of_year='*',
            timezone='America/New_York'
        )

        # Create periodic tasks
        tasks = [
            {
                'name': 'Stock Data: Market Open Tick Recording',
                'task': 'stocks.tasks.start_market_tick_recording',
                'schedule': market_open_schedule,
                'args': json.dumps([]),
                'kwargs': json.dumps({}),
                'description': 'Start recording tick price changes at market open (9:30 AM EST)'
            },
            {
                'name': 'Stock Data: Daily Price Sync',
                'task': 'stocks.tasks.sync_daily_stock_prices',
                'schedule': after_market_close_schedule,
                'args': json.dumps([]),
                'kwargs': json.dumps({}),
                'description': 'Sync daily stock prices after market close (4:30 PM EST)'
            },
            {
                'name': 'Stock Data: Daily Intraday Sync',
                'task': 'stocks.tasks.sync_daily_intraday_prices',
                'schedule': late_after_market_schedule,
                'args': json.dumps([]),
                'kwargs': json.dumps({}),
                'description': 'Sync intraday prices for current day after market close (5:00 PM EST)'
            },
        ]

        created_count = 0
        for task_config in tasks:
            task, created = PeriodicTask.objects.get_or_create(
                name=task_config['name'],
                defaults={
                    'task': task_config['task'],
                    'interval': task_config.get('schedule') if isinstance(task_config['schedule'], IntervalSchedule) else None,
                    'crontab': task_config.get('schedule') if isinstance(task_config['schedule'], CrontabSchedule) else None,
                    'args': task_config['args'],
                    'kwargs': task_config['kwargs'],
                    'enabled': True,
                }
            )

            if created:
                created_count += 1
                self.stdout.write(f"✓ Created: {task_config['name']}")
            else:
                self.stdout.write(f"• Exists: {task_config['name']}")

        self.stdout.write(f"\n{self.style.SUCCESS('Setup completed!')}")
        self.stdout.write(f"Created {created_count} new periodic tasks")
        self.stdout.write(f"Total active tasks: {PeriodicTask.objects.filter(enabled=True, name__startswith='Stock Data:').count()}")

        self.stdout.write(f"\n{self.style.WARNING('Next steps:')}")
        self.stdout.write("1. Start Redis: redis-server")
        self.stdout.write("2. Start Celery services: ./scripts/start-celery.sh")
        self.stdout.write("3. Monitor tasks in Django admin or Celery logs")

        self.stdout.write(f"\n{self.style.SUCCESS('Background jobs are now configured!')}")
