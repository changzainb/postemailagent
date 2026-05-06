#!/usr/bin/env bash
# 在腾讯云 Lighthouse Ubuntu 22.04 上一次性部署
# 用法：
#   sudo bash deploy/setup.sh
# 之前需要：把仓库代码 rsync/git clone 到 /opt/postemailagent
set -euo pipefail

APP_DIR="/opt/postemailagent"
LOG_DIR="/var/log/postemailagent"

echo "==> 安装系统依赖"
apt-get update
apt-get install -y python3 python3-venv python3-pip nginx

echo "==> 创建运行用户和目录"
id -u www-data >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin www-data
mkdir -p "$APP_DIR/data" "$LOG_DIR"
chown -R www-data:www-data "$APP_DIR/data" "$LOG_DIR"

echo "==> 创建 Python 虚拟环境并安装依赖"
if [ ! -d "$APP_DIR/venv" ]; then
  python3 -m venv "$APP_DIR/venv"
fi
"$APP_DIR/venv/bin/pip" install --upgrade pip
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/server/requirements.txt"

echo "==> 初始化数据库（仅首次）"
if [ ! -f "$APP_DIR/data/rules.db" ]; then
  cd "$APP_DIR"
  POSTEMAIL_DB="$APP_DIR/data/rules.db" \
    "$APP_DIR/venv/bin/python" -m server.scripts.import_products
  chown www-data:www-data "$APP_DIR/data/rules.db"
fi

echo "==> 安装 systemd 服务"
cp "$APP_DIR/deploy/postemailagent.service" /etc/systemd/system/postemailagent.service
systemctl daemon-reload
systemctl enable postemailagent
systemctl restart postemailagent

echo "==> 安装 Nginx 站点"
cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/postemailagent.conf
ln -sf /etc/nginx/sites-available/postemailagent.conf /etc/nginx/sites-enabled/postemailagent.conf
rm -f /etc/nginx/sites-enabled/default || true
nginx -t
systemctl reload nginx

echo "==> 完成。下一步："
echo "    1) 修改 /etc/nginx/sites-available/postemailagent.conf 中的 server_name 为你的域名后 reload"
echo "    2) 修改 /etc/systemd/system/postemailagent.service 中的 POSTEMAIL_SECRET_KEY 后 systemctl restart postemailagent"
echo "    3) 修改默认管理员密码：sudo -u www-data $APP_DIR/venv/bin/python -m server.scripts.create_user admin <new-pass> --role admin"
