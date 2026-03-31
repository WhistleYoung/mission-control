#!/bin/bash
# 简单保活脚本 - 检查服务是否存活，不存活则重启

STAR_OFFICE_DIR="/home/bullrom/mission-control/龙虾办公室"

restart_mission() {
    pkill -f "node server.js" 2>/dev/null
    sleep 2
    cd /home/bullrom/mission-control && nohup node server.js > /tmp/mission-control.log 2>&1 &
}

restart_star() {
    pkill -f "backend/app.py" 2>/dev/null
    sleep 2
    cd "$STAR_OFFICE_DIR" && \
    STAR_OFFICE_ENV=production \
    FLASK_SECRET_KEY=5MSTr4MoVN9CFkcREQ8K7wgrlzDpvOVQovV49_OoCAo \
    ASSET_DRAWER_PASS=BullRom2026SecurePass \
    STAR_BACKEND_PORT=19000 \
    nohup .venv/bin/python backend/app.py > /tmp/star-office.log 2>&1 &
}

# mission-control
if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:10086/ 2>/dev/null | grep -qE "^(200|307|301|302)$"; then
    echo "[$(date)] mission-control is down, restarting..."
    restart_mission
    sleep 3
fi

# star-office
if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:19000/ 2>/dev/null | grep -qE "^(200|307|301|302)$"; then
    echo "[$(date)] star-office is down, restarting..."
    restart_star
    sleep 3
fi
