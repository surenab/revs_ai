"""
Management command to show stocks that do not have StockPrice or StockTick data.
This command displays stocks without any price or tick data for informational purposes.
"""

import logging

from django.core.management.base import BaseCommand
from django.db.models import Avg, Count

from stocks.models import Stock

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Show stocks that do not have StockPrice or StockTick data"

    def add_arguments(self, parser):
        parser.add_argument(
            "--format",
            type=str,
            choices=["table", "list", "csv"],
            default="table",
            help="Output format: table, list, or csv (default: table)",
        )
        parser.add_argument(
            "--show-counts",
            action="store_true",
            help="Show count of price/tick records for each stock",
        )
        parser.add_argument(
            "--only-no-price",
            action="store_true",
            help="Show only stocks without StockPrice data (may have ticks)",
        )
        parser.add_argument(
            "--only-no-ticks",
            action="store_true",
            help="Show only stocks without StockTick data (may have prices)",
        )
        parser.add_argument(
            "--symbol",
            type=str,
            help="Check a specific stock symbol",
        )

    def handle(self, *args, **options):
        output_format = options["format"]
        show_counts = options["show_counts"]
        only_no_price = options["only_no_price"]
        only_no_ticks = options["only_no_ticks"]
        symbol = options.get("symbol")

        self.stdout.write(self.style.WARNING("=" * 70))
        self.stdout.write(self.style.WARNING("Stocks Without Price or Tick Data"))
        self.stdout.write(self.style.WARNING("=" * 70))

        # Get stocks to check
        if symbol:
            stocks = Stock.objects.filter(symbol=symbol.upper())
            if not stocks.exists():
                self.stdout.write(
                    self.style.ERROR(f"Stock with symbol '{symbol}' not found")
                )
                return
        else:
            stocks = Stock.objects.all()

        total_stocks = stocks.count()
        self.stdout.write(f"\nTotal stocks in database: {total_stocks}")

        # Annotate stocks with counts
        stocks_with_counts = stocks.annotate(
            price_count=Count("prices", distinct=True),
            tick_count=Count("ticks", distinct=True),
        )

        # Filter based on options
        if only_no_price:
            # Stocks without StockPrice data (may have ticks)
            stocks_without_data = stocks_with_counts.filter(price_count=0)
            filter_description = "without StockPrice data"
        elif only_no_ticks:
            # Stocks without StockTick data (may have prices)
            stocks_without_data = stocks_with_counts.filter(tick_count=0)
            filter_description = "without StockTick data"
        else:
            # Stocks without both StockPrice and StockTick data
            stocks_without_data = stocks_with_counts.filter(price_count=0, tick_count=0)
            filter_description = "without StockPrice or StockTick data"

        stocks_list = list(stocks_without_data.order_by("symbol"))
        count = len(stocks_list)

        # Statistics
        self.stdout.write(f"\nStocks {filter_description}: {count}")
        self.stdout.write(f"Stocks with data: {total_stocks - count}")

        if count == 0:
            self.stdout.write(
                self.style.SUCCESS("\n✓ All stocks have price or tick data.")
            )
            return

        # Display stocks
        self.stdout.write("\n" + "=" * 70)

        if output_format == "csv":
            self._output_csv(stocks_list, show_counts)
        elif output_format == "list":
            self._output_list(stocks_list, show_counts)
        else:  # table
            self._output_table(stocks_list, show_counts)

        # Summary by data type
        if not only_no_price and not only_no_ticks:
            self._show_detailed_statistics(stocks_with_counts)

        self.stdout.write(
            "\n" + self.style.SUCCESS("Operation completed successfully!")
        )

    def _output_table(self, stocks, show_counts):
        """Output stocks in a formatted table."""
        self.stdout.write("\nStocks without data:")
        self.stdout.write("-" * 70)

        # Header
        if show_counts:
            header = f"{'Symbol':<12} {'Name':<30} {'Prices':<10} {'Ticks':<10}"
            self.stdout.write(header)
            self.stdout.write("-" * 70)
        else:
            header = f"{'Symbol':<12} {'Name':<50}"
            self.stdout.write(header)
            self.stdout.write("-" * 70)

        # Rows
        for stock in stocks:
            if show_counts:
                row = (
                    f"{stock.symbol:<12} {stock.name[:48]:<50} "
                    f"{stock.price_count:<10} {stock.tick_count:<10}"
                )
            else:
                row = f"{stock.symbol:<12} {stock.name[:56]:<56}"
            self.stdout.write(row)

        self.stdout.write("-" * 70)

    def _output_list(self, stocks, show_counts):
        """Output stocks as a simple list."""
        self.stdout.write("\nStocks without data:")
        for stock in stocks:
            if show_counts:
                self.stdout.write(
                    f"  - {stock.symbol} ({stock.name}) - "
                    f"Prices: {stock.price_count}, Ticks: {stock.tick_count}"
                )
            else:
                self.stdout.write(f"  - {stock.symbol} ({stock.name})")

    def _output_csv(self, stocks, show_counts):
        """Output stocks in CSV format."""
        # Header
        if show_counts:
            self.stdout.write("Symbol,Name,Price Count,Tick Count,Exchange,Sector")
        else:
            self.stdout.write("Symbol,Name,Exchange,Sector")

        # Rows
        for stock in stocks:
            if show_counts:
                self.stdout.write(
                    f"{stock.symbol},{stock.name},"
                    f"{stock.price_count},{stock.tick_count},"
                    f"{stock.exchange or ''},{stock.sector or ''}"
                )
            else:
                self.stdout.write(
                    f"{stock.symbol},{stock.name},"
                    f"{stock.exchange or ''},{stock.sector or ''}"
                )

    def _show_detailed_statistics(self, stocks_with_counts):
        """Show detailed statistics about stock data availability."""
        self.stdout.write("\n" + "=" * 70)
        self.stdout.write("Detailed Statistics:")
        self.stdout.write("-" * 70)

        # Count stocks by data type
        stocks_with_price = stocks_with_counts.filter(price_count__gt=0).count()
        stocks_with_ticks = stocks_with_counts.filter(tick_count__gt=0).count()
        stocks_with_both = stocks_with_counts.filter(
            price_count__gt=0, tick_count__gt=0
        ).count()
        stocks_with_neither = stocks_with_counts.filter(
            price_count=0, tick_count=0
        ).count()
        stocks_price_only = stocks_with_counts.filter(
            price_count__gt=0, tick_count=0
        ).count()
        stocks_ticks_only = stocks_with_counts.filter(
            price_count=0, tick_count__gt=0
        ).count()

        self.stdout.write(f"Stocks with StockPrice data: {stocks_with_price}")
        self.stdout.write(f"Stocks with StockTick data: {stocks_with_ticks}")
        self.stdout.write(f"Stocks with both: {stocks_with_both}")
        self.stdout.write(f"Stocks with neither: {stocks_with_neither}")
        self.stdout.write(f"Stocks with only StockPrice: {stocks_price_only}")
        self.stdout.write(f"Stocks with only StockTick: {stocks_ticks_only}")

        # Show average counts
        stocks_with_price_data = stocks_with_counts.filter(price_count__gt=0)
        stocks_with_tick_data = stocks_with_counts.filter(tick_count__gt=0)

        if stocks_with_price_data.exists():
            avg_result = stocks_with_price_data.aggregate(avg=Avg("price_count"))
            avg_price_for_stocks_with_data = avg_result["avg"] or 0
            self.stdout.write(
                f"\nAverage StockPrice records per stock (with data): "
                f"{avg_price_for_stocks_with_data:.1f}"
            )

        if stocks_with_tick_data.exists():
            avg_result = stocks_with_tick_data.aggregate(avg=Avg("tick_count"))
            avg_tick_for_stocks_with_data = avg_result["avg"] or 0
            self.stdout.write(
                f"Average StockTick records per stock (with data): "
                f"{avg_tick_for_stocks_with_data:.1f}"
            )
