"""
Management command to populate real stocks from Yahoo Finance API.
"""
import time
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from stocks.models import Stock
from stocks.services import yahoo_finance_service
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Populate real stocks from Yahoo Finance API'

    def add_arguments(self, parser):
        parser.add_argument(
            '--symbols',
            type=str,
            help='Comma-separated list of stock symbols to add (e.g., AAPL,GOOGL,MSFT)',
        )
        parser.add_argument(
            '--popular',
            action='store_true',
            help='Add popular stocks from all categories (tech, biotech, finance, etc.)',
        )
        parser.add_argument(
            '--tech',
            action='store_true',
            help='Add top 100 technology stocks only',
        )
        parser.add_argument(
            '--biotech',
            action='store_true',
            help='Add top 100 biotech and medical stocks only',
        )
        parser.add_argument(
            '--energy',
            action='store_true',
            help='Add top 100 energy sector stocks only',
        )
        parser.add_argument(
            '--finance',
            action='store_true',
            help='Add top 100 financial sector stocks only',
        )
        parser.add_argument(
            '--consumer',
            action='store_true',
            help='Add top 100 consumer goods and retail stocks only',
        )
        parser.add_argument(
            '--industrial',
            action='store_true',
            help='Add top 100 industrial sector stocks only',
        )
        parser.add_argument(
            '--utilities',
            action='store_true',
            help='Add top 100 utilities sector stocks only',
        )
        parser.add_argument(
            '--materials',
            action='store_true',
            help='Add top 100 materials and mining stocks only',
        )
        parser.add_argument(
            '--realestate',
            action='store_true',
            help='Add top 100 real estate and REITs only',
        )
        parser.add_argument(
            '--telecom',
            action='store_true',
            help='Add top 100 telecommunications and media stocks only',
        )
        parser.add_argument(
            '--all-sectors',
            action='store_true',
            help='Add top stocks from ALL sectors (1000+ stocks)',
        )
        parser.add_argument(
            '--delay',
            type=float,
            default=0.5,
            help='Delay between API calls in seconds (default: 0.5 for Yahoo Finance)',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=10,
            help='Number of stocks to process in each batch (default: 10)',
        )

    def handle(self, *args, **options):
        symbols = []

        if options['symbols']:
            symbols = [s.strip().upper() for s in options['symbols'].split(',')]
        elif options['popular']:
            symbols = self._get_popular_symbols()
        elif options['tech']:
            symbols = self._get_tech_symbols()
        elif options['biotech']:
            symbols = self._get_biotech_symbols()
        elif options['energy']:
            symbols = self._get_energy_symbols()
        elif options['finance']:
            symbols = self._get_finance_symbols()
        elif options['consumer']:
            symbols = self._get_consumer_symbols()
        elif options['industrial']:
            symbols = self._get_industrial_symbols()
        elif options['utilities']:
            symbols = self._get_utilities_symbols()
        elif options['materials']:
            symbols = self._get_materials_symbols()
        elif options['realestate']:
            symbols = self._get_realestate_symbols()
        elif options['telecom']:
            symbols = self._get_telecom_symbols()
        elif options['all_sectors']:
            symbols = self._get_all_sectors_symbols()
        else:
            raise CommandError('Specify one of: --symbols, --popular, --tech, --biotech, --energy, --finance, --consumer, --industrial, --utilities, --materials, --realestate, --telecom, or --all-sectors')

        if not symbols:
            self.stdout.write(self.style.WARNING('No symbols found to process'))
            return

        self.stdout.write(f'Processing {len(symbols)} symbols...')

        success_count = 0
        error_count = 0
        batch_size = options['batch_size']

        # Process symbols in batches for better performance
        for i in range(0, len(symbols), batch_size):
            batch = symbols[i:i + batch_size]
            self.stdout.write(f'Processing batch {i//batch_size + 1}: {", ".join(batch)}')

            # Get stock info for the entire batch
            batch_info = {}
            for symbol in batch:
                try:
                    info = yahoo_finance_service.get_stock_info(symbol)
                    if info:
                        batch_info[symbol] = info
                    else:
                        self.stdout.write(
                            self.style.WARNING(f'No info found for {symbol}')
                        )
                except Exception as e:
                    logger.error(f'Error fetching info for {symbol}: {e}')
                    self.stdout.write(
                        self.style.ERROR(f'Error fetching info for {symbol}: {e}')
                    )

            # Create stocks from batch info
            for symbol in batch:
                try:
                    if symbol in batch_info:
                        if self._create_stock(symbol, batch_info[symbol]):
                            success_count += 1
                        else:
                            error_count += 1
                    else:
                        error_count += 1

                except Exception as e:
                    logger.error(f'Error processing {symbol}: {e}')
                    self.stdout.write(
                        self.style.ERROR(f'Error processing {symbol}: {e}')
                    )
                    error_count += 1
                    continue

            # Add delay between batches
            if i + batch_size < len(symbols) and options['delay'] > 0:
                time.sleep(options['delay'])

        self.stdout.write(
            self.style.SUCCESS(
                f'Stock creation completed. Success: {success_count}, Errors: {error_count}'
            )
        )


    def _get_popular_symbols(self) -> list:
        """Get list of popular stock symbols including top 100 tech and biotech/medical stocks."""

        # Top Technology Stocks (100)
        tech_stocks = [
            # FAANG + Microsoft + Major Tech
            'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA', 'NVDA', 'NFLX',
            'ADBE', 'CRM', 'ORCL', 'INTC', 'AMD', 'QCOM', 'AVGO', 'TXN', 'CSCO',
            'ACN', 'IBM', 'INTU', 'NOW', 'AMAT', 'MU', 'ADI', 'LRCX', 'KLAC',
            'MRVL', 'SNPS', 'CDNS', 'FTNT', 'PANW', 'CRWD', 'ZS', 'OKTA', 'NET',
            'DDOG', 'SNOW', 'PLTR', 'U', 'TWLO', 'ZM', 'DOCU', 'WORK', 'TEAM',
            'ATLASSIAN', 'SHOP', 'SQ', 'PYPL', 'ADYEY', 'UBER', 'LYFT', 'ABNB',
            'DASH', 'RBLX', 'COIN', 'HOOD', 'SOFI', 'AFRM', 'UPST', 'LMND',
            'ROOT', 'OPEN', 'WISH', 'CLOV', 'SPCE', 'NKLA', 'LCID', 'RIVN',
            'F', 'GM', 'FORD', 'DELL', 'HPQ', 'HPE', 'WDC', 'STX', 'NTAP',
            'PURE', 'SMCI', 'ENPH', 'SEDG', 'FSLR', 'SPWR', 'RUN', 'NOVA',
            'OLED', 'SWKS', 'MCHP', 'MPWR', 'POWI', 'CRUS', 'SLAB', 'SITM',
            'FORM', 'PSTG', 'ESTC', 'VEEV', 'WDAY', 'ANSS', 'CTSH', 'EPAM'
        ]

        # Top Biotech and Medical Stocks (100)
        biotech_medical_stocks = [
            # Major Pharma
            'JNJ', 'PFE', 'ABBV', 'MRK', 'LLY', 'UNH', 'TMO', 'ABT', 'DHR', 'BMY',
            'AMGN', 'GILD', 'MDT', 'ISRG', 'VRTX', 'REGN', 'ZTS', 'CVS', 'CI', 'HUM',
            'ANTM', 'CNC', 'MOH', 'ELV', 'MCK', 'CAH', 'ABC', 'COR', 'WBA', 'CVS',
            # Biotech Leaders
            'BIIB', 'CELG', 'ILMN', 'MRNA', 'BNTX', 'NVAX', 'SGEN', 'BMRN', 'ALXN',
            'INCY', 'EXAS', 'TECH', 'ARKG', 'CRSP', 'EDIT', 'NTLA', 'BEAM', 'PRIME',
            'BLUE', 'FOLD', 'ARWR', 'IONS', 'SAGE', 'PTCT', 'RARE', 'SRPT', 'MYOV',
            'ACAD', 'HALO', 'KROS', 'DAWN', 'RGNX', 'IMGN', 'SEAG', 'MYGN', 'EXEL',
            # Medical Devices & Equipment
            'SYK', 'BSX', 'EW', 'ZBH', 'HOLX', 'BAX', 'BDX', 'VAR', 'ALGN', 'DXCM',
            'PODD', 'TDOC', 'VEEV', 'IQV', 'CRL', 'LH', 'DGX', 'QGEN', 'A', 'WST',
            'PKI', 'MTD', 'TECH', 'NEOG', 'NVST', 'OMCL', 'PRGO', 'TEVA', 'MYL', 'AGN',
            # Emerging Biotech
            'MRTX', 'ARCT', 'FATE', 'CGEM', 'CRBU', 'DRNA', 'RCKT', 'RLAY', 'SMFR',
            'VERV', 'VINC', 'YMAB', 'ZLAB', 'ZNTL', 'ZYXI', 'ADPT', 'AGIO', 'AKRO'
        ]

        # Additional Popular Stocks from Other Sectors
        other_popular = [
            # Financial
            'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'USB', 'PNC', 'TFC', 'COF',
            # Consumer & Retail
            'KO', 'PEP', 'WMT', 'HD', 'TGT', 'COST', 'LOW', 'SBUX', 'MCD', 'NKE',
            # Industrial
            'BA', 'CAT', 'GE', 'MMM', 'HON', 'UPS', 'FDX', 'LMT', 'RTX', 'NOC',
            # Energy
            'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'OXY', 'PSX', 'VLO', 'MPC', 'HES',
            # Telecom & Media
            'VZ', 'T', 'TMUS', 'CHTR', 'CMCSA', 'DIS', 'NFLX', 'ROKU', 'SPOT', 'TWTR',
            # Real Estate & REITs
            'AMT', 'PLD', 'CCI', 'EQIX', 'SPG', 'O', 'WELL', 'AVB', 'EQR', 'UDR'
        ]

        # Combine all lists and remove duplicates while preserving order
        all_symbols = tech_stocks + biotech_medical_stocks + other_popular
        seen = set()
        unique_symbols = []
        for symbol in all_symbols:
            if symbol not in seen:
                seen.add(symbol)
                unique_symbols.append(symbol)

        return unique_symbols

    def _get_tech_symbols(self) -> list:
        """Get top 100 technology stock symbols."""
        return [
            # FAANG + Microsoft + Major Tech
            'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA', 'NVDA', 'NFLX',
            'ADBE', 'CRM', 'ORCL', 'INTC', 'AMD', 'QCOM', 'AVGO', 'TXN', 'CSCO',
            'ACN', 'IBM', 'INTU', 'NOW', 'AMAT', 'MU', 'ADI', 'LRCX', 'KLAC',
            'MRVL', 'SNPS', 'CDNS', 'FTNT', 'PANW', 'CRWD', 'ZS', 'OKTA', 'NET',
            'DDOG', 'SNOW', 'PLTR', 'U', 'TWLO', 'ZM', 'DOCU', 'WORK', 'TEAM',
            'ATLASSIAN', 'SHOP', 'SQ', 'PYPL', 'ADYEY', 'UBER', 'LYFT', 'ABNB',
            'DASH', 'RBLX', 'COIN', 'HOOD', 'SOFI', 'AFRM', 'UPST', 'LMND',
            'ROOT', 'OPEN', 'WISH', 'CLOV', 'SPCE', 'NKLA', 'LCID', 'RIVN',
            'F', 'GM', 'FORD', 'DELL', 'HPQ', 'HPE', 'WDC', 'STX', 'NTAP',
            'PURE', 'SMCI', 'ENPH', 'SEDG', 'FSLR', 'SPWR', 'RUN', 'NOVA',
            'OLED', 'SWKS', 'MCHP', 'MPWR', 'POWI', 'CRUS', 'SLAB', 'SITM',
            'FORM', 'PSTG', 'ESTC', 'VEEV', 'WDAY', 'ANSS', 'CTSH', 'EPAM'
        ]

    def _get_biotech_symbols(self) -> list:
        """Get top 100 biotech and medical stock symbols."""
        return [
            # Major Pharma
            'JNJ', 'PFE', 'ABBV', 'MRK', 'LLY', 'UNH', 'TMO', 'ABT', 'DHR', 'BMY',
            'AMGN', 'GILD', 'MDT', 'ISRG', 'VRTX', 'REGN', 'ZTS', 'CVS', 'CI', 'HUM',
            'ANTM', 'CNC', 'MOH', 'ELV', 'MCK', 'CAH', 'ABC', 'COR', 'WBA', 'CVS',
            # Biotech Leaders
            'BIIB', 'CELG', 'ILMN', 'MRNA', 'BNTX', 'NVAX', 'SGEN', 'BMRN', 'ALXN',
            'INCY', 'EXAS', 'TECH', 'ARKG', 'CRSP', 'EDIT', 'NTLA', 'BEAM', 'PRIME',
            'BLUE', 'FOLD', 'ARWR', 'IONS', 'SAGE', 'PTCT', 'RARE', 'SRPT', 'MYOV',
            'ACAD', 'HALO', 'KROS', 'DAWN', 'RGNX', 'IMGN', 'SEAG', 'MYGN', 'EXEL',
            # Medical Devices & Equipment
            'SYK', 'BSX', 'EW', 'ZBH', 'HOLX', 'BAX', 'BDX', 'VAR', 'ALGN', 'DXCM',
            'PODD', 'TDOC', 'VEEV', 'IQV', 'CRL', 'LH', 'DGX', 'QGEN', 'A', 'WST',
            'PKI', 'MTD', 'TECH', 'NEOG', 'NVST', 'OMCL', 'PRGO', 'TEVA', 'MYL', 'AGN',
            # Emerging Biotech
            'MRTX', 'ARCT', 'FATE', 'CGEM', 'CRBU', 'DRNA', 'RCKT', 'RLAY', 'SMFR',
            'VERV', 'VINC', 'YMAB', 'ZLAB', 'ZNTL', 'ZYXI', 'ADPT', 'AGIO', 'AKRO'
        ]

    def _get_energy_symbols(self) -> list:
        """Get top 100 energy sector stock symbols."""
        return [
            # Oil & Gas Giants
            'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'OXY', 'PSX', 'VLO', 'MPC', 'HES',
            'KMI', 'WMB', 'OKE', 'EPD', 'ET', 'MPLX', 'PAGP', 'EQT', 'FANG', 'DVN',
            'MRO', 'APA', 'CNX', 'AR', 'SM', 'NOG', 'CLR', 'MTDR', 'PXD', 'CTRA',
            # Renewable Energy
            'NEE', 'DUK', 'SO', 'D', 'EXC', 'AEP', 'XEL', 'SRE', 'PEG', 'ED',
            'ENPH', 'SEDG', 'FSLR', 'SPWR', 'RUN', 'NOVA', 'JKS', 'CSIQ', 'DQ', 'SOL',
            'PLUG', 'BE', 'BLDP', 'FCEL', 'HYLN', 'NKLA', 'QS', 'CHPT', 'BLNK', 'EVGO',
            # Pipeline & Infrastructure
            'TC', 'TRP', 'ENB', 'PPL', 'ATO', 'CNP', 'NI', 'LNT', 'WEC', 'CMS',
            'EVRG', 'AES', 'NRG', 'VST', 'CEG', 'CWEN', 'BEP', 'NEP', 'CAPL', 'GLNG',
            # Oil Services & Equipment
            'HAL', 'BKR', 'FTI', 'NOV', 'HP', 'PTEN', 'CLB', 'LBRT', 'WHD', 'PUMP',
            'RIG', 'VAL', 'DO', 'NE', 'AROC', 'NEXT', 'WTTR', 'NINE', 'PARR', 'TALO'
        ]

    def _get_finance_symbols(self) -> list:
        """Get top 100 financial sector stock symbols."""
        return [
            # Major Banks
            'JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'USB', 'PNC', 'TFC', 'COF',
            'BK', 'STT', 'SCHW', 'AXP', 'DFS', 'SYF', 'ALLY', 'RF', 'CFG', 'HBAN',
            'FITB', 'KEY', 'ZION', 'CMA', 'WTFC', 'SIVB', 'PACW', 'WAL', 'CBSH', 'FHN',
            # Insurance
            'BRK.A', 'BRK.B', 'V', 'MA', 'AIG', 'PGR', 'TRV', 'ALL', 'CB', 'AFL',
            'MET', 'PRU', 'AMP', 'LNC', 'PFG', 'TMK', 'RGA', 'CINF', 'L', 'GL',
            'WRB', 'AFG', 'Y', 'PRI', 'AIZ', 'ACGL', 'RLI', 'KMPR', 'MCY', 'SIGI',
            # Asset Management & Investment
            'BLK', 'AMG', 'TROW', 'BEN', 'IVZ', 'NTRS', 'STT', 'SEIC', 'APAM', 'EV',
            'KKR', 'BX', 'APO', 'CG', 'OWL', 'ARES', 'TPG', 'HLNE', 'STEP', 'PX',
            # REITs & Real Estate Finance
            'AMT', 'PLD', 'CCI', 'EQIX', 'SPG', 'O', 'WELL', 'AVB', 'EQR', 'UDR',
            'ESS', 'MAA', 'CPT', 'EXR', 'INVH', 'AMH', 'SUI', 'LSI', 'CUBE', 'PSA'
        ]

    def _get_consumer_symbols(self) -> list:
        """Get top 100 consumer goods and retail stock symbols."""
        return [
            # Consumer Staples
            'WMT', 'PG', 'KO', 'PEP', 'COST', 'MDLZ', 'CL', 'KMB', 'GIS', 'K',
            'HSY', 'MKC', 'CPB', 'CAG', 'SJM', 'HRL', 'TSN', 'KHC', 'UNFI', 'CALM',
            # Retail & E-commerce
            'AMZN', 'HD', 'TGT', 'LOW', 'TJX', 'ROST', 'DG', 'DLTR', 'BBY', 'GPS',
            'M', 'KSS', 'JWN', 'BIG', 'FIVE', 'OLLI', 'BURL', 'URBN', 'AEO', 'ANF',
            # Restaurants & Food Service
            'MCD', 'SBUX', 'CMG', 'QSR', 'YUM', 'DPZ', 'PZZA', 'DENN', 'CAKE', 'TXRH',
            'WING', 'BLMN', 'DIN', 'BJRI', 'RRGB', 'SONC', 'JACK', 'FRGI', 'HAYW', 'DAVE',
            # Consumer Discretionary
            'TSLA', 'NKE', 'LULU', 'RCL', 'CCL', 'NCLH', 'MAR', 'HLT', 'H', 'IHG',
            'MGM', 'LVS', 'WYNN', 'CZR', 'BYD', 'PENN', 'DKNG', 'GDRX', 'CHWY', 'PETS',
            # Apparel & Luxury
            'TPR', 'RL', 'PVH', 'VFC', 'HBI', 'GIL', 'COLM', 'DECK', 'CROX', 'SKX',
            'WWW', 'BOOT', 'SCVL', 'TLYS', 'ZUMZ', 'HIBB', 'EXPR', 'GOOS', 'LAKE', 'UNFI'
        ]

    def _get_industrial_symbols(self) -> list:
        """Get top 100 industrial sector stock symbols."""
        return [
            # Aerospace & Defense
            'BA', 'LMT', 'RTX', 'NOC', 'GD', 'LHX', 'TDG', 'HWM', 'TXT', 'CW',
            'HEI', 'LDOS', 'KTOS', 'AJRD', 'SPR', 'AIR', 'WWD', 'MRCY', 'AVAV', 'NPAB',
            # Industrial Machinery
            'CAT', 'DE', 'CMI', 'ITW', 'EMR', 'HON', 'MMM', 'GE', 'ETN', 'PH',
            'ROK', 'DOV', 'XYL', 'FLS', 'FLR', 'IR', 'GNRC', 'HUBB', 'FAST', 'SNA',
            # Transportation & Logistics
            'UPS', 'FDX', 'UNP', 'CSX', 'NSC', 'CP', 'CNI', 'KSU', 'JBHT', 'ODFL',
            'XPO', 'CHRW', 'EXPD', 'LSTR', 'SAIA', 'ARCB', 'YELL', 'WERN', 'KNX', 'MATX',
            # Construction & Engineering
            'JCI', 'CARR', 'OTIS', 'PWR', 'BLDR', 'DHI', 'LEN', 'NVR', 'PHM', 'TOL',
            'KBH', 'MTH', 'TPH', 'MHO', 'LGIH', 'CVCO', 'GRBK', 'CCS', 'SSD', 'DOOR',
            # Electrical Equipment
            'ABB', 'EATON', 'AMETEK', 'ROPER', 'DANAHER', 'FORTIVE', 'AOS', 'AYI', 'HUBG', 'EAF',
            'ATKR', 'BWA', 'ADNT', 'AIN', 'FLOW', 'FLS', 'GTLS', 'HLIO', 'ITGR', 'JOUT'
        ]

    def _get_utilities_symbols(self) -> list:
        """Get top 100 utilities sector stock symbols."""
        return [
            # Electric Utilities
            'NEE', 'DUK', 'SO', 'D', 'EXC', 'AEP', 'XEL', 'SRE', 'PEG', 'ED',
            'EIX', 'PPL', 'ATO', 'CNP', 'NI', 'LNT', 'WEC', 'CMS', 'EVRG', 'AES',
            'NRG', 'VST', 'CEG', 'CWEN', 'BEP', 'NEP', 'CAPL', 'GLNG', 'UGI', 'SWX',
            # Gas Utilities
            'OGE', 'NWE', 'SR', 'NJR', 'AWK', 'WTRG', 'CWT', 'MSEX', 'WTS', 'ARTNA',
            'CWCO', 'YORW', 'GWRS', 'SJW', 'CTWS', 'CDZI', 'OTTR', 'PCYO', 'PICO', 'RGCO',
            # Water Utilities
            'AWK', 'WTRG', 'CWT', 'MSEX', 'WTS', 'ARTNA', 'CWCO', 'YORW', 'GWRS', 'SJW',
            'CTWS', 'CDZI', 'OTTR', 'PCYO', 'PICO', 'RGCO', 'SWVL', 'TTEK', 'YORW', 'GWRS',
            # Renewable Energy Utilities
            'BEP', 'NEP', 'CWEN', 'TERP', 'CAPL', 'GLNG', 'HASI', 'PEGI', 'NYLD', 'MAXN',
            'ARRY', 'CSIQ', 'DQ', 'FSLR', 'JKS', 'NOVA', 'RUN', 'SEDG', 'SOL', 'SPWR',
            # Multi-Utilities
            'AES', 'NRG', 'VST', 'CEG', 'CWEN', 'BEP', 'NEP', 'CAPL', 'GLNG', 'UGI'
        ]

    def _get_materials_symbols(self) -> list:
        """Get top 100 materials and mining stock symbols."""
        return [
            # Basic Materials & Chemicals
            'LIN', 'APD', 'ECL', 'SHW', 'DD', 'DOW', 'LYB', 'EMN', 'CF', 'FMC',
            'ALB', 'CE', 'IFF', 'RPM', 'PPG', 'NEM', 'FCX', 'GOLD', 'AEM', 'KGC',
            # Steel & Metals
            'NUE', 'STLD', 'CMC', 'RS', 'X', 'CLF', 'MT', 'TX', 'ZEUS', 'ATI',
            'WOR', 'CENX', 'KALU', 'TMST', 'HAYN', 'CRS', 'WIRE', 'ROCK', 'MTRN', 'SYNL',
            # Mining & Precious Metals
            'NEM', 'FCX', 'GOLD', 'AEM', 'KGC', 'AU', 'EGO', 'HMY', 'PAAS', 'CDE',
            'HL', 'SSRM', 'WPM', 'FNV', 'RGLD', 'SAND', 'SLW', 'SBSW', 'AGI', 'MAG',
            # Construction Materials
            'MLM', 'VMC', 'NWL', 'SUM', 'CX', 'USCR', 'HWKN', 'HCSG', 'APOG', 'DOOR',
            'BLDR', 'SSD', 'BECN', 'AZEK', 'TREX', 'UFP', 'WY', 'IP', 'PKG', 'CCK',
            # Packaging & Containers
            'PKG', 'CCK', 'AVY', 'SEE', 'BLL', 'SLGN', 'AMCR', 'SON', 'BERY', 'PTVE',
            'GPRO', 'TG', 'SLVM', 'CCRN', 'IOSP', 'SCHOTT', 'CROWN', 'SILGAN', 'REYNOLDS', 'BALL'
        ]

    def _get_realestate_symbols(self) -> list:
        """Get top 100 real estate and REITs stock symbols."""
        return [
            # Residential REITs
            'AMH', 'INVH', 'EXR', 'PSA', 'EQR', 'UDR', 'AVB', 'ESS', 'MAA', 'CPT',
            'AIV', 'BRT', 'ACC', 'NEN', 'CSR', 'IRT', 'NXRT', 'ROIC', 'ELME', 'BRG',
            # Commercial REITs
            'SPG', 'REG', 'MAC', 'SKT', 'KIM', 'BRX', 'FRT', 'KRG', 'RPT', 'SITC',
            'WPG', 'CBL', 'PEI', 'TCO', 'AKR', 'RPAI', 'PGRE', 'HIW', 'BXP', 'VNO',
            # Industrial REITs
            'PLD', 'CUBE', 'LSI', 'REXR', 'FR', 'STAG', 'TRNO', 'ILPT', 'PLYM', 'GOOD',
            'SAFE', 'CXW', 'GEO', 'COLD', 'STOR', 'LAND', 'FPI', 'GTY', 'ALEX', 'REXR',
            # Office REITs
            'BXP', 'VNO', 'SLG', 'KRC', 'HIW', 'CUZ', 'PGRE', 'CLI', 'OFC', 'ESRT',
            'JBGS', 'PDM', 'DEI', 'HPP', 'TIER', 'PINE', 'NLCP', 'CMCT', 'NYRT', 'SVC',
            # Healthcare REITs
            'WELL', 'VTR', 'PEAK', 'HCP', 'MPW', 'HR', 'OHI', 'LTC', 'NHI', 'SBRA',
            'DOC', 'GMRE', 'CTRE', 'AHH', 'DHC', 'CHCT', 'LTCH', 'NHIC', 'CARE', 'CORR'
        ]

    def _get_telecom_symbols(self) -> list:
        """Get top 100 telecommunications and media stock symbols."""
        return [
            # Telecom Carriers
            'VZ', 'T', 'TMUS', 'S', 'CHTR', 'CMCSA', 'LBRDA', 'LBRDK', 'LILAK', 'CABO',
            'SHEN', 'COGN', 'WOW', 'CNSL', 'CCOI', 'ATUS', 'GSAT', 'VSAT', 'ORBC', 'GILT',
            # Media & Entertainment
            'DIS', 'NFLX', 'WBD', 'PARA', 'FOX', 'FOXA', 'SONY', 'ROKU', 'SPOT', 'SIRI',
            'LSXMA', 'LSXMB', 'LSXMK', 'MSG', 'MSGM', 'MSGS', 'IMAX', 'CNK', 'AMC', 'CINE',
            # Broadcasting
            'NXST', 'TEGNA', 'GTN', 'SBGI', 'SSP', 'GRAY', 'TGNA', 'CVLT', 'TTGT', 'AMCX',
            'VIAC', 'CBS', 'DISCA', 'DISCK', 'DISCB', 'VIACA', 'VIACB', 'EWBC', 'ENTG', 'QNST',
            # Internet & Digital Media
            'META', 'GOOGL', 'GOOG', 'TWTR', 'SNAP', 'PINS', 'MTCH', 'BMBL', 'Z', 'ZG',
            'YELP', 'GRPN', 'ANGI', 'CARS', 'MOMO', 'DOYU', 'HUYA', 'YY', 'BIDU', 'BILI',
            # Advertising & Marketing
            'TTD', 'MGNI', 'PUBM', 'CRTO', 'APPS', 'RAMP', 'FUEL', 'SSTK', 'EVER', 'ZNGA',
            'EA', 'ATVI', 'TTWO', 'GLUU', 'SKLZ', 'DKNG', 'PENN', 'RSI', 'CZR', 'BYD'
        ]

    def _get_all_sectors_symbols(self) -> list:
        """Get top stocks from ALL sectors combined."""
        all_symbols = []
        all_symbols.extend(self._get_tech_symbols())
        all_symbols.extend(self._get_biotech_symbols())
        all_symbols.extend(self._get_energy_symbols())
        all_symbols.extend(self._get_finance_symbols())
        all_symbols.extend(self._get_consumer_symbols())
        all_symbols.extend(self._get_industrial_symbols())
        all_symbols.extend(self._get_utilities_symbols())
        all_symbols.extend(self._get_materials_symbols())
        all_symbols.extend(self._get_realestate_symbols())
        all_symbols.extend(self._get_telecom_symbols())

        # Remove duplicates while preserving order
        seen = set()
        unique_symbols = []
        for symbol in all_symbols:
            if symbol not in seen:
                seen.add(symbol)
                unique_symbols.append(symbol)

        return unique_symbols

    def _create_stock(self, symbol: str, stock_info: dict) -> bool:
        """Create a stock record from Yahoo Finance data."""
        # Check if stock already exists
        if Stock.objects.filter(symbol=symbol).exists():
            self.stdout.write(
                self.style.WARNING(f'Stock {symbol} already exists, skipping')
            )
            return True

        if not stock_info:
            self.stdout.write(
                self.style.ERROR(f'No stock info provided for {symbol}')
            )
            return False

        try:
            # Parse market cap
            market_cap = stock_info.get('market_cap', 0) or 0

            # Create stock record
            stock = Stock.objects.create(
                symbol=symbol,
                name=stock_info.get('name', symbol),
                exchange=stock_info.get('exchange', 'Unknown'),
                sector=stock_info.get('sector', ''),
                industry=stock_info.get('industry', ''),
                description=stock_info.get('description', ''),
                market_cap=market_cap,
                is_active=True
            )

            # Format market cap for display
            market_cap_display = self._format_market_cap(market_cap)

            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Created {symbol}: {stock.name} ({stock.exchange}) - '
                    f'Market Cap: {market_cap_display}'
                )
            )
            return True

        except Exception as e:
            logger.error(f'Error creating stock {symbol}: {e}')
            self.stdout.write(
                self.style.ERROR(f'✗ Error creating stock {symbol}: {e}')
            )
            return False

    def _format_market_cap(self, market_cap: int) -> str:
        """Format market cap for display."""
        if not market_cap:
            return "N/A"

        if market_cap >= 1_000_000_000_000:  # Trillion
            return f"${market_cap / 1_000_000_000_000:.1f}T"
        elif market_cap >= 1_000_000_000:  # Billion
            return f"${market_cap / 1_000_000_000:.1f}B"
        elif market_cap >= 1_000_000:  # Million
            return f"${market_cap / 1_000_000:.1f}M"
        else:
            return f"${market_cap:,}"
