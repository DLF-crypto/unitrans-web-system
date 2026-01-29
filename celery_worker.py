# Celery Worker 启动文件
# 这个文件用于确保Celery能正确找到任务定义
# 使用命令启动: celery -A celery_worker.celery worker --loglevel=info -P threads

from app import celery

# 导入所有任务函数，确保它们被注册
from app import (
    async_generate_customer_invoices,
    async_generate_supplier_invoices,
    auto_fetch_lastmile_tracking_task,
    async_fetch_tracking_task,
    async_fetch_lastmile_tracking_task
)
