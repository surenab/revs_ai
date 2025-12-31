"""
URL configuration for Celery task monitoring.
"""

from django.urls import path

from . import celery_views

app_name = "celery_monitoring"

urlpatterns = [
    path("tasks/", celery_views.CeleryTasksListView.as_view(), name="tasks-list"),
    path(
        "tasks/<str:task_id>/",
        celery_views.CeleryTaskDetailView.as_view(),
        name="task-detail",
    ),
    path(
        "tasks/<str:task_id>/cancel/",
        celery_views.CeleryTaskCancelView.as_view(),
        name="task-cancel",
    ),
    path(
        "tasks/<str:task_id>/retry/",
        celery_views.CeleryTaskRetryView.as_view(),
        name="task-retry",
    ),
    path(
        "workers/",
        celery_views.CeleryWorkersStatusView.as_view(),
        name="workers-status",
    ),
]
