"""
Celery task monitoring utilities.
"""

import logging
from typing import Any

from celery import current_app
from django_celery_beat.models import PeriodicTask
from django_celery_results.models import TaskResult

logger = logging.getLogger(__name__)


def get_all_tasks() -> dict[str, Any]:
    """
    Get all Celery tasks from various sources:
    - Completed/failed tasks from database (TaskResult)
    - Active/running tasks from Celery inspect
    - Scheduled tasks from PeriodicTask
    """
    tasks = {
        "completed": [],
        "failed": [],
        "pending": [],
        "retry": [],
        "revoked": [],
        "active": [],
        "scheduled": [],
        "reserved": [],
        "periodic": [],
    }

    try:
        # Get completed and failed tasks from database
        completed_tasks = TaskResult.objects.filter(status="SUCCESS").order_by(
            "-date_done"
        )[:100]
        failed_tasks = TaskResult.objects.filter(status="FAILURE").order_by(
            "-date_done"
        )[:100]
        pending_tasks = TaskResult.objects.filter(status="PENDING").order_by(
            "-date_created"
        )[:50]
        retry_tasks = TaskResult.objects.filter(status="RETRY").order_by(
            "-date_created"
        )[:50]
        revoked_tasks = TaskResult.objects.filter(status="REVOKED").order_by(
            "-date_done"
        )[:50]

        tasks["completed"] = [
            {
                "task_id": task.task_id,
                "task_name": task.task_name,
                "status": task.status,
                "date_created": task.date_created.isoformat()
                if task.date_created
                else None,
                "date_done": task.date_done.isoformat() if task.date_done else None,
                "result": task.result,
                "traceback": task.traceback,
                "worker": task.worker,
                "meta": task.meta,
            }
            for task in completed_tasks
        ]

        tasks["failed"] = [
            {
                "task_id": task.task_id,
                "task_name": task.task_name,
                "status": task.status,
                "date_created": task.date_created.isoformat()
                if task.date_created
                else None,
                "date_done": task.date_done.isoformat() if task.date_done else None,
                "result": task.result,
                "traceback": task.traceback,
                "worker": task.worker,
                "meta": task.meta,
            }
            for task in failed_tasks
        ]

        tasks["pending"] = [
            {
                "task_id": task.task_id,
                "task_name": task.task_name,
                "status": task.status,
                "date_created": task.date_created.isoformat()
                if task.date_created
                else None,
                "date_done": task.date_done.isoformat() if task.date_done else None,
                "result": task.result,
                "traceback": task.traceback,
                "worker": task.worker,
                "meta": task.meta,
            }
            for task in pending_tasks
        ]

        tasks["retry"] = [
            {
                "task_id": task.task_id,
                "task_name": task.task_name,
                "status": task.status,
                "date_created": task.date_created.isoformat()
                if task.date_created
                else None,
                "date_done": task.date_done.isoformat() if task.date_done else None,
                "result": task.result,
                "traceback": task.traceback,
                "worker": task.worker,
                "meta": task.meta,
            }
            for task in retry_tasks
        ]

        tasks["revoked"] = [
            {
                "task_id": task.task_id,
                "task_name": task.task_name,
                "status": task.status,
                "date_created": task.date_created.isoformat()
                if task.date_created
                else None,
                "date_done": task.date_done.isoformat() if task.date_done else None,
                "result": task.result,
                "traceback": task.traceback,
                "worker": task.worker,
                "meta": task.meta,
            }
            for task in revoked_tasks
        ]

    except Exception as e:
        logger.exception(f"Error fetching tasks from database: {e}")

    try:
        # Get active/running tasks from Celery inspect
        inspect = current_app.control.inspect()

        # Active tasks (currently running)
        active = inspect.active()
        if active:
            for worker, worker_tasks in active.items():
                for task in worker_tasks:
                    tasks["active"].append(
                        {
                            "task_id": task.get("id"),
                            "task_name": task.get("name"),
                            "worker": worker,
                            "args": task.get("args"),
                            "kwargs": task.get("kwargs"),
                            "time_start": task.get("time_start"),
                            "acknowledged": task.get("acknowledged"),
                        }
                    )

        # Scheduled tasks (waiting to run)
        scheduled = inspect.scheduled()
        if scheduled:
            for worker, worker_tasks in scheduled.items():
                for task in worker_tasks:
                    tasks["scheduled"].append(
                        {
                            "task_id": task.get("request", {}).get("id"),
                            "task_name": task.get("request", {}).get("task"),
                            "worker": worker,
                            "eta": task.get("eta"),
                            "priority": task.get("priority"),
                            "args": task.get("request", {}).get("args"),
                            "kwargs": task.get("request", {}).get("kwargs"),
                        }
                    )

        # Reserved tasks (prefetched by worker)
        reserved = inspect.reserved()
        if reserved:
            for worker, worker_tasks in reserved.items():
                for task in worker_tasks:
                    tasks["reserved"].append(
                        {
                            "task_id": task.get("id"),
                            "task_name": task.get("name"),
                            "worker": worker,
                            "args": task.get("args"),
                            "kwargs": task.get("kwargs"),
                        }
                    )

    except Exception as e:
        logger.exception(f"Error fetching tasks from Celery inspect: {e}")

    try:
        # Get periodic/scheduled tasks from django_celery_beat
        periodic_tasks = PeriodicTask.objects.filter(enabled=True).order_by("name")
        tasks["periodic"] = [
            {
                "id": task.id,
                "name": task.name,
                "task": task.task,
                "enabled": task.enabled,
                "last_run_at": task.last_run_at.isoformat()
                if task.last_run_at
                else None,
                "total_run_count": task.total_run_count,
                "interval": {
                    "every": task.interval.every,
                    "period": task.interval.period,
                }
                if task.interval
                else None,
                "crontab": {
                    "minute": task.crontab.minute,
                    "hour": task.crontab.hour,
                    "day_of_week": task.crontab.day_of_week,
                    "day_of_month": task.crontab.day_of_month,
                    "month_of_year": task.crontab.month_of_year,
                    "timezone": str(task.crontab.timezone)
                    if task.crontab and task.crontab.timezone
                    else None,
                }
                if task.crontab
                else None,
                "args": task.args,
                "kwargs": task.kwargs,
                "queue": task.queue,
                "exchange": task.exchange,
                "routing_key": task.routing_key,
            }
            for task in periodic_tasks
        ]
    except Exception as e:
        logger.exception(f"Error fetching periodic tasks: {e}")

    # Calculate summary statistics
    summary = {
        "total_completed": len(tasks["completed"]),
        "total_failed": len(tasks["failed"]),
        "total_pending": len(tasks["pending"]),
        "total_retry": len(tasks["retry"]),
        "total_revoked": len(tasks["revoked"]),
        "total_active": len(tasks["active"]),
        "total_scheduled": len(tasks["scheduled"]),
        "total_reserved": len(tasks["reserved"]),
        "total_periodic": len(tasks["periodic"]),
        "total_all": (
            len(tasks["completed"])
            + len(tasks["failed"])
            + len(tasks["pending"])
            + len(tasks["retry"])
            + len(tasks["revoked"])
            + len(tasks["active"])
            + len(tasks["scheduled"])
            + len(tasks["reserved"])
        ),
    }

    return {"tasks": tasks, "summary": summary}


def get_task_by_id(task_id: str) -> dict[str, Any] | None:
    """Get a specific task by ID from database or active tasks."""
    try:
        # Try database first
        task = TaskResult.objects.get(task_id=task_id)
        return {
            "task_id": task.task_id,
            "task_name": task.task_name,
            "status": task.status,
            "date_created": task.date_created.isoformat()
            if task.date_created
            else None,
            "date_done": task.date_done.isoformat() if task.date_done else None,
            "result": task.result,
            "traceback": task.traceback,
            "worker": task.worker,
            "meta": task.meta,
        }
    except TaskResult.DoesNotExist:
        # Try active tasks
        try:
            inspect = current_app.control.inspect()
            active = inspect.active()
            if active:
                for worker, worker_tasks in active.items():
                    for task in worker_tasks:
                        if task.get("id") == task_id:
                            return {
                                "task_id": task.get("id"),
                                "task_name": task.get("name"),
                                "status": "ACTIVE",
                                "worker": worker,
                                "args": task.get("args"),
                                "kwargs": task.get("kwargs"),
                                "time_start": task.get("time_start"),
                                "acknowledged": task.get("acknowledged"),
                            }
        except Exception as e:
            logger.exception(f"Error fetching active task {task_id}: {e}")

    return None
