"""
Management command to import stock data from CSV/TXT files.
This command reads tick data from CSV files and imports it into the StockTick model.
"""

import csv
import logging
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from stocks.models import Stock, StockPrice, StockTick

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
        parser.add_argument(
            "--use-stock-price",
            action="store_true",
            help="Save data to StockPrice model instead of StockTick model (default: False, saves to StockTick)",
        )

    def handle(self, *args, **options):
        start_time = timezone.now()
        self.stdout.write(f"Starting CSV data import at {start_time}")

        # Determine which paths to use
        if options["default_paths"]:
            base_path = (
                "/Users/haykrevazyan/Projects/data_research/data/5 min/us/nasdaq stocks"
            )
            paths = [
                Path(base_path) / "1",
                Path(base_path) / "2",
                Path(base_path) / "3",
            ]
        elif options["paths"]:
            paths = options["paths"]
        else:
            msg = "Specify --paths or use --default-paths"
            raise CommandError(msg)

        # Validate paths
        valid_paths = []
        for path in paths:
            if not Path.exists(path):
                self.stdout.write(
                    self.style.WARNING(f"Path does not exist: {path}, skipping")
                )
                continue
            if not Path.isdir(path):
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
                    use_stock_price=options["use_stock_price"],
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
        self,
        directory_path,
        batch_size=1000,
        force=False,
        dry_run=False,
        create_stocks=False,
        use_stock_price=False,
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
                    use_stock_price=use_stock_price,
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
                self.stdout.write(self.style.ERROR(f"  ✗ {file_path.name}: {e!s}"))

        return files_processed, records_processed, stocks_created, error_count

    def _process_file(
        self,
        file_path,
        batch_size=1000,
        force=False,
        dry_run=False,
        create_stocks=False,
        use_stock_price=False,
    ):
        """
        Process a single CSV/TXT file.
        Assumes each file contains data for only one stock symbol.

        Args:
            use_stock_price: If True, save to StockPrice model; if False, save to StockTick model
        """
        records_imported = 0
        stocks_created_count = 0

        with Path(file_path).open(encoding="utf-8") as f:
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

            # Get stock symbol from first row (each file is for one stock)
            # Try to get stock symbol from filename first (filename might be the ticker)
            filename_without_ext = file_path.stem.upper()
            # Remove common suffixes
            filename_without_ext = filename_without_ext.removesuffix(".US")

            # Read first row to get ticker
            stock_symbol = None
            try:
                first_row = next(reader, None)
                if first_row:
                    ticker = first_row.get("<TICKER>", "").strip()
                    if ticker:
                        # Remove .US postfix
                        ticker = ticker.removesuffix(".US")
                        stock_symbol = ticker.upper()
                    else:
                        # Fallback to filename
                        stock_symbol = filename_without_ext
                else:
                    # Empty file, use filename
                    stock_symbol = filename_without_ext
            except StopIteration:
                # Empty file, use filename
                stock_symbol = filename_without_ext

            if not stock_symbol:
                self.stdout.write(
                    self.style.WARNING(
                        f"  Warning: Could not determine stock symbol for {file_path.name}, skipping"
                    )
                )
                return records_imported, stocks_created_count

            # Get or create stock once for this file
            stock, was_created = self._get_or_create_stock(
                stock_symbol, create=create_stocks, dry_run=dry_run
            )
            if not stock:
                return records_imported, stocks_created_count
            if was_created:
                stocks_created_count += 1

            # Process all rows (including first row if we read it)
            batch = []
            row_num = 2  # Start at 2 (header is row 1)

            # Process first row if we have it
            if first_row:
                try:
                    row_data = self._parse_row(
                        first_row, stock, file_path.name, row_num, use_stock_price
                    )
                    if row_data:
                        if not dry_run:
                            batch.append(row_data)
                        else:
                            records_imported += 1
                    row_num += 1
                except (ValueError, TypeError, KeyError) as e:
                    logger.warning(
                        f"Error processing first row in {file_path.name}: {e}"
                    )
                    row_num += 1

            # Process remaining rows
            for row in reader:
                try:
                    row_data = self._parse_row(
                        row, stock, file_path.name, row_num, use_stock_price
                    )
                    if row_data:
                        if not dry_run:
                            batch.append(row_data)
                            # Bulk create when batch is full
                            if len(batch) >= batch_size:
                                if use_stock_price:
                                    records_imported += self._bulk_create_stock_prices(
                                        batch, force=force, stock=stock
                                    )
                                else:
                                    records_imported += self._bulk_create_stock_ticks(
                                        batch, force=force, stock=stock
                                    )
                                batch = []
                        else:
                            # In dry run, just count the record
                            records_imported += 1
                    row_num += 1

                except (ValueError, TypeError, KeyError) as e:
                    logger.warning(
                        f"Error processing row {row_num} in {file_path.name}: {e}"
                    )
                    row_num += 1
                    continue

            # Process remaining batch for this file's stock
            if batch and not dry_run:
                if use_stock_price:
                    records_imported += self._bulk_create_stock_prices(
                        batch, force=force, stock=stock
                    )
                else:
                    records_imported += self._bulk_create_stock_ticks(
                        batch, force=force, stock=stock
                    )

        return records_imported, stocks_created_count

    def _parse_row(self, row, stock, filename, row_num, use_stock_price=False):
        """
        Parse a single row and return StockTick or StockPrice object or None.

        Args:
            row: Dictionary of row data
            stock: Stock object (already determined for the file)
            filename: Name of the file being processed
            row_num: Row number for error reporting
            use_stock_price: If True, return StockPrice object; if False, return StockTick object

        Returns:
            StockTick or StockPrice object or None if row is invalid
        """
        # Parse fields
        date_str = row.get("<DATE>", "").strip()
        time_str = row.get("<TIME>", "").strip()
        open_price = row.get("<OPEN>", "").strip()
        high_price = row.get("<HIGH>", "").strip()
        low_price = row.get("<LOW>", "").strip()
        close_price = row.get("<CLOSE>", "").strip()
        volume = row.get("<VOL>", "").strip()
        period = row.get("<PER>", "").strip()  # Period (e.g., "5" for 5 minutes)

        # Validate required fields
        if not all(
            [date_str, time_str, open_price, high_price, low_price, close_price]
        ):
            return None

        # Parse date and time
        # DATE format: YYYYMMDD (e.g., 20250522)
        # TIME format: HHMMSS (e.g., 160000)
        try:
            # Parse date and time (naive, will be made aware below)
            date_obj = datetime.strptime(date_str, "%Y%m%d").date()  # noqa: DTZ007
            time_obj = datetime.strptime(time_str, "%H%M%S").time()  # noqa: DTZ007
            # Combine and make timezone-aware
            timestamp = timezone.make_aware(datetime.combine(date_obj, time_obj))
        except ValueError:
            logger.warning(
                f"Invalid date/time format in {filename} row {row_num}: {date_str} {time_str}"
            )
            return None

        # Parse prices and volume
        try:
            open_val = Decimal(str(open_price))
            high_val = Decimal(str(high_price))
            low_val = Decimal(str(low_price))
            close_val = Decimal(str(close_price))
            vol_val = int(float(volume)) if volume else 0
        except (ValueError, TypeError):
            logger.warning(f"Invalid numeric values in {filename} row {row_num}")
            return None

        # Determine interval from period field
        # Period "5" typically means 5 minutes
        interval_map = {
            "1": "1m",
            "5": "5m",
            "15": "15m",
            "30": "30m",
            "60": "1h",
            "240": "4h",
            "D": "1d",
        }
        interval = interval_map.get(period, "5m")  # Default to 5m if not recognized

        if use_stock_price:
            # Create StockPrice record
            return StockPrice(
                stock=stock,
                open_price=open_val,
                high_price=high_val,
                low_price=low_val,
                close_price=close_val,
                adjusted_close=close_val,  # Use close as adjusted if not provided
                volume=vol_val,
                date=date_obj,
                timestamp=timestamp,
                interval=interval,
            )
        # Create StockTick record
        # Use close price as the tick price
        return StockTick(
            stock=stock,
            timestamp=timestamp,
            price=close_val,
            volume=vol_val,
            is_market_hours=True,  # Default to market hours
        )

    def _get_or_create_stock(self, symbol, create=False, dry_run=False):
        """Get or create a Stock object. Returns (stock, was_created)."""
        try:
            stock = Stock.objects.get(symbol=symbol.upper())
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
            if create and dry_run:
                self.stdout.write(f"  [DRY RUN] Would create stock: {symbol.upper()}")
                return None, True
            logger.warning(f"Stock {symbol} not found and --create-stocks not set")
            return None, False
        else:
            return stock, False

    def _bulk_create_stock_ticks(self, stock_ticks, force=False, stock=None):
        """
        Bulk create StockTick records for a single stock.

        Args:
            stock_ticks: List of StockTick objects to create
            force: If True, delete existing records for the stock/timestamp before creating
            stock: Stock object (optional, used for force deletion optimization)
        """
        if not stock_ticks:
            return 0

        try:
            with transaction.atomic():
                if force:
                    # If stock is provided, delete all records for this stock in the timestamp range
                    # This is more efficient than deleting per tick
                    if stock and stock_ticks:
                        timestamps = [tick.timestamp for tick in stock_ticks]
                        if timestamps:
                            min_timestamp = min(timestamps)
                            max_timestamp = max(timestamps)
                            StockTick.objects.filter(
                                stock=stock,
                                timestamp__gte=min_timestamp,
                                timestamp__lte=max_timestamp,
                            ).delete()
                    else:
                        # Fallback: delete per tick (less efficient)
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
        except Exception:
            logger.exception("Error bulk creating stock ticks")
            raise

    def _bulk_create_stock_prices(self, stock_prices, force=False, stock=None):
        """
        Bulk create StockPrice records for a single stock.

        Args:
            stock_prices: List of StockPrice objects to create
            force: If True, delete existing records for the stock/date/timestamp/interval before creating
            stock: Stock object (optional, used for force deletion optimization)
        """
        if not stock_prices:
            return 0

        try:
            with transaction.atomic():
                if force:
                    # If stock is provided, delete all records for this stock in the date/timestamp range
                    if stock and stock_prices:
                        dates = [price.date for price in stock_prices if price.date]
                        intervals = {
                            price.interval for price in stock_prices if price.interval
                        }

                        if dates:
                            min_date = min(dates)
                            max_date = max(dates)
                            query = StockPrice.objects.filter(
                                stock=stock,
                                date__gte=min_date,
                                date__lte=max_date,
                            )
                            if intervals:
                                query = query.filter(interval__in=intervals)
                            query.delete()
                    else:
                        # Fallback: delete per price (less efficient)
                        for price in stock_prices:
                            StockPrice.objects.filter(
                                stock=price.stock,
                                date=price.date,
                                timestamp=price.timestamp,
                                interval=price.interval,
                            ).delete()

                # Use bulk_create with ignore_conflicts to handle duplicates
                # StockPrice has unique_together constraint on stock, date, timestamp, interval
                created = StockPrice.objects.bulk_create(
                    stock_prices,
                    batch_size=1000,
                    ignore_conflicts=True,
                )
                return len(created)
        except Exception:
            logger.exception("Error bulk creating stock prices")
            raise
