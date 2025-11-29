"""
Management command to delete stock symbols that do not have any price data.
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q, Count
from stocks.models import Stock, StockPrice, IntradayPrice
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Delete stock symbols that do not have any price data (StockPrice or IntradayPrice)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Skip confirmation prompt',
        )
        parser.add_argument(
            '--min-days',
            type=int,
            default=0,
            help='Minimum number of days of data required to keep the stock (default: 0)',
        )
        parser.add_argument(
            '--exclude-watchlist',
            action='store_true',
            help='Exclude stocks that are in user watchlists',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        force = options['force']
        min_days = options['min_days']
        exclude_watchlist = options['exclude_watchlist']

        self.stdout.write(self.style.WARNING('=' * 60))
        self.stdout.write(self.style.WARNING('Deleting Stocks Without Price Data'))
        self.stdout.write(self.style.WARNING('=' * 60))

        if dry_run:
            self.stdout.write(self.style.WARNING('\nDRY RUN MODE - No stocks will be deleted\n'))

        # Get all stocks
        all_stocks = Stock.objects.all()
        total_stocks = all_stocks.count()
        self.stdout.write(f'Total stocks in database: {total_stocks}')

        # Find stocks without any price data
        # Use annotation to count price records efficiently
        stocks_with_counts = all_stocks.annotate(
            price_count=Count('prices', distinct=True),
            intraday_count=Count('intraday_prices', distinct=True)
        )

        # Base filter: stocks with no price data at all
        stocks_to_delete = stocks_with_counts.filter(
            price_count=0,
            intraday_count=0
        )

        # If min_days is specified, also include stocks with insufficient recent data
        if min_days > 0:
            from django.utils import timezone
            from datetime import timedelta

            cutoff_date = timezone.now().date() - timedelta(days=min_days)

            # Get stocks with sufficient recent data (at least min_days)
            stocks_with_sufficient_data = Stock.objects.filter(
                Q(prices__date__gte=cutoff_date) | Q(intraday_prices__timestamp__date__gte=cutoff_date)
            ).annotate(
                recent_price_days=Count('prices__date', distinct=True, filter=Q(prices__date__gte=cutoff_date)),
                recent_intraday_days=Count('intraday_prices__timestamp__date', distinct=True, filter=Q(intraday_prices__timestamp__date__gte=cutoff_date))
            ).filter(
                Q(recent_price_days__gte=min_days) | Q(recent_intraday_days__gte=min_days)
            ).distinct()

            # Add stocks without sufficient data to deletion list
            stocks_without_sufficient_data = stocks_with_counts.exclude(
                id__in=stocks_with_sufficient_data.values_list('id', flat=True)
            )

            stocks_to_delete = stocks_to_delete | stocks_without_sufficient_data

        # Exclude stocks in watchlists if requested
        if exclude_watchlist:
            from stocks.models import UserWatchlist
            watchlist_stocks = UserWatchlist.objects.values_list('stock_id', flat=True).distinct()
            stocks_to_delete = stocks_to_delete.exclude(id__in=watchlist_stocks)
            self.stdout.write(f'Excluding {watchlist_stocks.count()} stocks that are in watchlists')

        stocks_to_delete_list = list(stocks_to_delete)
        count_to_delete = len(stocks_to_delete_list)

        if count_to_delete == 0:
            self.stdout.write(self.style.SUCCESS('\n✓ No stocks found without price data.'))
            return

        # Show statistics
        self.stdout.write(f'\nStocks without price data: {count_to_delete}')
        self.stdout.write(f'Stocks with price data: {total_stocks - count_to_delete}')

        # Show sample of stocks to be deleted
        if count_to_delete <= 20:
            self.stdout.write('\nStocks to be deleted:')
            for stock in stocks_to_delete_list:
                self.stdout.write(f'  - {stock.symbol} ({stock.name})')
        else:
            self.stdout.write('\nSample of stocks to be deleted (first 20):')
            for stock in stocks_to_delete_list[:20]:
                self.stdout.write(f'  - {stock.symbol} ({stock.name})')
            self.stdout.write(f'  ... and {count_to_delete - 20} more')

        # Confirmation
        if not force and not dry_run:
            confirm = input('\nAre you sure you want to delete these stocks? (yes/no): ')
            if confirm.lower() not in ['yes', 'y']:
                self.stdout.write(self.style.WARNING('Operation cancelled.'))
                return

        # Delete stocks
        if not dry_run:
            try:
                with transaction.atomic():
                    deleted_count = 0
                    for stock in stocks_to_delete_list:
                        symbol = stock.symbol
                        stock.delete()
                        deleted_count += 1
                        if deleted_count % 100 == 0:
                            self.stdout.write(f'Deleted {deleted_count}/{count_to_delete} stocks...')

                    self.stdout.write(
                        self.style.SUCCESS(
                            f'\n✓ Successfully deleted {deleted_count} stocks without price data.'
                        )
                    )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'\n✗ Error deleting stocks: {str(e)}')
                )
                raise CommandError(f'Failed to delete stocks: {str(e)}')
        else:
            self.stdout.write(
                self.style.WARNING(
                    f'\n[DRY RUN] Would delete {count_to_delete} stocks without price data.'
                )
            )

        # Final statistics
        remaining_stocks = Stock.objects.count()
        self.stdout.write(f'\nRemaining stocks in database: {remaining_stocks}')
        self.stdout.write(self.style.SUCCESS('Operation completed successfully!'))
