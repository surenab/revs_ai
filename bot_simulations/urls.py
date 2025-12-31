"""
URL configuration for bot_simulations app.
"""

from django.urls import path

from . import views

app_name = "bot_simulations"

urlpatterns = [
    path("simulations/", views.BotSimulationListView.as_view(), name="simulation-list"),
    path(
        "simulations/create/",
        views.BotSimulationCreateView.as_view(),
        name="simulation-create",
    ),
    path(
        "simulations/<uuid:id>/",
        views.BotSimulationDetailView.as_view(),
        name="simulation-detail",
    ),
    path(
        "simulations/<uuid:simulation_id>/status/",
        views.BotSimulationStatusView.as_view(),
        name="simulation-status",
    ),
    path(
        "simulations/<uuid:simulation_id>/progress/",
        views.BotSimulationProgressView.as_view(),
        name="simulation-progress",
    ),
    path(
        "simulations/<uuid:simulation_id>/results/",
        views.BotSimulationResultsView.as_view(),
        name="simulation-results",
    ),
    path(
        "simulations/<uuid:simulation_id>/analysis/",
        views.BotSimulationComprehensiveAnalysisView.as_view(),
        name="simulation-analysis",
    ),
    path(
        "simulations/<uuid:simulation_id>/cancel/",
        views.BotSimulationCancelView.as_view(),
        name="simulation-cancel",
    ),
    path(
        "simulations/<uuid:simulation_id>/pause/",
        views.BotSimulationPauseView.as_view(),
        name="simulation-pause",
    ),
    path(
        "simulations/<uuid:simulation_id>/resume/",
        views.BotSimulationResumeView.as_view(),
        name="simulation-resume",
    ),
    path(
        "simulations/<uuid:simulation_id>/rerun/",
        views.BotSimulationRerunView.as_view(),
        name="simulation-rerun",
    ),
    path(
        "simulations/configs/<uuid:simulation_run_id>/",
        views.BotSimulationConfigListView.as_view(),
        name="simulation-config-list",
    ),
    path(
        "simulations/configs/detail/<uuid:pk>/",
        views.BotSimulationConfigDetailView.as_view(),
        name="simulation-config-detail",
    ),
    path(
        "simulations/results/<uuid:simulation_config_id>/",
        views.BotSimulationResultDetailView.as_view(),
        name="simulation-result-detail",
    ),
    path(
        "simulations/daily-results/<uuid:simulation_config_id>/",
        views.BotSimulationDayListView.as_view(),
        name="simulation-daily-results",
    ),
    path(
        "simulations/<uuid:simulation_id>/bots/<uuid:bot_id>/progress/",
        views.BotSimulationBotProgressView.as_view(),
        name="simulation-bot-progress",
    ),
    path(
        "simulations/<uuid:simulation_id>/results/ticks/",
        views.BotSimulationTicksView.as_view(),
        name="simulation-ticks",
    ),
]
