#!/bin/bash
# ============================================================
# Disaster Coordination System — 一键启动/重启脚本
#
# 用法:
#   ./scripts/start.sh                   启动全部服务 (开发模式)
#   ./scripts/start.sh --reset           清空数据库重新开始
#   ./scripts/start.sh --prod            生产模式 (不执行seed)
#   ./scripts/start.sh stop              停止所有服务
#   ./scripts/start.sh restart-backend   单独重启后端 (简写: rb)
#   ./scripts/start.sh restart-frontend  单独重启前端 (简写: rf)
#   ./scripts/start.sh logs              查看日志
# ============================================================
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="docker-compose.yml"
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[DC]${NC} $1"; }
warn() { echo -e "${YELLOW}[DC]${NC} $1"; }
err()  { echo -e "${RED}[DC]${NC} $1"; }
info() { echo -e "${BLUE}[DC]${NC} $1"; }

# ============================================================
# 子命令
# ============================================================

cmd_stop() {
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" stop 2>/dev/null || true
    log "所有服务已停止"
}

cmd_logs() {
    docker compose -f "$COMPOSE_FILE" logs -f --tail=50
}

cmd_reset() {
    warn "⚠️  将清除所有数据库数据！"
    read -p "确认重置？(yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        log "已取消"
        exit 0
    fi
    docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
    log "数据库已重置"
}

cmd_restart_backend() {
    log "重启后端..."
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    sleep 1
    cd "$ROOT_DIR/$BACKEND_DIR"
    log "  编译..."
    go build -o server ./cmd/server 2>&1 | tail -1
    if [ ! -f "./server" ]; then err "编译失败!"; return 1; fi
    log "  ✓ 编译完成"
    ./server > /tmp/dc-backend.log 2>&1 &
    echo $! > /tmp/dc-backend.pid
    for i in $(seq 1 10); do
        if curl -s http://localhost:8080/health > /dev/null 2>&1; then
            log "  ✓ 后端就绪 (http://localhost:8080)"; break
        fi; sleep 1
    done
}

cmd_restart_frontend() {
    log "重启前端..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 1
    cd "$ROOT_DIR/$FRONTEND_DIR"
    npm run dev > /tmp/dc-frontend.log 2>&1 &
    echo $! > /tmp/dc-frontend.pid
    for i in $(seq 1 15); do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            log "  ✓ 前端就绪 (http://localhost:3000)"; break
        fi; sleep 1
    done
}

# ============================================================
# 主流程
# ============================================================
main() {
    local mode="${1:-start}"
    local extra="${2:-}"

    # 子命令分发
    case "$mode" in
        stop)               cmd_stop; exit 0 ;;
        logs)               cmd_logs; exit 0 ;;
        restart-backend|rb) cmd_restart_backend; exit 0 ;;
        restart-frontend|rf) cmd_restart_frontend; exit 0 ;;
    esac

    # 全量启动流程 (start)
    [ "$extra" = "--reset" ] && cmd_reset

    echo ""
    log "══════════════════════════════════════════════"
    log "  灾害应急调度系统 — 启动中..."
    log "══════════════════════════════════════════════"
    echo ""

    # 1. 环境检查
    info "步骤 1/5: 检查环境..."
    command -v go   >/dev/null || { err "Go 未安装"; exit 1; }
    command -v node >/dev/null || { err "Node 未安装"; exit 1; }
    log "  ✓ Go $(go version | awk '{print $3}')"
    log "  ✓ Node $(node --version)"
    command -v docker >/dev/null && log "  ✓ Docker" || warn "  Docker 未安装"

    # 2. 停止旧服务
    info "步骤 2/5: 停止旧服务..."
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true

    # 3. 启动基础设施
    info "步骤 3/5: 启动数据库和存储..."
    if command -v docker &>/dev/null; then
        docker compose -f "$COMPOSE_FILE" up -d postgres minio 2>&1 | tail -3
        log "  等待 PostgreSQL..."
        for i in $(seq 1 15); do
            docker exec dc-postgres pg_isready -U dc_user -d dc_center &>/dev/null && { log "  ✓ PostgreSQL 就绪"; break; }
            sleep 1
        done
    else
        warn "  Docker 不可用"
    fi

    # 4. 后端
    is_prod=false
    [ "$extra" = "--prod" ] || [ "$extra" = "-p" ] && is_prod=true
    info "步骤 4/5: 编译并启动后端 ($($is_prod && echo "生产" || echo "开发")模式)..."
    cd "$ROOT_DIR/$BACKEND_DIR"
    go mod download > /dev/null 2>&1
    go build -o server ./cmd/server
    [ ! -f "./server" ] && { err "编译失败!"; exit 1; }
    log "  ✓ 编译完成"
    if $is_prod; then
        APP_ENV=production GIN_MODE=release ./server > /tmp/dc-backend.log 2>&1 &
    else
        ./server > /tmp/dc-backend.log 2>&1 &
    fi
    echo $! > /tmp/dc-backend.pid
    for i in $(seq 1 10); do
        if curl -s http://localhost:8080/health > /dev/null 2>&1; then
            log "  ✓ 后端就绪 (http://localhost:8080)"
            info "    $(curl -s http://localhost:8080/health)"; break
        fi; sleep 1
    done

    # 5. 前端
    info "步骤 5/5: 启动前端..."
    cd "$ROOT_DIR/$FRONTEND_DIR"
    [ ! -d "node_modules" ] && { log "  安装依赖..."; npm install --silent; }
    npm run dev > /tmp/dc-frontend.log 2>&1 &
    echo $! > /tmp/dc-frontend.pid
    for i in $(seq 1 15); do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            log "  ✓ 前端就绪 (http://localhost:3000)"; break
        fi; sleep 1
    done

    # 完成
    echo ""
    log "══════════════════════════════════════════════"
    log "  服务启动完成！"
    log "  前端: http://localhost:3000"
    log "  后端: http://localhost:8080"
    if $is_prod; then
        warn "  生产模式: 无预设账号"
    else
        log "  演示账号: admin/admin123 (管理员)"
    fi
    log "  停止: ./scripts/start.sh stop"
    log "══════════════════════════════════════════════"
}

main "$@"
