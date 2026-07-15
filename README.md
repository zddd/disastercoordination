# 灾害应急调度系统 (Disaster Coordination Center)

> 连接受灾群众与救援力量 — 从求助上报到救援完成的全链路开放平台

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Go 1.22 + Gin + PostgreSQL 16 + PostGIS |
| 前端 | React 18 + Next.js 14 + TypeScript + Tailwind CSS |
| 缓存 | Redis 7 (MVP可选) |
| 存储 | MinIO (文件) |
| 部署 | Docker Compose + Coolify |

## 快速开始

### 本地开发

```bash
# 1. 启动基础设施
docker compose up -d postgres minio

# 2. 初始化数据库
docker exec -i dc-postgres psql -U dc_user -d dc_center < backend/migrations/001_init.sql

# 3. 启动后端
cd backend
go run cmd/server/main.go
# → http://localhost:8080

# 4. 启动前端 (另一个终端)
cd frontend
npm install && npm run dev
# → http://localhost:3000
```

### Docker 一键部署

```bash
docker compose up -d
# 前端: http://localhost:3000
# 后端: http://localhost:8080
# 健康检查: curl http://localhost:8080/health
```

### Coolify 部署

1. 在 Coolify Dashboard 创建两个 Service
2. Backend: Dockerfile 路径 `backend/Dockerfile`，端口 8080
3. Frontend: Dockerfile 路径 `frontend/Dockerfile`，端口 3000
4. 环境变量在 Coolify Web UI 中配置

## API 文档

详见 [docs/api.md](docs/api.md)

## 项目结构

```
├── backend/          # Go + Gin API 服务
│   ├── cmd/server/   # 入口
│   ├── internal/     # handler/service/repository/middleware/model/worker
│   ├── migrations/   # SQL 迁移
│   └── pkg/push/     # 推送接口
├── frontend/         # Next.js 前端
│   └── src/app/      # /help (H5) + /admin (后台) + /team (救援队)
├── docs/             # 项目文档
├── docker-compose.yml
└── .gitignore
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| DATABASE_URL | postgres://dc_user:dc_pass@localhost:5432/dc_center | PG连接串 |
| REDIS_URL | (空=不使用Redis) | Redis连接串 |
| JWT_SECRET | dc-center-mvp-... | JWT签名密钥 |
| PORT | 8080 | 后端端口 |
| UPLOAD_DIR | ./uploads | 文件存储目录 |

## 测试

```bash
# 后端全部测试
cd backend && go test ./...

# 带覆盖率
go test ./... -cover

# 前端构建验证
cd frontend && npm run build
```
