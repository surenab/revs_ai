"""
Serializers for bot simulation models.
"""

from rest_framework import serializers

from bot_simulations.models import (
    BotSimulationConfig,
    BotSimulationDay,
    BotSimulationResult,
    BotSimulationRun,
    BotSimulationTick,
)
from stocks.models import Stock
from stocks.serializers import StockListSerializer


class BotSimulationRunSerializer(serializers.ModelSerializer):
    """Serializer for BotSimulationRun model."""

    stocks = StockListSerializer(many=True, read_only=True)  # For display
    stock_ids = serializers.PrimaryKeyRelatedField(
        queryset=Stock.objects.all(), many=True, write_only=True, source="stocks"
    )
    user_email = serializers.CharField(source="user.email", read_only=True)

    def to_representation(self, instance):
        """Convert Decimal progress to float for JSON serialization."""
        representation = super().to_representation(instance)
        if "progress" in representation and representation["progress"] is not None:
            representation["progress"] = float(representation["progress"])
        return representation

    class Meta:
        model = BotSimulationRun
        fields = "__all__"
        read_only_fields = [
            "id",
            "user",
            "status",
            "total_bots",
            "progress",
            "current_day",
            "bots_completed",
            "top_performers",
            "error_message",
            "created_at",
            "started_at",
            "completed_at",
            "stocks",
            "user_email",
        ]
        # simulation_type, initial_fund, and initial_portfolio are writable


class BotSimulationConfigSerializer(serializers.ModelSerializer):
    """Serializer for BotSimulationConfig model."""

    assigned_stocks = StockListSerializer(many=True, read_only=True)

    class Meta:
        model = BotSimulationConfig
        fields = "__all__"
        read_only_fields = ["id", "simulation_run", "bot_index"]


class BotSimulationDaySerializer(serializers.ModelSerializer):
    """Serializer for BotSimulationDay model."""

    class Meta:
        model = BotSimulationDay
        fields = "__all__"
        read_only_fields = ["id", "simulation_config"]


class BotSimulationResultSerializer(serializers.ModelSerializer):
    """Serializer for BotSimulationResult model."""

    simulation_config = BotSimulationConfigSerializer(read_only=True)

    class Meta:
        model = BotSimulationResult
        fields = "__all__"
        read_only_fields = ["id", "simulation_config"]


class SignalProductivitySerializer(serializers.Serializer):
    """Serializer for signal productivity analysis."""

    signal_type = serializers.CharField()
    accuracy = serializers.DecimalField(max_digits=5, decimal_places=2)
    avg_confidence = serializers.DecimalField(max_digits=5, decimal_places=2)
    total_decisions = serializers.IntegerField()
    correct_decisions = serializers.IntegerField()
    incorrect_decisions = serializers.IntegerField()
    buy_accuracy = serializers.DecimalField(max_digits=5, decimal_places=2)
    sell_accuracy = serializers.DecimalField(max_digits=5, decimal_places=2)
    correct_buy_signals = serializers.IntegerField()
    incorrect_buy_signals = serializers.IntegerField()
    correct_sell_signals = serializers.IntegerField()
    incorrect_sell_signals = serializers.IntegerField()


class ValidationComparisonSerializer(serializers.Serializer):
    """Serializer for validation comparison results."""

    bot_simulation_config_id = serializers.UUIDField()
    simulated_profit_loss = serializers.DecimalField(max_digits=15, decimal_places=2)
    actual_profit_loss = serializers.DecimalField(max_digits=15, decimal_places=2)
    accuracy_score = serializers.DecimalField(max_digits=5, decimal_places=2)


class BotSimulationTickSerializer(serializers.ModelSerializer):
    """Serializer for BotSimulationTick model."""

    class Meta:
        model = BotSimulationTick
        fields = "__all__"
        read_only_fields = ["id", "simulation_config"]
