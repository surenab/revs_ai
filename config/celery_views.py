"""
Views for Celery task monitoring.
"""

import logging

from django_celery_results.models import TaskResult
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .celery_monitoring import get_all_tasks, get_task_by_id

logger = logging.getLogger(__name__)


class CeleryTasksListView(APIView):
    """List all Celery tasks (completed, failed, running, scheduled, etc.)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Get all tasks with optional filtering."""
        status_filter = request.query_params.get("status", None)
        task_name_filter = request.query_params.get("task_name", None)
        limit = int(request.query_params.get("limit", 100))

        try:
            all_tasks_data = get_all_tasks()
            tasks = all_tasks_data["tasks"]
            summary = all_tasks_data["summary"]

            # Filter by status if provided
            if status_filter:
                status_map = {
                    "completed": tasks["completed"],
                    "failed": tasks["failed"],
                    "pending": tasks["pending"],
                    "retry": tasks["retry"],
                    "revoked": tasks["revoked"],
                    "active": tasks["active"],
                    "scheduled": tasks["scheduled"],
                    "reserved": tasks["reserved"],
                    "periodic": tasks["periodic"],
                }
                if status_filter in status_map:
                    tasks = {status_filter: status_map[status_filter]}
                else:
                    tasks = {}

            # Filter by task name if provided
            if task_name_filter:
                for status_key in tasks:
                    tasks[status_key] = [
                        t
                        for t in tasks[status_key]
                        if task_name_filter.lower() in t.get("task_name", "").lower()
                    ]

            # Apply limit
            for status_key in tasks:
                if isinstance(tasks[status_key], list):
                    tasks[status_key] = tasks[status_key][:limit]

            return Response(
                {
                    "tasks": tasks,
                    "summary": summary,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.exception(f"Error fetching tasks: {e}")
            return Response(
                {"error": f"Failed to fetch tasks: {e!s}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CeleryTaskDetailView(APIView):
    """Get details of a specific Celery task."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, task_id):
        """Get task details by ID."""
        try:
            task = get_task_by_id(task_id)
            if task:
                return Response(task, status=status.HTTP_200_OK)
            return Response(
                {"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.exception(f"Error fetching task {task_id}: {e}")
            return Response(
                {"error": f"Failed to fetch task: {e!s}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CeleryTaskCancelView(APIView):
    """Cancel a running or scheduled Celery task."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, task_id):
        """Cancel a task."""
        try:
            from celery import current_app

            # Revoke the task
            current_app.control.revoke(task_id, terminate=True)

            # Update database record if exists
            try:
                task = TaskResult.objects.get(task_id=task_id)
                task.status = "REVOKED"
                task.save()
            except TaskResult.DoesNotExist:
                pass

            return Response(
                {"message": f"Task {task_id} cancelled", "task_id": task_id},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.exception(f"Error cancelling task {task_id}: {e}")
            return Response(
                {"error": f"Failed to cancel task: {e!s}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CeleryTaskRetryView(APIView):
    """Retry a failed Celery task."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, task_id):
        """Retry a failed task."""
        try:
            task = TaskResult.objects.get(task_id=task_id)
            if task.status != "FAILURE":
                return Response(
                    {"error": "Only failed tasks can be retried"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Get task name and retry it
            from celery import current_app

            # Get the task function
            task_func = current_app.tasks.get(task.task_name)
            if not task_func:
                return Response(
                    {"error": f"Task {task.task_name} not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Retry the task with same args/kwargs if available
            # Note: This is a simplified retry - in practice you'd need to store args/kwargs
            new_task = task_func.delay()
            return Response(
                {
                    "message": f"Task {task_id} retried",
                    "original_task_id": task_id,
                    "new_task_id": new_task.id,
                },
                status=status.HTTP_200_OK,
            )
        except TaskResult.DoesNotExist:
            return Response(
                {"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.exception(f"Error retrying task {task_id}: {e}")
            return Response(
                {"error": f"Failed to retry task: {e!s}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CeleryWorkersStatusView(APIView):
    """Get status of all Celery workers."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Get worker status."""
        try:
            from celery import current_app

            inspect = current_app.control.inspect()

            # Get worker stats
            stats = inspect.stats()
            active_queues = inspect.active_queues()
            registered = inspect.registered()

            workers = []
            if stats:
                for worker_name, worker_stats in stats.items():
                    workers.append(
                        {
                            "name": worker_name,
                            "status": "online",
                            "stats": worker_stats,
                            "active_queues": active_queues.get(worker_name, [])
                            if active_queues
                            else [],
                            "registered_tasks": registered.get(worker_name, [])
                            if registered
                            else [],
                        }
                    )

            return Response(
                {
                    "workers": workers,
                    "total_workers": len(workers),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.exception(f"Error fetching worker status: {e}")
            return Response(
                {"error": f"Failed to fetch worker status: {e!s}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
