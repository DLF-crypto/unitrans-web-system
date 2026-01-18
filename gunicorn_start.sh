#!/bin/bash
# Gunicorn 启动脚本

NAME="unitrans-web"
DIR=/var/www/unitrans-web-system
USER=www-data
GROUP=www-data
WORKERS=2
BIND=127.0.0.1:5001
WORKER_CLASS=sync
TIMEOUT=300
LOGLEVEL=info

cd $DIR
source venv/bin/activate

exec gunicorn app:app \
  --name $NAME \
  --workers $WORKERS \
  --worker-class=$WORKER_CLASS \
  --user=$USER \
  --group=$GROUP \
  --bind=$BIND \
  --timeout=$TIMEOUT \
  --log-level=$LOGLEVEL \
  --log-file=-
