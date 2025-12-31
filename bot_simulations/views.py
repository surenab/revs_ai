"""
Views for bot simulation functionality.
"""

import logging
from datetime import timedelta

from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from bot_simulations.models import (
    BotSimulationConfig,
    BotSimulationResult,
    BotSimulationRun,
)
from bot_simulations.serializers import (
    BotSimulationConfigSerializer,
    BotSimulationResultSerializer,
    BotSimulationRunSerializer,
)

logger = logging.getLogger(__name__)


# Simulation Views
class BotSimulationCreateView(APIView):
    """Create a new bot simulation run."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """Create a new simulation run."""
        serializer = BotSimulationRunSerializer(data=request.data)
        if serializer.is_valid():
            simulation_run = serializer.save(user=request.user)
            # Simulation is created in "pending" status and must be started manually
            # via the resume/start endpoint or management command

            return Response(
                BotSimulationRunSerializer(simulation_run).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BotSimulationListView(generics.ListAPIView):
    """List all simulation runs for the authenticated user."""

    serializer_class = BotSimulationRunSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return simulation runs for the current user."""
        queryset = BotSimulationRun.objects.all()
        # If user is not admin, filter by user
        if not (self.request.user.is_staff or self.request.user.is_superuser):
            queryset = queryset.filter(user=self.request.user)
        return queryset.order_by("-created_at")


class BotSimulationDetailView(generics.RetrieveUpdateAPIView):
    """Get details of a specific simulation run or update it."""

    serializer_class = BotSimulationRunSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "id"

    def get_queryset(self):
        """Return simulation runs for the current user."""
        return BotSimulationRun.objects.filter(user=self.request.user)

    def update(self, request, *args, **kwargs):
        """Update simulation run - only allow if pending or failed."""
        instance = self.get_object()

        # Only allow editing if simulation is pending or failed
        if instance.status not in ["pending", "failed"]:
            return Response(
                {"error": "Can only edit simulations that are pending or failed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        return Response(serializer.data)


class BotSimulationStatusView(APIView):
    """Get status of a simulation run."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, simulation_id):
        """Return simulation status and progress."""
        try:
            simulation_run = BotSimulationRun.objects.get(
                id=simulation_id, user=request.user
            )
        except BotSimulationRun.DoesNotExist:
            return Response(
                {"error": "Simulation not found"}, status=status.HTTP_404_NOT_FOUND
            )

        return Response(
            {
                "id": str(simulation_run.id),
                "status": simulation_run.status,
                "progress": float(simulation_run.progress),
                "current_day": simulation_run.current_day.isoformat()
                if simulation_run.current_day
                else None,
                "bots_completed": simulation_run.bots_completed,
                "total_bots": simulation_run.total_bots,
                "started_at": simulation_run.started_at.isoformat()
                if simulation_run.started_at
                else None,
                "completed_at": simulation_run.completed_at.isoformat()
                if simulation_run.completed_at
                else None,
                "error_message": simulation_run.error_message,
            },
            status=status.HTTP_200_OK,
        )


class BotSimulationResultsView(APIView):
    """Get aggregated results for a simulation run."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, simulation_id):
        """Return simulation results."""
        try:
            simulation_run = BotSimulationRun.objects.get(
                id=simulation_id, user=request.user
            )
        except BotSimulationRun.DoesNotExist:
            return Response(
                {"error": "Simulation not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Get all bot configs for this simulation
        bot_configs = BotSimulationConfig.objects.filter(
            simulation_run=simulation_run
        ).order_by("bot_index")

        # Get all bot results
        bot_results = (
            BotSimulationResult.objects.filter(
                simulation_config__simulation_run=simulation_run
            )
            .select_related("simulation_config")
            .order_by("-total_profit")
        )

        # Log for debugging
        import logging

        logger = logging.getLogger(__name__)
        logger.info(
            f"Simulation {simulation_id}: Found {bot_configs.count()} bot configs, "
            f"{bot_results.count()} results"
        )

        results_data = BotSimulationResultSerializer(bot_results, many=True).data

        return Response(
            {
                "simulation": BotSimulationRunSerializer(simulation_run).data,
                "results": results_data,
                "total_bots": bot_configs.count(),
                "results_count": bot_results.count(),
                "top_performers": simulation_run.top_performers,
            },
            status=status.HTTP_200_OK,
        )


class BotSimulationProgressView(APIView):
    """Get real-time progress updates for a simulation run."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, simulation_id):
        """Return live progress information."""
        try:
            simulation_run = BotSimulationRun.objects.get(
                id=simulation_id, user=request.user
            )
        except BotSimulationRun.DoesNotExist:
            return Response(
                {"error": "Simulation not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Get all bot progress details
        bot_progress_list = [
            {
                "bot_index": bot_config.bot_index,
                "status": bot_config.status,
                "progress": float(bot_config.progress_percentage),
                "current_date": bot_config.current_date.isoformat()
                if bot_config.current_date
                else None,
                "current_tick_index": bot_config.current_tick_index,
            }
            for bot_config in BotSimulationConfig.objects.filter(
                simulation_run=simulation_run
            ).order_by("bot_index")
        ]

        return Response(
            {
                "simulation": {
                    "status": simulation_run.status,
                    "progress": float(simulation_run.progress),
                    "current_day": simulation_run.current_day.isoformat()
                    if simulation_run.current_day
                    else None,
                    "bots_completed": simulation_run.bots_completed,
                    "total_bots": simulation_run.total_bots,
                },
                "bots": bot_progress_list,
                "estimated_completion": self._estimate_completion(simulation_run),
            },
            status=status.HTTP_200_OK,
        )

    def _estimate_completion(self, simulation_run: BotSimulationRun) -> str | None:
        """
        Estimate completion time based on actual bot execution times.
        Uses moving average of recent bot completion times for better accuracy.
        """
        if simulation_run.status != "running" or not simulation_run.started_at:
            return None

        if simulation_run.bots_completed == 0:
            return None

        execution_times = simulation_run.bot_execution_times or []
        remaining_bots = simulation_run.total_bots - simulation_run.bots_completed

        if remaining_bots == 0:
            # Already completed
            return None

        # Use execution times if available (more accurate)
        if execution_times:
            # Use recent execution times (last 20 bots) for better accuracy
            # This accounts for variations in execution time
            recent_times = (
                execution_times[-20:] if len(execution_times) > 20 else execution_times
            )

            # Calculate average time per bot from recent executions
            avg_time_per_bot = sum(recent_times) / len(recent_times)

            # Apply a small buffer (5%) to account for variance
            avg_time_per_bot = avg_time_per_bot * 1.05

            # If we have enough data, use weighted average (more recent = higher weight)
            if len(recent_times) >= 5:
                weights = [i + 1 for i in range(len(recent_times))]  # Linear weights
                weighted_sum = sum(
                    t * w for t, w in zip(recent_times, weights, strict=False)
                )
                weight_sum = sum(weights)
                avg_time_per_bot = (weighted_sum / weight_sum) * 1.05
        else:
            # Fallback: use overall elapsed time if no individual times available
            elapsed = timezone.now() - simulation_run.started_at
            avg_time_per_bot = elapsed.total_seconds() / simulation_run.bots_completed

        # Calculate estimated remaining time
        estimated_remaining_seconds = avg_time_per_bot * remaining_bots
        estimated_remaining = timedelta(seconds=estimated_remaining_seconds)
        estimated_completion = timezone.now() + estimated_remaining

        return estimated_completion.isoformat()


class BotSimulationCancelView(APIView):
    """Cancel a running simulation."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, simulation_id):
        """Cancel the simulation."""
        try:
            simulation_run = BotSimulationRun.objects.get(
                id=simulation_id, user=request.user
            )
        except BotSimulationRun.DoesNotExist:
            return Response(
                {"error": "Simulation not found"}, status=status.HTTP_404_NOT_FOUND
            )

        if simulation_run.status not in ["running", "paused"]:
            return Response(
                {"error": f"Simulation is {simulation_run.status}, cannot cancel"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        simulation_run.status = "cancelled"
        simulation_run.save()

        return Response(
            {"message": "Simulation cancelled", "status": "cancelled"},
            status=status.HTTP_200_OK,
        )


class BotSimulationPauseView(APIView):
    """Pause a running simulation."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, simulation_id):
        """Pause the simulation."""
        try:
            simulation_run = BotSimulationRun.objects.get(
                id=simulation_id, user=request.user
            )
        except BotSimulationRun.DoesNotExist:
            return Response(
                {"error": "Simulation not found"}, status=status.HTTP_404_NOT_FOUND
            )

        if simulation_run.status != "running":
            return Response(
                {"error": f"Simulation is {simulation_run.status}, cannot pause"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        simulation_run.status = "paused"
        simulation_run.save()

        return Response(
            {"message": "Simulation paused", "status": "paused"},
            status=status.HTTP_200_OK,
        )


class BotSimulationResumeView(APIView):
    """Resume a paused simulation or start a pending simulation."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, simulation_id):
        """Resume a paused simulation or start a pending simulation."""
        try:
            simulation_run = BotSimulationRun.objects.get(
                id=simulation_id, user=request.user
            )
        except BotSimulationRun.DoesNotExist:
            return Response(
                {"error": "Simulation not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Handle pending status - start the simulation
        if simulation_run.status == "pending":
            try:
                from bot_simulations.tasks import run_bot_simulation_task

                # Create and enqueue the Celery task
                task = run_bot_simulation_task.delay(str(simulation_run.id))
                logger.info(
                    f"Created Celery task {task.id} for simulation {simulation_run.id}"
                )

                # Update simulation status to running
                simulation_run.status = "running"
                if not simulation_run.started_at:
                    simulation_run.started_at = timezone.now()
                simulation_run.save()

                return Response(
                    {
                        "message": "Simulation started",
                        "status": "running",
                        "task_id": task.id,
                    },
                    status=status.HTTP_200_OK,
                )
            except Exception as e:
                logger.exception(
                    f"Failed to start Celery task for simulation {simulation_run.id}: {e}"
                )
                # Revert status if task creation failed
                simulation_run.status = "pending"
                simulation_run.save()
                return Response(
                    {"error": f"Failed to start simulation: {e!s}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        # Handle paused status - resume the simulation
        if simulation_run.status != "paused":
            return Response(
                {"error": f"Simulation is {simulation_run.status}, cannot resume"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create and enqueue the Celery task to resume
        try:
            from bot_simulations.tasks import run_bot_simulation_task

            task = run_bot_simulation_task.delay(str(simulation_run.id))
            logger.info(
                f"Created Celery task {task.id} to resume simulation {simulation_run.id}"
            )

            # Update simulation status to running
            simulation_run.status = "running"
            simulation_run.save()

            return Response(
                {
                    "message": "Simulation resumed",
                    "status": "running",
                    "task_id": task.id,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.exception(
                f"Failed to resume Celery task for simulation {simulation_run.id}: {e}"
            )
            # Revert status if task creation failed
            simulation_run.status = "paused"
            simulation_run.save()
            return Response(
                {"error": f"Failed to resume simulation: {e!s}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class BotSimulationRerunView(APIView):
    """Rerun a simulation by creating a new simulation with the same configuration."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, simulation_id):
        """Create a new simulation with the same config and start it."""
        try:
            original_simulation = BotSimulationRun.objects.get(
                id=simulation_id, user=request.user
            )
        except BotSimulationRun.DoesNotExist:
            return Response(
                {"error": "Simulation not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Create a new simulation with the same configuration
        # Note: use_social_analysis and use_news_analysis are stored in config_ranges,
        # not as direct fields on BotSimulationRun
        new_simulation_data = {
            "name": f"{original_simulation.name} (Rerun)",
            "execution_start_date": original_simulation.execution_start_date.isoformat()
            if original_simulation.execution_start_date
            else None,
            "execution_end_date": original_simulation.execution_end_date.isoformat()
            if original_simulation.execution_end_date
            else None,
            "config_ranges": original_simulation.config_ranges or {},
            "simulation_type": original_simulation.simulation_type,
            "initial_fund": str(original_simulation.initial_fund),
            "initial_portfolio": original_simulation.initial_portfolio or {},
        }

        # Get stock IDs
        stock_ids = list(original_simulation.stocks.values_list("id", flat=True))
        new_simulation_data["stock_ids"] = [str(sid) for sid in stock_ids]

        serializer = BotSimulationRunSerializer(data=new_simulation_data)
        if serializer.is_valid():
            new_simulation = serializer.save(user=request.user)

            # Start the new simulation immediately
            try:
                from bot_simulations.tasks import run_bot_simulation_task

                task = run_bot_simulation_task.delay(str(new_simulation.id))
                logger.info(
                    f"Created Celery task {task.id} for rerun simulation {new_simulation.id}"
                )

                # Update simulation status to running
                new_simulation.status = "running"
                new_simulation.started_at = timezone.now()
                new_simulation.save()

                return Response(
                    {
                        "message": "Simulation rerun started",
                        "simulation": BotSimulationRunSerializer(new_simulation).data,
                        "status": "running",
                        "task_id": task.id,
                    },
                    status=status.HTTP_201_CREATED,
                )
            except Exception as e:
                logger.exception(
                    f"Failed to start Celery task for rerun simulation {new_simulation.id}: {e}"
                )
                # Revert status if task creation failed
                new_simulation.status = "pending"
                new_simulation.save()
                return Response(
                    {"error": f"Failed to start rerun simulation: {e!s}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BotSimulationConfigListView(generics.ListAPIView):
    """List all bot configurations for a simulation run."""

    serializer_class = BotSimulationConfigSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return bot configs for the specified simulation run."""
        simulation_run_id = self.kwargs["simulation_run_id"]
        return BotSimulationConfig.objects.filter(
            simulation_run_id=simulation_run_id
        ).order_by("bot_index")


class BotSimulationConfigDetailView(generics.RetrieveAPIView):
    """Get details of a specific bot configuration."""

    serializer_class = BotSimulationConfigSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = BotSimulationConfig.objects.all()


class BotSimulationResultDetailView(generics.RetrieveAPIView):
    """Get results for a specific bot configuration."""

    serializer_class = BotSimulationResultSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        """Retrieve result by simulation_config_id."""
        simulation_config_id = self.kwargs["simulation_config_id"]
        return generics.get_object_or_404(
            BotSimulationResult, simulation_config__id=simulation_config_id
        )


class BotSimulationBotProgressView(APIView):
    """Get progress details for a specific bot configuration."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, simulation_id, bot_id):
        """Return progress details for a specific bot."""
        try:
            simulation_run = BotSimulationRun.objects.get(
                id=simulation_id, user=request.user
            )
            bot_config = BotSimulationConfig.objects.get(
                id=bot_id, simulation_run=simulation_run
            )
        except (BotSimulationRun.DoesNotExist, BotSimulationConfig.DoesNotExist):
            return Response(
                {"error": "Simulation or bot config not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get tick count for current day if available
        total_ticks_today = 0
        if bot_config.current_date:
            from bot_simulations.models import BotSimulationTick

            total_ticks_today = BotSimulationTick.objects.filter(
                simulation_config=bot_config, date=bot_config.current_date
            ).count()

        return Response(
            {
                "bot_index": bot_config.bot_index,
                "status": bot_config.status,
                "progress": float(bot_config.progress_percentage),
                "current_date": bot_config.current_date.isoformat()
                if bot_config.current_date
                else None,
                "current_tick_index": bot_config.current_tick_index,
                "total_ticks_today": total_ticks_today,
                "config": BotSimulationConfigSerializer(bot_config).data,
            },
            status=status.HTTP_200_OK,
        )


class BotSimulationTicksView(APIView):
    """Get tick-level results for a simulation."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, simulation_id):
        """Return tick-level results."""
        try:
            simulation_run = BotSimulationRun.objects.get(
                id=simulation_id, user=request.user
            )
        except BotSimulationRun.DoesNotExist:
            return Response(
                {"error": "Simulation not found"}, status=status.HTTP_404_NOT_FOUND
            )

        from bot_simulations.models import BotSimulationTick

        bot_config_id = request.query_params.get("bot_config_id")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        stock_symbol = request.query_params.get("stock_symbol")

        queryset = BotSimulationTick.objects.filter(
            simulation_config__simulation_run=simulation_run
        )

        if bot_config_id:
            queryset = queryset.filter(simulation_config_id=bot_config_id)
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)
        if stock_symbol:
            queryset = queryset.filter(stock_symbol=stock_symbol)

        queryset = queryset.order_by("date", "tick_timestamp")[
            :1000
        ]  # Limit to 1000 ticks

        ticks_data = [
            {
                "id": str(tick.id),
                "date": tick.date.isoformat(),
                "tick_timestamp": tick.tick_timestamp.isoformat(),
                "stock_symbol": tick.stock_symbol,
                "tick_price": float(tick.tick_price),
                "decision": tick.decision,
                "signal_contributions": tick.signal_contributions,
                "portfolio_state": tick.portfolio_state,
                "cumulative_profit": float(tick.cumulative_profit),
                "trade_executed": tick.trade_executed,
                "trade_details": tick.trade_details,
            }
            for tick in queryset
        ]

        return Response(
            {
                "simulation_id": str(simulation_run.id),
                "total_ticks": len(ticks_data),
                "ticks": ticks_data,
            },
            status=status.HTTP_200_OK,
        )


class BotSimulationDayListView(generics.ListAPIView):
    """List daily results for a bot configuration."""

    from bot_simulations.serializers import BotSimulationDaySerializer

    serializer_class = BotSimulationDaySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return daily results for the specified bot config."""
        from bot_simulations.models import BotSimulationDay

        simulation_config_id = self.kwargs["simulation_config_id"]
        phase = self.request.query_params.get("phase", None)
        queryset = BotSimulationDay.objects.filter(
            simulation_config_id=simulation_config_id
        )
        if phase:
            # Filter by phase if specified
            queryset = queryset.filter(performance_metrics__phase=phase)
        return queryset.order_by("date")


class BotSimulationComprehensiveAnalysisView(APIView):
    """Get comprehensive analysis of simulation results."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, simulation_id):
        """Return comprehensive analysis including best bots, indicators, and patterns."""
        try:
            simulation_run = BotSimulationRun.objects.get(
                id=simulation_id, user=request.user
            )
        except BotSimulationRun.DoesNotExist:
            return Response(
                {"error": "Simulation not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Get all bot results
        bot_results = (
            BotSimulationResult.objects.filter(
                simulation_config__simulation_run=simulation_run
            )
            .select_related("simulation_config")
            .order_by("-total_profit")
        )

        if not bot_results.exists():
            return Response(
                {"error": "No results found for this simulation"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Analyze which indicators/patterns impact results the most
        indicator_impact = self._analyze_indicator_impact(bot_results)
        pattern_impact = self._analyze_pattern_impact(bot_results)
        signal_impact = self._analyze_signal_impact(bot_results)

        # Get top performers
        top_performers = [
            {
                "bot_index": result.simulation_config.bot_index,
                "total_profit": float(result.total_profit),
                "win_rate": float(result.win_rate),
                "total_trades": result.total_trades,
                "config": result.simulation_config.config_json,
            }
            for result in bot_results[:10]
        ]

        # Get day-by-day performance for top bot
        top_bot_result = bot_results.first()
        daily_performance = self._get_daily_performance(
            top_bot_result.simulation_config
        )

        return Response(
            {
                "simulation_id": str(simulation_run.id),
                "simulation_name": simulation_run.name,
                "total_bots": simulation_run.total_bots,
                "top_performers": top_performers,
                "indicator_impact": indicator_impact,
                "pattern_impact": pattern_impact,
                "signal_impact": signal_impact,
                "daily_performance": daily_performance,
            },
            status=status.HTTP_200_OK,
        )

    def _analyze_indicator_impact(self, bot_results):
        """Analyze which indicators contribute most to successful bots."""
        from collections import defaultdict

        indicator_scores = defaultdict(list)

        for result in bot_results:
            config = result.simulation_config.config_json
            signal_weights = config.get("signal_weights", {})
            indicator_weight = signal_weights.get("indicator", 0.0)

            # Score based on profit and win rate
            score = float(result.total_profit) * (float(result.win_rate) / 100.0)
            indicator_scores["indicator"].append(
                {
                    "weight": indicator_weight,
                    "score": score,
                    "profit": float(result.total_profit),
                }
            )

        # Calculate average impact
        impact_analysis = {}
        for indicator_type, scores in indicator_scores.items():
            if scores:
                avg_score = sum(s["score"] for s in scores) / len(scores)
                avg_weight = sum(s["weight"] for s in scores) / len(scores)
                impact_analysis[indicator_type] = {
                    "average_impact_score": avg_score,
                    "average_weight": avg_weight,
                    "bot_count": len(scores),
                }

        return impact_analysis

    def _analyze_pattern_impact(self, bot_results):
        """Analyze which patterns contribute most to successful bots."""
        from collections import defaultdict

        pattern_scores = defaultdict(list)

        for result in bot_results:
            config = result.simulation_config.config_json
            signal_weights = config.get("signal_weights", {})
            pattern_weight = signal_weights.get("pattern", 0.0)

            # Score based on profit and win rate
            score = float(result.total_profit) * (float(result.win_rate) / 100.0)
            pattern_scores["pattern"].append(
                {
                    "weight": pattern_weight,
                    "score": score,
                    "profit": float(result.total_profit),
                }
            )

        # Calculate average impact
        impact_analysis = {}
        for pattern_type, scores in pattern_scores.items():
            if scores:
                avg_score = sum(s["score"] for s in scores) / len(scores)
                avg_weight = sum(s["weight"] for s in scores) / len(scores)
                impact_analysis[pattern_type] = {
                    "average_impact_score": avg_score,
                    "average_weight": avg_weight,
                    "bot_count": len(scores),
                }

        return impact_analysis

    def _analyze_signal_impact(self, bot_results):
        """Analyze signal productivity across all bots."""
        from collections import defaultdict

        signal_stats = defaultdict(
            lambda: {
                "total_contributions": 0,
                "total_profit": 0.0,
                "total_win_rate": 0.0,
                "bot_count": 0,
            }
        )

        for result in bot_results:
            signal_productivity = result.signal_productivity or {}
            for signal_type, stats in signal_productivity.items():
                signal_stats[signal_type]["total_contributions"] += stats.get(
                    "total_contributions", 0
                )
                signal_stats[signal_type]["total_profit"] += float(result.total_profit)
                signal_stats[signal_type]["total_win_rate"] += float(result.win_rate)
                signal_stats[signal_type]["bot_count"] += 1

        # Calculate averages
        impact_analysis = {}
        for signal_type, stats in signal_stats.items():
            if stats["bot_count"] > 0:
                impact_analysis[signal_type] = {
                    "average_contributions": stats["total_contributions"]
                    / stats["bot_count"],
                    "average_profit_impact": stats["total_profit"] / stats["bot_count"],
                    "average_win_rate": stats["total_win_rate"] / stats["bot_count"],
                    "total_contributions": stats["total_contributions"],
                    "bot_count": stats["bot_count"],
                }

        # Sort by average profit impact
        sorted_impact = sorted(
            impact_analysis.items(),
            key=lambda x: x[1]["average_profit_impact"],
            reverse=True,
        )

        return dict(sorted_impact)

    def _get_daily_performance(self, simulation_config):
        """Get day-by-day performance for execution phase."""
        from bot_simulations.models import BotSimulationDay

        daily_results = (
            BotSimulationDay.objects.filter(simulation_config=simulation_config)
            .filter(performance_metrics__phase="execution")
            .order_by("date")
        )

        daily_performance = []
        cumulative_profit = 0.0

        for day_result in daily_results:
            metrics = day_result.performance_metrics or {}
            daily_profit = metrics.get("daily_profit", 0.0)
            cumulative_profit += daily_profit

            daily_performance.append(
                {
                    "date": day_result.date.isoformat(),
                    "daily_profit": daily_profit,
                    "cumulative_profit": cumulative_profit,
                    "cash": metrics.get("cash", 0.0),
                    "portfolio_value": metrics.get("portfolio_value", 0.0),
                    "total_value": metrics.get("total_value", 0.0),
                    "trades_today": metrics.get("trades_today", 0),
                }
            )

        return daily_performance
