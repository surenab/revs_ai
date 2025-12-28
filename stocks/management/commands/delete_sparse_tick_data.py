"""
Management command to delete stock tick data for days with less than 10 ticks.
This command identifies days with insufficient tick data and removes all ticks for those days.
"""

import logging

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Count

from stocks.models import Stock, StockTick

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Delete stock tick data for days with less than 10 ticks"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without actually deleting",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Skip confirmation prompt",
        )
        parser.add_argument(
            "--min-ticks",
            type=int,
            default=10,
            help="Minimum number of ticks per day required to keep the data (default: 10)",
        )
        parser.add_argument(
            "--stock-symbol",
            type=str,
            help="Process only a specific stock symbol (optional)",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        force = options["force"]
        min_ticks = options["min_ticks"]
        stock_symbol = options.get("stock_symbol")

        self.stdout.write(self.style.WARNING("=" * 60))
        self.stdout.write(
            self.style.WARNING(
                f"Deleting Stock Tick Data for Days with Less Than {min_ticks} Ticks"
            )
        )
        self.stdout.write(self.style.WARNING("=" * 60))

        if dry_run:
            self.stdout.write(
                self.style.WARNING("\nDRY RUN MODE - No data will be deleted\n")
            )

        # Get stocks to process
        if stock_symbol:
            stocks = Stock.objects.filter(symbol=stock_symbol.upper())
            if not stocks.exists():
                msg = f"Stock with symbol '{stock_symbol}' not found"
                raise CommandError(msg)
            self.stdout.write(f"Processing stock: {stock_symbol.upper()}")
        else:
            stocks = Stock.objects.all()
            self.stdout.write("Processing all stocks")

        total_stocks = stocks.count()
        self.stdout.write(f"Total stocks to process: {total_stocks}")

        if total_stocks == 0:
            self.stdout.write(self.style.SUCCESS("\n✓ No stocks found to process."))
            return

        # Process each stock
        total_days_deleted = 0
        total_ticks_deleted = 0
        stocks_processed = 0

        for stock in stocks:
            try:
                days_deleted, ticks_deleted = self._process_stock(
                    stock, min_ticks, dry_run
                )
                total_days_deleted += days_deleted
                total_ticks_deleted += ticks_deleted
                stocks_processed += 1

                if days_deleted > 0:
                    self.stdout.write(
                        f"  {stock.symbol}: {days_deleted} days, {ticks_deleted} ticks"
                    )

                if stocks_processed % 100 == 0:
                    self.stdout.write(
                        f"Processed {stocks_processed}/{total_stocks} stocks..."
                    )
            except Exception as e:
                logger.exception(f"Error processing stock {stock.symbol}")
                self.stdout.write(
                    self.style.ERROR(f"  ✗ Error processing {stock.symbol}: {e!s}")
                )

        # Summary
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write("Summary:")
        self.stdout.write(f"  Stocks processed: {stocks_processed}")
        self.stdout.write(f"  Days with sparse data: {total_days_deleted}")
        self.stdout.write(f"  Total ticks to delete: {total_ticks_deleted}")

        if total_ticks_deleted == 0:
            self.stdout.write(self.style.SUCCESS("\n✓ No sparse tick data found."))
            return

        # Confirmation
        if not force and not dry_run:
            confirm = input(
                f"\nAre you sure you want to delete {total_ticks_deleted} ticks "
                f"from {total_days_deleted} days? (yes/no): "
            )
            if confirm.lower() not in ["yes", "y"]:
                self.stdout.write(self.style.WARNING("Operation cancelled."))
                return

        # Delete ticks
        if not dry_run:
            try:
                with transaction.atomic():
                    deleted_count = self._delete_sparse_ticks(stocks, min_ticks)
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"\n✓ Successfully deleted {deleted_count} ticks "
                            f"from {total_days_deleted} days."
                        )
                    )
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"\n✗ Error deleting ticks: {e!s}"))
                msg = f"Failed to delete ticks: {e!s}"
                raise CommandError(msg) from e
        else:
            self.stdout.write(
                self.style.WARNING(
                    f"\n[DRY RUN] Would delete {total_ticks_deleted} ticks "
                    f"from {total_days_deleted} days."
                )
            )

        # Final statistics
        remaining_ticks = StockTick.objects.count()
        self.stdout.write(f"\nRemaining ticks in database: {remaining_ticks}")
        self.stdout.write(self.style.SUCCESS("Operation completed successfully!"))

    def _process_stock(self, stock, min_ticks, dry_run):
        """
        Process a single stock and identify days with sparse tick data.

        Returns:
            tuple: (number of days to delete, number of ticks to delete)
        """
        # Get all ticks for this stock, grouped by date
        ticks = StockTick.objects.filter(stock=stock).order_by("timestamp")

        if not ticks.exists():
            return 0, 0

        # Group ticks by date (day)
        # Use TruncDate to group by date part of timestamp
        from django.db.models.functions import TruncDate

        daily_counts = (
            ticks.annotate(date=TruncDate("timestamp"))
            .values("date")
            .annotate(tick_count=Count("id"))
            .filter(tick_count__lt=min_ticks)
            .order_by("date")
        )

        days_to_delete = list(daily_counts.values_list("date", flat=True))
        days_count = len(days_to_delete)

        if days_count == 0:
            return 0, 0

        # Count total ticks for these days
        if days_to_delete:
            ticks_to_delete = ticks.filter(timestamp__date__in=days_to_delete).count()
        else:
            ticks_to_delete = 0

        return days_count, ticks_to_delete

    def _delete_sparse_ticks(self, stocks, min_ticks):
        """
        Delete all ticks for days with less than min_ticks per day.

        Returns:
            int: Number of ticks deleted
        """
        from django.db.models.functions import TruncDate

        deleted_count = 0

        for stock in stocks:
            # Get all ticks for this stock
            ticks = StockTick.objects.filter(stock=stock)

            if not ticks.exists():
                continue

            # Find days with less than min_ticks
            daily_counts = (
                ticks.annotate(date=TruncDate("timestamp"))
                .values("date")
                .annotate(tick_count=Count("id"))
                .filter(tick_count__lt=min_ticks)
            )

            days_to_delete = list(daily_counts.values_list("date", flat=True))

            if days_to_delete:
                # Delete all ticks for these days
                deleted = ticks.filter(timestamp__date__in=days_to_delete).delete()[0]
                deleted_count += deleted

        return deleted_count
