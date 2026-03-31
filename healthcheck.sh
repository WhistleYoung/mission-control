#!/bin/bash
# 健康检查脚本 - 检查 mission-control 和 star-office 是否存活

LOG_FILE="/home/bullrom/mission-control/healthcheck.log"
PORTS=(10086 19000)
SERVICES=("mission-control" "star-office")

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

restart_service() {
    local name=$1
    local port=$2
    log "⚠️ $name (port $port) is down, restarting..."
    pm2 restart $name >> $LOG_FILE 2>&1
    sleep 3
    
    # 检查重启是否成功 (200 或 307 都是正常响应)
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/ | grep -qE "^(200|307|301|302)$"; then
        log "✅ $name restarted successfully"
    else
        log "❌ $name restart failed"
    fi
}

# 检查 mission-control
if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:10086/ | grep -qE "^(200|307|301|302)$"; then
    log "❌ mission-control is not responding on port 10086"
    restart_service "mission-control" 10086
else
    log "✅ mission-control is healthy"
fi

# 检查 star-office
if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:19000/ | grep -q "200"; then
    log "❌ star-office is not responding on port 19000"
    restart_service "star-office" 19000
else
    log "✅ star-office is healthy"
fi
