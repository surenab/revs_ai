# Generated manually

from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("bot_simulations", "0006_add_progress_tracking_and_tick_model"),
    ]

    operations = [
        migrations.AddField(
            model_name="botsimulationrun",
            name="simulation_type",
            field=models.CharField(
                choices=[("fund", "Fund Based"), ("portfolio", "Portfolio Based")],
                default="fund",
                help_text="Type of simulation: fund-based (cash) or portfolio-based (existing positions)",
                max_length=20,
                verbose_name="simulation type",
            ),
        ),
        migrations.AddField(
            model_name="botsimulationrun",
            name="initial_fund",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("10000.00"),
                help_text="Initial cash fund for fund-based simulations",
                max_digits=15,
                verbose_name="initial fund",
            ),
        ),
        migrations.AddField(
            model_name="botsimulationrun",
            name="initial_portfolio",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Initial portfolio for portfolio-based simulations. Format: {'SYMBOL': quantity, ...}",
                verbose_name="initial portfolio",
            ),
        ),
    ]
