"""
Management command to fix orders stuck in 'in_progress' status.
Orders that have been executed (have executed_price and executed_at) but are
still in 'in_progress' status will be updated to 'done' status.
"""

import logging

from django.core.management.base import BaseCommand
from django.db import transaction

from stocks.models import Order

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Fix orders stuck in 'in_progress' status"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help=("Show what would be fixed without making changes"),
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help=("Force update all in_progress orders to done (use with caution)"),
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        force = options["force"]

        # Find orders stuck in in_progress status
        stuck_orders = Order.objects.filter(status="in_progress")

        if not stuck_orders.exists():
            self.stdout.write(
                self.style.SUCCESS("No orders found stuck in 'in_progress' status.")
            )
            return

        self.stdout.write(
            f"Found {stuck_orders.count()} order(s) in 'in_progress' status"
        )

        # Filter orders that have been executed
        # (have executed_price and executed_at)
        executed_but_stuck = stuck_orders.filter(
            executed_price__isnull=False, executed_at__isnull=False
        )

        if not executed_but_stuck.exists() and not force:
            self.stdout.write(
                self.style.WARNING(
                    "No executed orders found stuck in 'in_progress'. "
                    "Use --force to update all in_progress orders."
                )
            )
            return

        orders_to_fix = executed_but_stuck if not force else stuck_orders

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"DRY RUN: Would fix {orders_to_fix.count()} order(s)"
                )
            )
            for order in orders_to_fix:
                self.stdout.write(
                    f"  - Order {order.id}: {order.stock.symbol} "
                    f"({order.get_transaction_type_display()}) - "
                    f"Executed at: {order.executed_at}"
                )
            return

        # Fix the stuck orders
        fixed_count = 0
        with transaction.atomic():
            for order in orders_to_fix:
                try:
                    order.status = "done"
                    order.save(update_fields=["status"])
                    fixed_count += 1
                    logger.info(
                        f"Fixed stuck order {order.id}: "
                        f"{order.stock.symbol} - "
                        f"{order.get_transaction_type_display()}"
                    )
                except Exception as e:
                    logger.exception(f"Error fixing order {order.id}")
                    self.stdout.write(
                        self.style.ERROR(f"Error fixing order {order.id}: {e}")
                    )

        self.stdout.write(
            self.style.SUCCESS(f"Successfully fixed {fixed_count} stuck order(s)")
        )
