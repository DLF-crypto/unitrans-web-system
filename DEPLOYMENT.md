# Unitrans Web System 部署指南

## 一、服务器环境准备

### 1. 系统信息
- 操作系统：Ubuntu Server 24.04 LTS 64位
- 配置：2核4GiB 1Mbps
- 已占用端口：5000 (cnpost-bill)
- 新项目端口：5001 (unitrans-web-system)

### 2. 连接服务器
```bash
ssh your_username@your_server_ip
```

---

## 二、安装必要软件

### 1. 更新系统
```bash
sudo apt update
sudo apt upgrade -y
```

### 2. 安装 Python 3 和 pip
```bash
sudo apt install python3 python3-pip python3-venv -y
```

### 3. 安装 MySQL（如果还没有）
```bash
sudo apt install mysql-server -y
sudo mysql_secure_installation
```

配置 MySQL：
```bash
sudo mysql
```

在 MySQL 中执行：
```sql
-- 创建数据库
CREATE DATABASE unitransDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户（使用强密码）
CREATE USER 'unitrans_user'@'localhost' IDENTIFIED BY 'your_strong_password_here';

-- 授权
GRANT ALL PRIVILEGES ON unitransDB.* TO 'unitrans_user'@'localhost';
FLUSH PRIVILEGES;

-- 退出
EXIT;
```

### 4. 安装 Redis
```bash
sudo apt install redis-server -y
```

配置 Redis（为了安全，修改端口和密码）：
```bash
sudo nano /etc/redis/redis.conf
```

修改以下内容：
```conf
# 修改端口（避免与默认 6379 冲突）
port 6380

# 设置密码
requirepass your_redis_password_here

# 绑定地址（仅本地访问）
bind 127.0.0.1

# 后台运行
daemonize yes
```

重启 Redis：
```bash
sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

验证 Redis：
```bash
redis-cli -p 6380 -a your_redis_password_here ping
# 应该返回 PONG
```

---

## 三、部署项目

### 1. 创建项目目录
```bash
sudo mkdir -p /var/www/unitrans-web-system
sudo chown -R $USER:$USER /var/www/unitrans-web-system
cd /var/www/unitrans-web-system
```

### 2. 初始化 Git（本地开发环境）
在您的 Windows 开发机器上：

```bash
# 进入项目目录
cd "e:\360MoveData\Users\Admin\Desktop\Python Project\unitrans web system"

# 初始化 git
git init
git add .
git commit -m "Initial commit"

# 在 GitHub 创建仓库后，关联远程仓库
git remote add origin https://github.com/your_username/unitrans-web-system.git
git branch -M main
git push -u origin main
```

### 3. 从 GitHub 克隆到服务器
```bash
cd /var/www/unitrans-web-system
git clone https://github.com/your_username/unitrans-web-system.git .
```

### 4. 创建 Python 虚拟环境
```bash
python3 -m venv venv
source venv/bin/activate
```

### 5. 安装依赖
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 6. 创建必要的文件夹
```bash
mkdir -p "customer invoices"
mkdir -p "supplier invoices"
mkdir -p uploads
mkdir -p pictures
```

### 7. 设置环境变量
```bash
nano ~/.bashrc
```

在文件末尾添加：
```bash
# Unitrans Web System 环境变量
export FLASK_ENV=production
export SECRET_KEY='your-very-long-random-secret-key-here'
export DB_HOST='127.0.0.1'
export DB_PORT='3306'
export DB_USER='unitrans_user'
export DB_PASSWORD='your_strong_password_here'
export DB_NAME='unitransDB'
export REDIS_HOST='127.0.0.1'
export REDIS_PORT='6380'
export REDIS_PASSWORD='your_redis_password_here'
```

使环境变量生效：
```bash
source ~/.bashrc
```

### 8. 初始化数据库
```bash
cd /var/www/unitrans-web-system
source venv/bin/activate
python3 -c "from app import app, db; app.app_context().push(); db.create_all(); print('Database initialized')"
```

### 9. 运行数据库优化（创建索引）
```bash
python3 optimize_db.py
```

---

## 四、配置 Systemd 服务

### 1. 创建 Gunicorn 服务
```bash
sudo nano /etc/systemd/system/unitrans-web.service
```

内容：
```ini
[Unit]
Description=Unitrans Web System - Gunicorn
After=network.target mysql.service

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=/var/www/unitrans-web-system
Environment="PATH=/var/www/unitrans-web-system/venv/bin"
Environment="FLASK_ENV=production"
Environment="SECRET_KEY=your-very-long-random-secret-key-here"
Environment="DB_HOST=127.0.0.1"
Environment="DB_PORT=3306"
Environment="DB_USER=unitrans_user"
Environment="DB_PASSWORD=your_strong_password_here"
Environment="DB_NAME=unitransDB"
Environment="REDIS_HOST=127.0.0.1"
Environment="REDIS_PORT=6380"
Environment="REDIS_PASSWORD=your_redis_password_here"
ExecStart=/var/www/unitrans-web-system/venv/bin/gunicorn \
    --workers 2 \
    --bind 127.0.0.1:5001 \
    --timeout 300 \
    --log-level info \
    app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

### 2. 创建 Celery 服务
```bash
sudo nano /etc/systemd/system/unitrans-celery.service
```

内容：
```ini
[Unit]
Description=Unitrans Web System - Celery Worker
After=network.target redis-server.service

[Service]
Type=forking
User=www-data
Group=www-data
WorkingDirectory=/var/www/unitrans-web-system
Environment="PATH=/var/www/unitrans-web-system/venv/bin"
Environment="FLASK_ENV=production"
Environment="SECRET_KEY=your-very-long-random-secret-key-here"
Environment="DB_HOST=127.0.0.1"
Environment="DB_PORT=3306"
Environment="DB_USER=unitrans_user"
Environment="DB_PASSWORD=your_strong_password_here"
Environment="DB_NAME=unitransDB"
Environment="REDIS_HOST=127.0.0.1"
Environment="REDIS_PORT=6380"
Environment="REDIS_PASSWORD=your_redis_password_here"
ExecStart=/var/www/unitrans-web-system/venv/bin/celery -A celery_worker.celery worker \
    --loglevel=info \
    -P eventlet \
    --logfile=/var/log/celery/unitrans-celery.log \
    --pidfile=/var/run/celery/unitrans-celery.pid \
    --detach
ExecStop=/bin/kill -TERM $MAINPID
Restart=always

[Install]
WantedBy=multi-user.target
```

### 3. 创建日志目录
```bash
sudo mkdir -p /var/log/celery
sudo mkdir -p /var/run/celery
sudo chown -R www-data:www-data /var/log/celery
sudo chown -R www-data:www-data /var/run/celery
```

### 4. 设置文件权限
```bash
sudo chown -R www-data:www-data /var/www/unitrans-web-system
sudo chmod -R 755 /var/www/unitrans-web-system
```

### 5. 启动服务
```bash
sudo systemctl daemon-reload
sudo systemctl start unitrans-web
sudo systemctl start unitrans-celery
sudo systemctl enable unitrans-web
sudo systemctl enable unitrans-celery
```

### 6. 检查服务状态
```bash
sudo systemctl status unitrans-web
sudo systemctl status unitrans-celery
```

---

## 五、配置 Nginx 反向代理

### 1. 安装 Nginx（如果还没有）
```bash
sudo apt install nginx -y
```

### 2. 创建 Nginx 配置
```bash
sudo nano /etc/nginx/sites-available/unitrans-web
```

内容：
```nginx
server {
    listen 80;
    server_name your_domain.com;  # 替换为你的域名或服务器IP

    client_max_body_size 200M;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置（账单生成可能需要较长时间）
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }

    # 静态文件直接由 Nginx 提供
    location /static/ {
        alias /var/www/unitrans-web-system/static/;
        expires 30d;
    }

    location /pictures/ {
        alias /var/www/unitrans-web-system/pictures/;
        expires 30d;
    }
}
```

### 3. 启用配置
```bash
sudo ln -s /etc/nginx/sites-available/unitrans-web /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 六、配置 GitHub Actions 自动部署

### 1. 在服务器上生成 SSH 密钥（如果还没有）
```bash
ssh-keygen -t rsa -b 4096 -C "deploy@unitrans"
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/id_rsa  # 复制私钥内容
```

### 2. 在 GitHub 仓库设置 Secrets
进入 GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret

添加以下 secrets：
- `SERVER_HOST`: 服务器 IP 地址
- `SERVER_USER`: SSH 用户名（通常是你的用户名）
- `SERVER_SSH_KEY`: 刚才复制的私钥内容

### 3. 测试自动部署
在本地修改代码后：
```bash
git add .
git commit -m "Update: your changes"
git push origin main
```

GitHub Actions 会自动触发部署流程。

---

## 七、日常维护命令

### 1. 查看日志
```bash
# Web 服务日志
sudo journalctl -u unitrans-web -f

# Celery 日志
sudo tail -f /var/log/celery/unitrans-celery.log

# Nginx 日志
sudo tail -f /var/nginx/access.log
sudo tail -f /var/nginx/error.log
```

### 2. 重启服务
```bash
# 重启 Web 服务
sudo systemctl restart unitrans-web

# 重启 Celery（修改账单生成逻辑后必须执行）
sudo systemctl restart unitrans-celery

# 重启 Nginx
sudo systemctl restart nginx
```

### 3. 停止服务
```bash
sudo systemctl stop unitrans-web
sudo systemctl stop unitrans-celery
```

### 4. 手动拉取更新（如果 GitHub Actions 失败）
```bash
cd /var/www/unitrans-web-system
git pull origin main
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart unitrans-web
sudo systemctl restart unitrans-celery
```

---

## 八、重要提醒

### 修改账单生成逻辑后的操作
每当您修改了以下文件之一：
- `invoice_handler.py`
- `app.py` (异步任务部分)
- `celery_worker.py`

**必须在服务器上执行：**
```bash
sudo systemctl restart unitrans-celery
```

### 安全建议
1. 定期备份数据库
2. 使用强密码
3. 定期更新系统软件
4. 监控服务器资源使用情况

---

## 九、故障排查

### 服务无法启动
```bash
# 查看详细错误
sudo journalctl -u unitrans-web -n 50
sudo journalctl -u unitrans-celery -n 50
```

### 端口被占用
```bash
# 检查端口占用
sudo netstat -tulpn | grep 5001
sudo netstat -tulpn | grep 6380
```

### 权限问题
```bash
# 重新设置权限
sudo chown -R www-data:www-data /var/www/unitrans-web-system
sudo chmod -R 755 /var/www/unitrans-web-system
```

### Celery 任务不执行
```bash
# 检查 Redis 连接
redis-cli -p 6380 -a your_redis_password_here ping

# 重启 Celery
sudo systemctl restart unitrans-celery
```
