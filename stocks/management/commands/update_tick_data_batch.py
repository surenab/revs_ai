"""
Management command to update tick data for current day for all stock symbols together.
Uses batch processing to efficiently fetch and store tick data.
"""

import logging
from datetime import datetime
from datetime import time as dt_time

import pytz
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from stocks.models import Stock, StockTick
from stocks.services import yahoo_finance_service
from stocks.tasks import is_market_open

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Update tick data for current day for all active stock symbols using batch processing"

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=50,
            help="Number of symbols to process in each batch (default: 50)",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Limit the number of stocks to process (useful for testing)",
        )
        parser.add_argument(
            "--skip-existing",
            action="store_true",
            help="Skip stocks that already have tick data for today",
        )
        parser.add_argument(
            "--force-market-hours",
            action="store_true",
            help="Force update even if market is closed",
        )

    def handle(self, *args, **options):
        batch_size = options["batch_size"]
        limit = options["limit"]
        skip_existing = options["skip_existing"]
        force_market_hours = options["force_market_hours"]

        self.stdout.write(self.style.WARNING("=" * 60))
        self.stdout.write(self.style.WARNING("Batch Update Tick Data for Current Day"))
        self.stdout.write(self.style.WARNING("=" * 60))

        # Check market hours
        market_open = is_market_open()
        if not market_open and not force_market_hours:
            self.stdout.write(
                self.style.WARNING(
                    "\n⚠ Market is currently closed. Use --force-market-hours to update anyway.\n"
                )
            )
            return

        # Get current date (today in Eastern timezone)
        eastern = pytz.timezone("America/New_York")
        now_eastern = timezone.now().astimezone(eastern)
        eastern.localize(datetime.combine(now_eastern.date(), dt_time.min))
        eastern.localize(datetime.combine(now_eastern.date(), dt_time.max))

        self.stdout.write(f"\nDate: {now_eastern.date()}")
        self.stdout.write(f"Market Status: {'Open' if market_open else 'Closed'}")
        self.stdout.write(f"Batch Size: {batch_size}")

        # Get all active stocks
        stocks = Stock.objects.filter(is_active=True).order_by("symbol")

        if limit:
            stocks = stocks[:limit]
            self.stdout.write(f"Processing limited to: {limit} stocks")

        total_stocks = stocks.count()
        self.stdout.write(f"Total active stocks: {total_stocks}\n")

        if total_stocks == 0:
            self.stdout.write(self.style.WARNING("No active stocks found."))
            return

        # Track failed symbols for reporting
        failed_symbols = {}

        # Filter out stocks with existing tick data if requested
        if skip_existing:
            stocks_with_ticks = (
                StockTick.objects.filter(timestamp__date=now_eastern.date())
                .values_list("stock_id", flat=True)
                .distinct()
            )

            stocks = stocks.exclude(id__in=stocks_with_ticks)
            skipped_count = total_stocks - stocks.count()
            if skipped_count > 0:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Skipping {skipped_count} stocks with existing tick data for today"
                    )
                )
                self.stdout.write(f"Remaining stocks to process: {stocks.count()}\n")

        # Process stocks in batches
        stocks_list = list(stocks)
        total_batches = (len(stocks_list) + batch_size - 1) // batch_size

        successful_updates = 0
        failed_updates = 0
        total_ticks_created = 0

        self.stdout.write(
            f"Processing {len(stocks_list)} stocks in {total_batches} batches...\n"
        )

        for batch_num in range(0, len(stocks_list), batch_size):
            batch_stocks = stocks_list[batch_num : batch_num + batch_size]
            batch_symbols = [stock.symbol for stock in batch_stocks]
            current_batch = (batch_num // batch_size) + 1

            self.stdout.write(
                f"Batch {current_batch}/{total_batches}: Processing {len(batch_symbols)} symbols...",
                ending=" ",
            )

            try:
                # Batch fetch quotes for all symbols in this batch
                quotes_data = yahoo_finance_service.get_multiple_current_quotes(
                    batch_symbols
                )

                # Create tick records for this batch
                ticks_to_create = []
                batch_successful = 0
                batch_failed = 0

                for stock in batch_stocks:
                    symbol = stock.symbol
                    quote_data = quotes_data.get(symbol)

                    if not quote_data:
                        batch_failed += 1
                        failed_symbols[symbol] = "No quote data available"
                        continue

                    try:
                        # Validate price data
                        price = quote_data.get("price")
                        if not price or price <= 0:
                            batch_failed += 1
                            failed_symbols[symbol] = f"Invalid price: {price}"
                            continue

                        # Parse timestamp from quote data
                        if "timestamp" in quote_data:
                            try:
                                tick_timestamp = datetime.strptime(  # noqa: DTZ007
                                    quote_data["timestamp"], "%Y-%m-%d %H:%M:%S"
                                )
                                # Make timezone aware
                                tick_timestamp = eastern.localize(tick_timestamp)
                            except (ValueError, TypeError):
                                tick_timestamp = timezone.now()
                        else:
                            tick_timestamp = timezone.now()

                        # Only create tick if it's for today
                        if tick_timestamp.date() != now_eastern.date():
                            batch_failed += 1
                            failed_symbols[symbol] = (
                                f"Timestamp not for today: {tick_timestamp.date()}"
                            )
                            continue

                        # Determine if market hours
                        tick_is_market_hours = (
                            is_market_open() if not force_market_hours else True
                        )

                        # Validate volume (can be 0, but should be a number)
                        volume = quote_data.get("volume", 0)
                        if volume is None:
                            volume = 0

                        # Create tick record
                        tick = StockTick(
                            stock=stock,
                            price=float(price),
                            volume=int(volume) if volume else 0,
                            bid_price=quote_data.get("bid")
                            if quote_data.get("bid")
                            else None,
                            ask_price=quote_data.get("ask")
                            if quote_data.get("ask")
                            else None,
                            bid_size=quote_data.get("bid_size")
                            if quote_data.get("bid_size")
                            else None,
                            ask_size=quote_data.get("ask_size")
                            if quote_data.get("ask_size")
                            else None,
                            timestamp=tick_timestamp,
                            is_market_hours=tick_is_market_hours,
                        )
                        ticks_to_create.append(tick)
                        batch_successful += 1

                    except (ValueError, TypeError) as e:
                        logger.exception("Error creating tick for %s", symbol)
                        batch_failed += 1
                        failed_symbols[symbol] = f"Data validation error: {e!s}"
                    except Exception as e:
                        logger.exception("Error creating tick for %s", symbol)
                        batch_failed += 1
                        failed_symbols[symbol] = f"Unexpected error: {e!s}"

                # Bulk create ticks for this batch
                if ticks_to_create:
                    try:
                        with transaction.atomic():
                            StockTick.objects.bulk_create(
                                ticks_to_create,
                                ignore_conflicts=True,  # Skip duplicates
                            )
                        total_ticks_created += len(ticks_to_create)
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"✓ Created {len(ticks_to_create)} ticks ({batch_successful} success, {batch_failed} failed)"
                            )
                        )
                    except Exception as e:
                        logger.exception("Error bulk creating ticks for batch")
                        self.stdout.write(
                            self.style.ERROR(f"✗ Error creating ticks: {e}")
                        )
                        batch_failed += len(ticks_to_create)
                else:
                    self.stdout.write(
                        self.style.WARNING(f"No ticks created ({batch_failed} failed)")
                    )

                successful_updates += batch_successful
                failed_updates += batch_failed

            except (ValueError, TypeError, KeyError, AttributeError, OSError) as e:
                self.stdout.write(self.style.ERROR(f"✗ Batch failed: {e}"))
                failed_updates += len(batch_symbols)
            except Exception as e:  # noqa: BLE001
                # Catch-all for unexpected errors to ensure batch processing continues
                self.stdout.write(self.style.ERROR(f"✗ Batch failed: {e}"))
                failed_updates += len(batch_symbols)

        # Final summary
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.SUCCESS("Batch Update Complete"))
        self.stdout.write("=" * 60)
        self.stdout.write(f"Total stocks processed: {total_stocks}")
        self.stdout.write(
            self.style.SUCCESS(f"Successful updates: {successful_updates}")
        )
        self.stdout.write(self.style.ERROR(f"Failed updates: {failed_updates}"))
        self.stdout.write(
            self.style.SUCCESS(f"Total ticks created: {total_ticks_created}")
        )

        # Show failed symbols summary if any
        if failed_symbols:
            self.stdout.write(f"\nFailed symbols ({len(failed_symbols)}):")
            # Group by error type
            error_groups = {}
            for symbol, error in failed_symbols.items():
                error_type = error.split(":")[0] if ":" in error else error
                if error_type not in error_groups:
                    error_groups[error_type] = []
                error_groups[error_type].append(symbol)

            for error_type, symbols in error_groups.items():
                self.stdout.write(f"  {error_type}: {len(symbols)} symbols")
                if len(symbols) <= 10:
                    self.stdout.write(f"    {', '.join(symbols)}")
                else:
                    self.stdout.write(
                        f"    {', '.join(symbols[:10])}... and {len(symbols) - 10} more"
                    )

        # Show tick data statistics for today
        today_ticks_count = StockTick.objects.filter(
            timestamp__date=now_eastern.date()
        ).count()
        unique_stocks_with_ticks = (
            StockTick.objects.filter(timestamp__date=now_eastern.date())
            .values("stock")
            .distinct()
            .count()
        )

        self.stdout.write("\nToday's tick data statistics:")
        self.stdout.write(f"  Total ticks: {today_ticks_count}")
        self.stdout.write(f"  Unique stocks: {unique_stocks_with_ticks}")

        self.stdout.write(self.style.SUCCESS("\n✓ Operation completed successfully!"))
