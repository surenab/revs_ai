"""
Management command to sync daily intraday stock data from Yahoo Finance.
This command fetches intraday data for all active stocks in the database.
"""
import time
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.db import transaction
from stocks.models import Stock, IntradayPrice
from stocks.services import yahoo_finance_service
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Sync daily intraday stock data from Yahoo Finance for all active stocks'

    def add_arguments(self, parser):
        parser.add_argument(
            '--symbols',
            type=str,
            help='Comma-separated list of stock symbols to sync (e.g., AAPL,GOOGL,MSFT). If not provided, syncs all active stocks.',
        )
        parser.add_argument(
            '--interval',
            type=str,
            choices=['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h'],
            default='5m',
            help='Time interval for intraday data (default: 5m)',
        )
        parser.add_argument(
            '--period',
            type=str,
            choices=['1d', '5d', '1mo'],
            default='1d',
            help='Data period to fetch (default: 1d for current day)',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=10,
            help='Number of stocks to process in each batch (default: 10)',
        )
        parser.add_argument(
            '--delay',
            type=float,
            default=0.5,
            help='Delay between batches in seconds (default: 0.5)',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force update even if data already exists for today',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without actually updating data',
        )

    def handle(self, *args, **options):
        start_time = timezone.now()
        self.stdout.write(f"Starting daily intraday sync at {start_time}")

        # Determine which stocks to sync
        if options['symbols']:
            symbols = [s.strip().upper() for s in options['symbols'].split(',')]
            stocks = Stock.objects.filter(symbol__in=symbols, is_active=True)

            # Check if all symbols exist
            found_symbols = set(stocks.values_list('symbol', flat=True))
            missing_symbols = set(symbols) - found_symbols
            if missing_symbols:
                self.stdout.write(
                    self.style.WARNING(f"Symbols not found in database: {', '.join(missing_symbols)}")
                )
        else:
            stocks = Stock.objects.filter(is_active=True)

        if not stocks.exists():
            raise CommandError('No active stocks found to sync')

        total_stocks = stocks.count()
        self.stdout.write(f"Found {total_stocks} active stocks to sync")

        # Check if we should skip stocks that already have today's data
        today = timezone.now().date()
        if not options['force']:
            # Find stocks that already have intraday data for today
            stocks_with_data = IntradayPrice.objects.filter(
                timestamp__date=today,
                interval=options['interval']
            ).values_list('stock__symbol', flat=True).distinct()

            if stocks_with_data:
                self.stdout.write(
                    f"Skipping {len(stocks_with_data)} stocks that already have today's data. Use --force to override."
                )
                stocks = stocks.exclude(symbol__in=stocks_with_data)

        if not stocks.exists():
            self.stdout.write(self.style.SUCCESS("All stocks already have today's intraday data"))
            return

        # Process stocks in batches
        batch_size = options['batch_size']
        delay = options['delay']
        interval = options['interval']
        period = options['period']

        success_count = 0
        error_count = 0

        # Process in batches to avoid overwhelming the API
        stock_list = list(stocks)
        for i in range(0, len(stock_list), batch_size):
            batch = stock_list[i:i + batch_size]
            batch_symbols = [stock.symbol for stock in batch]

            self.stdout.write(f"Processing batch {i//batch_size + 1}: {', '.join(batch_symbols)}")

            if options['dry_run']:
                self.stdout.write(f"[DRY RUN] Would fetch {interval} data for: {', '.join(batch_symbols)}")
                success_count += len(batch)
                continue

            # Fetch data for the batch
            try:
                # Use individual requests for better error handling
                for stock in batch:
                    try:
                        data = yahoo_finance_service.get_intraday_data(
                            symbol=stock.symbol,
                            interval=interval,
                            period=period
                        )

                        if data and data.get('data'):
                            self._save_intraday_data(stock, data, interval)
                            success_count += 1
                            self.stdout.write(f"✓ {stock.symbol}: {len(data['data'])} data points")
                        else:
                            error_count += 1
                            self.stdout.write(
                                self.style.WARNING(f"✗ {stock.symbol}: No data received")
                            )

                    except Exception as e:
                        error_count += 1
                        logger.error(f"Error processing {stock.symbol}: {e}")
                        self.stdout.write(
                            self.style.ERROR(f"✗ {stock.symbol}: {str(e)}")
                        )

            except Exception as e:
                error_count += len(batch)
                logger.error(f"Error processing batch: {e}")
                self.stdout.write(
                    self.style.ERROR(f"✗ Batch error: {str(e)}")
                )

            # Add delay between batches to be respectful to the API
            if i + batch_size < len(stock_list) and delay > 0:
                time.sleep(delay)

        # Summary
        end_time = timezone.now()
        duration = end_time - start_time

        self.stdout.write("\n" + "="*50)
        self.stdout.write(f"Sync completed in {duration}")
        self.stdout.write(f"Successfully processed: {success_count}")
        self.stdout.write(f"Errors: {error_count}")
        self.stdout.write(f"Total stocks: {success_count + error_count}")

        if error_count > 0:
            self.stdout.write(
                self.style.WARNING(f"Completed with {error_count} errors. Check logs for details.")
            )
        else:
            self.stdout.write(self.style.SUCCESS("All stocks processed successfully!"))

    def _save_intraday_data(self, stock, data, interval):
        """Save intraday data to the database."""
        try:
            with transaction.atomic():
                # Delete existing data for today to avoid duplicates
                today = timezone.now().date()
                IntradayPrice.objects.filter(
                    stock=stock,
                    interval=interval,
                    timestamp__date=today
                ).delete()

                # Create new intraday price records
                intraday_prices = []
                for point in data['data']:
                    # Parse datetime
                    dt = datetime.strptime(point['datetime'], '%Y-%m-%d %H:%M:%S')
                    dt = timezone.make_aware(dt)

                    intraday_prices.append(IntradayPrice(
                        stock=stock,
                        timestamp=dt,
                        interval=interval,
                        open_price=point['open'],
                        high_price=point['high'],
                        low_price=point['low'],
                        close_price=point['close'],
                        volume=point['volume'],
                        session_type='regular'  # Default to regular market hours
                    ))

                # Bulk create for efficiency
                if intraday_prices:
                    IntradayPrice.objects.bulk_create(intraday_prices, batch_size=1000)

        except Exception as e:
            logger.error(f"Error saving intraday data for {stock.symbol}: {e}")
            raise
