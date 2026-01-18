# Unitrans Web System - 快速部署清单

## 准备阶段（本地）

- [ ] 确认所有代码已提交到 Git
- [ ] 检查 `.gitignore` 是否正确配置
- [ ] 确认 `requirements.txt` 包含所有依赖

```bash
cd "e:\360MoveData\Users\Admin\Desktop\Python Project\unitrans web system"
git init
git add .
git commit -m "Initial commit"
```

## GitHub 配置

- [ ] 在 GitHub 创建新仓库 `unitrans-web-system`
- [ ] 关联远程仓库并推送

```bash
git remote add origin https://github.com/your_username/unitrans-web-system.git
git branch -M main
git push -u origin main
```

## 服务器基础配置

```bash
# 1. 连接服务器
ssh your_username@your_server_ip

# 2. 更新系统
sudo apt update && sudo apt upgrade -y

# 3. 安装基础软件
sudo apt install python3 python3-pip python3-venv mysql-server redis-server nginx git -y
```

## MySQL 配置

```bash
sudo mysql
```

```sql
CREATE DATABASE unitransDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'unitrans_user'@'localhost' IDENTIFIED BY 'YOUR_PASSWORD';
GRANT ALL PRIVILEGES ON unitransDB.* TO 'unitrans_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## Redis 配置

```bash
sudo nano /etc/redis/redis.conf
```

修改：
```
port 6380
requirepass YOUR_REDIS_PASSWORD
bind 127.0.0.1
```

```bash
sudo systemctl restart redis-server
```

## 部署项目

```bash
# 1. 创建目录
sudo mkdir -p /var/www/unitrans-web-system
sudo chown -R $USER:$USER /var/www/unitrans-web-system

# 2. 克隆代码
cd /var/www/unitrans-web-system
git clone https://github.com/your_username/unitrans-web-system.git .

# 3. 创建虚拟环境
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 4. 创建文件夹
mkdir -p "customer invoices" "supplier invoices" uploads pictures

# 5. 初始化数据库
python3 -c "from app import app, db; app.app_context().push(); db.create_all()"
python3 optimize_db.py
```

## 环境变量配置

```bash
nano ~/.bashrc
```

添加：
```bash
export FLASK_ENV=production
export SECRET_KEY='生成一个长随机字符串'
export DB_HOST='127.0.0.1'
export DB_PORT='3306'
export DB_USER='unitrans_user'
export DB_PASSWORD='YOUR_PASSWORD'
export DB_NAME='unitransDB'
export REDIS_HOST='127.0.0.1'
export REDIS_PORT='6380'
export REDIS_PASSWORD='YOUR_REDIS_PASSWORD'
```

```bash
source ~/.bashrc
```

## Systemd 服务配置

### Web 服务
```bash
sudo nano /etc/systemd/system/unitrans-web.service
```

（复制 DEPLOYMENT.md 中的内容）

### Celery 服务
```bash
sudo nano /etc/systemd/system/unitrans-celery.service
```

（复制 DEPLOYMENT.md 中的内容）

### 启动服务
```bash
sudo mkdir -p /var/log/celery /var/run/celery
sudo chown -R www-data:www-data /var/www/unitrans-web-system /var/log/celery /var/run/celery
sudo systemctl daemon-reload
sudo systemctl start unitrans-web unitrans-celery
sudo systemctl enable unitrans-web unitrans-celery
sudo systemctl status unitrans-web unitrans-celery
```

## Nginx 配置

```bash
sudo nano /etc/nginx/sites-available/unitrans-web
```

（复制 DEPLOYMENT.md 中的内容，修改 server_name）

```bash
sudo ln -s /etc/nginx/sites-available/unitrans-web /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## GitHub Actions 配置

1. 生成 SSH 密钥：
```bash
ssh-keygen -t rsa -b 4096
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/id_rsa  # 复制私钥
```

2. GitHub 仓库 → Settings → Secrets → 添加：
   - `SERVER_HOST`
   - `SERVER_USER`
   - `SERVER_SSH_KEY`

## 验证部署

- [ ] 访问 http://your_server_ip （应该看到登录页面）
- [ ] 检查服务状态：`sudo systemctl status unitrans-web unitrans-celery`
- [ ] 测试登录功能
- [ ] 测试账单生成功能
- [ ] 查看日志：`sudo journalctl -u unitrans-web -f`

## 常用命令

```bash
# 查看日志
sudo journalctl -u unitrans-web -f
sudo tail -f /var/log/celery/unitrans-celery.log

# 重启服务（修改账单逻辑后必须执行）
sudo systemctl restart unitrans-web
sudo systemctl restart unitrans-celery

# 手动更新代码
cd /var/www/unitrans-web-system
git pull origin main
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart unitrans-web unitrans-celery
```

## 重要提醒

⚠️ **每次修改 invoice_handler.py 或 app.py 中的异步任务后，必须执行：**
```bash
sudo systemctl restart unitrans-celery
```

⚠️ **定期备份数据库：**
```bash
mysqldump -u unitrans_user -p unitransDB > backup_$(date +%Y%m%d).sql
```
