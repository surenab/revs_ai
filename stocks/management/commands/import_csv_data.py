"""
Management command to import stock data from CSV/TXT files.
This command reads tick data from CSV files and imports it into the StockTick model.
"""

import csv
import logging
import os
from datetime import datetime
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from stocks.models import Stock, StockTick

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Import stock data from CSV/TXT files from given directories"

    def add_arguments(self, parser):
        parser.add_argument(
            "--paths",
            type=str,
            nargs="+",
            help="One or more directory paths containing CSV/TXT files",
        )
        parser.add_argument(
            "--default-paths",
            action="store_true",
            help="Use default paths: /Users/haykrevazyan/Projects/data_research/data/5 min/us/nasdaq stocks/1/, 2/, 3/",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=1000,
            help="Number of records to process in each batch (default: 1000)",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force update even if data already exists",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be done without actually importing data",
        )
        parser.add_argument(
            "--create-stocks",
            action="store_true",
            help="Create Stock objects if they don't exist (default: False, will skip missing stocks)",
        )

    def handle(self, *args, **options):
        start_time = timezone.now()
        self.stdout.write(f"Starting CSV data import at {start_time}")

        # Determine which paths to use
        if options["default_paths"]:
            base_path = "/Users/haykrevazyan/Projects/data_research/data/5 min/us/nasdaq stocks"
            paths = [
                os.path.join(base_path, "1"),
                os.path.join(base_path, "2"),
                os.path.join(base_path, "3"),
            ]
        elif options["paths"]:
            paths = options["paths"]
        else:
            msg = "Specify --paths or use --default-paths"
            raise CommandError(msg)

        # Validate paths
        valid_paths = []
        for path in paths:
            if not os.path.exists(path):
                self.stdout.write(
                    self.style.WARNING(f"Path does not exist: {path}, skipping")
                )
                continue
            if not os.path.isdir(path):
                self.stdout.write(
                    self.style.WARNING(f"Path is not a directory: {path}, skipping")
                )
                continue
            valid_paths.append(path)

        if not valid_paths:
            msg = "No valid paths found"
            raise CommandError(msg)

        self.stdout.write(f"Processing {len(valid_paths)} directory(ies)")

        # Process each directory
        total_files = 0
        total_records = 0
        success_files = 0
        error_files = 0
        created_stocks = 0

        for path in valid_paths:
            self.stdout.write(f"\nProcessing directory: {path}")
            files_processed, records_processed, stocks_created, errors = (
                self._process_directory(
                    path,
                    batch_size=options["batch_size"],
                    force=options["force"],
                    dry_run=options["dry_run"],
                    create_stocks=options["create_stocks"],
                )
            )
            total_files += files_processed
            total_records += records_processed
            created_stocks += stocks_created
            success_files += files_processed - errors
            error_files += errors

        # Summary
        end_time = timezone.now()
        duration = end_time - start_time

        self.stdout.write("\n" + "=" * 50)
        self.stdout.write(f"Import completed in {duration}")
        self.stdout.write(f"Total files processed: {total_files}")
        self.stdout.write(f"Successfully processed: {success_files}")
        self.stdout.write(f"Files with errors: {error_files}")
        self.stdout.write(f"Total records imported: {total_records}")
        self.stdout.write(f"Stocks created: {created_stocks}")

        if error_files > 0:
            self.stdout.write(
                self.style.WARNING(
                    f"Completed with {error_files} file errors. Check logs for details."
                )
            )
        else:
            self.stdout.write(self.style.SUCCESS("All files processed successfully!"))

    def _process_directory(
        self, directory_path, batch_size=1000, force=False, dry_run=False, create_stocks=False
    ):
        """Process all CSV/TXT files in a directory."""
        files_processed = 0
        records_processed = 0
        stocks_created = 0
        error_count = 0

        # Find all CSV and TXT files
        csv_files = []
        for ext in ["*.csv", "*.txt", "*.CSV", "*.TXT"]:
            csv_files.extend(Path(directory_path).glob(ext))

        if not csv_files:
            self.stdout.write(
                self.style.WARNING(f"No CSV/TXT files found in {directory_path}")
            )
            return files_processed, records_processed, stocks_created, error_count

        self.stdout.write(f"Found {len(csv_files)} file(s) to process")

        for file_path in csv_files:
            try:
                self.stdout.write(f"Processing file: {file_path.name}")
                records, stocks_count = self._process_file(
                    file_path,
                    batch_size=batch_size,
                    force=force,
                    dry_run=dry_run,
                    create_stocks=create_stocks,
                )
                records_processed += records
                stocks_created += stocks_count
                files_processed += 1
                if dry_run:
                    self.stdout.write(
                        f"  [DRY RUN] {file_path.name}: would import {records} records"
                    )
                else:
                    self.stdout.write(
                        f"  ✓ {file_path.name}: {records} records imported"
                    )
            except Exception as e:
                error_count += 1
                logger.exception("Error processing file %s", file_path)
                self.stdout.write(
                    self.style.ERROR(f"  ✗ {file_path.name}: {e!s}")
                )

        return files_processed, records_processed, stocks_created, error_count

    def _process_file(
        self, file_path, batch_size=1000, force=False, dry_run=False, create_stocks=False
    ):
        """Process a single CSV/TXT file."""
        records_imported = 0
        stocks_created_count = 0

        with open(file_path, "r", encoding="utf-8") as f:
            # Try to detect delimiter
            sample = f.read(1024)
            f.seek(0)
            sniffer = csv.Sniffer()
            delimiter = sniffer.sniff(sample).delimiter

            reader = csv.DictReader(f, delimiter=delimiter)

            # Verify header
            expected_headers = [
                "<TICKER>",
                "<PER>",
                "<DATE>",
                "<TIME>",
                "<OPEN>",
                "<HIGH>",
                "<LOW>",
                "<CLOSE>",
                "<VOL>",
                "<OPENINT>",
            ]

            # Check if headers match (case-insensitive)
            actual_headers = [h.strip() for h in reader.fieldnames or []]
            expected_headers_lower = [h.lower() for h in expected_headers]

            if not actual_headers:
                msg = f"File {file_path} has no headers"
                raise CommandError(msg)

            # Normalize headers for comparison
            actual_headers_normalized = [
                h.replace("<", "").replace(">", "").lower() for h in actual_headers
            ]
            expected_normalized = [
                h.replace("<", "").replace(">", "").lower() for h in expected_headers
            ]

            if set(actual_headers_normalized) != set(expected_normalized):
                self.stdout.write(
                    self.style.WARNING(
                        f"  Warning: Header mismatch in {file_path.name}. "
                        f"Expected: {expected_headers}, Got: {actual_headers}"
                    )
                )

            # Process rows
            batch = []
            for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
                try:
                    # Extract and clean ticker
                    ticker = row.get("<TICKER>", "").strip()
                    if not ticker:
                        continue

                    # Remove .US postfix
                    if ticker.endswith(".US"):
                        ticker = ticker[:-3]

                    # Parse other fields
                    date_str = row.get("<DATE>", "").strip()
                    time_str = row.get("<TIME>", "").strip()
                    open_price = row.get("<OPEN>", "").strip()
                    high_price = row.get("<HIGH>", "").strip()
                    low_price = row.get("<LOW>", "").strip()
                    close_price = row.get("<CLOSE>", "").strip()
                    volume = row.get("<VOL>", "").strip()

                    # Validate required fields
                    if not all([date_str, time_str, open_price, high_price, low_price, close_price]):
                        continue

                    # Parse date and time
                    # DATE format: YYYYMMDD (e.g., 20250522)
                    # TIME format: HHMMSS (e.g., 160000)
                    try:
                        date_obj = datetime.strptime(date_str, "%Y%m%d").date()  # noqa: DTZ007
                        time_obj = datetime.strptime(time_str, "%H%M%S").time()  # noqa: DTZ007
                        timestamp = timezone.make_aware(
                            datetime.combine(date_obj, time_obj)  # noqa: DTZ007
                        )
                    except ValueError as e:
                        logger.warning(
                            f"Invalid date/time format in {file_path.name} row {row_num}: {date_str} {time_str}"
                        )
                        continue

                    # Parse prices and volume
                    try:
                        open_val = float(open_price)
                        high_val = float(high_price)
                        low_val = float(low_price)
                        close_val = float(close_price)
                        vol_val = int(float(volume)) if volume else 0
                    except (ValueError, TypeError):
                        logger.warning(
                            f"Invalid numeric values in {file_path.name} row {row_num}"
                        )
                        continue

                    # Get or create stock
                    stock, was_created = self._get_or_create_stock(
                        ticker, create=create_stocks, dry_run=dry_run
                    )
                    if not stock:
                        continue
                    if was_created:
                        stocks_created_count += 1

                    if stock:
                        if not dry_run:
                            # Create StockTick record
                            # Use close price as the tick price
                            batch.append(
                                StockTick(
                                    stock=stock,
                                    timestamp=timestamp,
                                    price=close_val,
                                    volume=vol_val,
                                    is_market_hours=True,  # Default to market hours
                                )
                            )
                        else:
                            # In dry run, just count the record
                            records_imported += 1

                    # Bulk create when batch is full
                    if not dry_run and len(batch) >= batch_size:
                        records_imported += self._bulk_create_stock_ticks(
                            batch, force=force
                        )
                        batch = []

                except Exception as e:
                    logger.warning(
                        f"Error processing row {row_num} in {file_path.name}: {e}"
                    )
                    continue

            # Process remaining batch
            if batch and not dry_run:
                records_imported += self._bulk_create_stock_ticks(batch, force=force)

        return records_imported, stocks_created_count

    def _get_or_create_stock(self, symbol, create=False, dry_run=False):
        """Get or create a Stock object. Returns (stock, was_created)."""
        try:
            stock = Stock.objects.get(symbol=symbol.upper())
            return stock, False
        except Stock.DoesNotExist:
            if create and not dry_run:
                # Create a basic stock record
                stock = Stock.objects.create(
                    symbol=symbol.upper(),
                    name=symbol.upper(),
                    exchange="NASDAQ",
                    is_active=True,
                )
                self.stdout.write(f"  Created stock: {symbol.upper()}")
                return stock, True
            elif create and dry_run:
                self.stdout.write(f"  [DRY RUN] Would create stock: {symbol.upper()}")
                return None, True
            else:
                logger.warning(f"Stock {symbol} not found and --create-stocks not set")
                return None, False

    def _bulk_create_stock_ticks(self, stock_ticks, force=False):
        """Bulk create StockTick records."""
        if not stock_ticks:
            return 0

        try:
            with transaction.atomic():
                if force:
                    # Delete existing records for the same stock/timestamp
                    # Note: StockTick doesn't have unique constraint, so we delete by stock and timestamp
                    for tick in stock_ticks:
                        StockTick.objects.filter(
                            stock=tick.stock,
                            timestamp=tick.timestamp,
                        ).delete()

                # Use bulk_create with ignore_conflicts to handle duplicates
                # Since StockTick doesn't have a unique constraint, we'll use ignore_conflicts
                # to skip any exact duplicates
                created = StockTick.objects.bulk_create(
                    stock_ticks,
                    batch_size=1000,
                    ignore_conflicts=True,
                )
                return len(created)
        except Exception as e:
            logger.exception("Error bulk creating stock ticks")
            raise

