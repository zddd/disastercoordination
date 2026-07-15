#!/bin/bash
# ============================================================
# Disaster Coordination System — 一键启动/重启脚本
#
# 用法:
#   ./scripts/start.sh                   启动全部服务 (开发模式)
#   ./scripts/start.sh --reset           清空数据库重新开始
#   ./scripts/start.sh --prod            生产模式 (不执行seed)
#   ./scripts/start.sh stop              停止所有服务
#   ./scripts/start.sh restart-backend   单独重启后端
#   ./scripts/start.sh restart-frontend  单独重启前端
#   ./scripts/start.sh logs              查看日志
# ============================================================
set -e

# 项目根目录 (脚本在 scripts/ 下)
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="docker-compose.yml"
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[DC]${NC} $1"; }
warn() { echo -e "${YELLOW}[DC]${NC} $1"; }
err()  { echo -e "${RED}[DC]${NC} $1"; }
info() { echo -e "${BLUE}[DC]${NC} $1"; }

# ============================================================
# 子命令: stop — 停止所有服务
# ============================================================
cmd_stop() {
    log "停止后端服务..."
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true

    log "停止前端服务..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true

    log "停止 Docker 容器..."
    docker compose -f "$COMPOSE_FILE" stop 2>/dev/null || true

    log "所有服务已停止"
}

# ============================================================
# 子命令: logs — 查看日志
# ============================================================
cmd_logs() {
    docker compose -f "$COMPOSE_FILE" logs -f --tail=50
}

# ============================================================
# 子命令: reset — 清空数据库
# ============================================================
cmd_reset() {
    warn "⚠️  将清除所有数据库数据！"
    read -p "确认重置？(yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        log "已取消"
        exit 0
    fi

    log "停止并删除容器和数据卷..."
    docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true

    log "数据库已重置"
}

# ============================================================
# 主流程: start
# ============================================================
main() {
    local mode="${1:-start}"
    local extra="${2:-}"

    # 处理子命令
    case "$mode" in
        stop)
            cmd_stop
            exit 0
            ;;
        logs)
            cmd_logs
            exit 0
            ;;
        restart-backend|rb)
            cmd_restart_backend
            exit 0
            ;;
        restart-frontend|rf)
            cmd_restart_frontend
            exit 0
            ;;
    esac

    # 处理 --reset 参数
    if [ "$extra" = "--reset" ]; then
        cmd_reset
    fi

    echo ""
    log "══════════════════════════════════════════════"
    log "  灾害应急调度系统 — 启动中..."
    log "══════════════════════════════════════════════"
    echo ""

    # ---- 1. 检查前置依赖 ----
    info "步骤 1/5: 检查环境..."

    if ! command -v go &> /dev/null; then
        err "Go 未安装，请先安装 Go 1.22+"
        exit 1
    fi
    log "  ✓ Go $(go version | awk '{print $3}')"

    if ! command -v node &> /dev/null; then
        err "Node.js 未安装，请先安装 Node.js 20+"
        exit 1
    fi
    log "  ✓ Node $(node --version)"

    if ! command -v docker &> /dev/null; then
        warn "Docker 未安装，将跳过容器管理"
    else
        log "  ✓ Docker $(docker --version | awk '{print $3}' | tr -d ',')"
    fi

    # ---- 2. 停止旧服务 ----
    info "步骤 2/5: 停止旧服务..."
    cmd_stop > /dev/null

    # ---- 3. 启动基础设施 ----
    info "步骤 3/5: 启动数据库和存储..."
    if command -v docker &> /dev/null; then
        docker compose -f "$COMPOSE_FILE" up -d postgres minio 2>&1 | tail -3
        # 等待 PostgreSQL 就绪
        log "  等待 PostgreSQL 就绪..."
        for i in $(seq 1 15); do
            if docker exec dc-postgres pg_isready -U dc_user -d dc_center &>/dev/null; then
                log "  ✓ PostgreSQL 就绪"
                break
            fi
            sleep 1
        done
    else
        warn "  Docker 不可用，请确保 PostgreSQL 已在 localhost:5432 运行"
    fi

    # ---- 4. 编译并启动后端 ----
    info "步骤 4/5: 编译并启动后端..."

    cd "$ROOT_DIR/$BACKEND_DIR"

    # 下载依赖
    log "  下载 Go 依赖..."
    go mod download > /dev/null 2>&1

    # 编译
    log "  编译后端..."
    go build -o server ./cmd/server 2>&1 | tail -1

    if [ ! -f "./server" ]; then
        err "  编译失败！"
        exit 1
    fi
    log "  ✓ 编译完成"

    # 后台启动
    if [ "$extra" = "--prod" ] || [ "$extra" = "-p" ]; then
        log "  启动后端 (生产模式)..."
        APP_ENV=production GIN_MODE=release ./server > /tmp/dc-backend.log 2>&1 &
    else
        log "  启动后端 (开发模式)..."
        ./server > /tmp/dc-backend.log 2>&1 &
    fi
    BACKEND_PID=$!

    # 等待后端就绪
    log "  等待后端就绪..."
    for i in $(seq 1 10); do
        if curl -s http://localhost:8080/health > /dev/null 2>&1; then
            log "  ✓ 后端就绪 (http://localhost:8080)"
            HEALTH=$(curl -s http://localhost:8080/health)
            info "    Health: $HEALTH"
            break
        fi
        sleep 1
    done

    # ---- 5. 启动前端 ----
    info "步骤 5/5: 启动前端..."

    cd "$ROOT_DIR/$FRONTEND_DIR"

    # 安装依赖 (如果 node_modules 不存在)
    if [ ! -d "node_modules" ]; then
        log "  安装前端依赖..."
        npm install --silent 2>&1 | tail -1
    fi

    # 启动开发服务器
    log "  启动前端 (开发模式)..."
    npm run dev > /tmp/dc-frontend.log 2>&1 &
    FRONTEND_PID=$!

    # 等待前端
    log "  等待前端就绪..."
    for i in $(seq 1 15); do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            log "  ✓ 前端就绪 (http://localhost:3000)"
            break
        fi
        sleep 1
    done

    # ---- 完成 ----
    echo ""
    log "══════════════════════════════════════════════"
    log "  服务启动完成！"
    log ""
    log "  前端:  http://localhost:3000"
    log "  后端:  http://localhost:8080"
    log "  API文档: docs/api.md"
    log ""
    if [ "$extra" = "--prod" ] || [ "$extra" = "-p" ]; then
        warn "  生产模式: 无预设账号，需手动创建管理员"
    else
        log "  演示账号:"
        log "    admin     / admin123  (管理员)"
        log "    commander / 123456    (指挥员)"
        log "    reviewer  / 123456    (审核员)"
        log "    bluesky   / 123456    (救援队)"
        log "    victim1   / 123456    (受灾群众)"
    fi
    log ""
    log "  日志查看:"
    log "    tail -f /tmp/dc-backend.log"
    log "    tail -f /tmp/dc-frontend.log"
    log "  ./scripts/start.sh logs  (Docker 日志)"
    log ""
    log "  停止服务: ./scripts/start.sh stop"
    log "══════════════════════════════════════════════"

    # 保存 PID 以便 stop 命令使用
    echo "$BACKEND_PID" > /tmp/dc-backend.pid
    echo "$FRONTEND_PID" > /tmp/dc-frontend.pid
}

# ============================================================
# 入口
# ============================================================
main "$@"
