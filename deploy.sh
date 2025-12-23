#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║                                                       ║"
echo "║   🌐 NetScopeNMS Docker Deployment                    ║"
echo "║                                                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    exit 1
fi

# .env 파일 확인
if [ ! -f .env ]; then
    echo -e "${YELLOW}.env 파일이 없습니다. 생성합니다...${NC}"
    cp .env.example .env
    echo -e "${RED}⚠️  .env 파일에서 OPENAI_API_KEY를 설정한 후 다시 실행하세요.${NC}"
    exit 1
fi

# API 키 설정 확인
if grep -q "sk-여기에_API키_입력" .env; then
    echo -e "${RED}⚠️  .env 파일에서 OPENAI_API_KEY를 실제 키로 변경하세요.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Configuration:${NC}"
echo "  - Database: MySQL (auto-configured)"
echo "  - OpenAI: Loading from .env"
echo ""

echo -e "${BLUE}Starting containers...${NC}"
echo ""

if docker compose version &> /dev/null; then
    docker compose up --build -d
else
    docker-compose up --build -d
fi

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   ✅ Deployment successful!                           ║${NC}"
    echo -e "${GREEN}╠═══════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║                                                       ║${NC}"
    echo -e "${GREEN}║   API:  http://localhost:3000/api/v1                  ║${NC}"
    echo -e "${GREEN}║   Docs: http://localhost:3000/api-docs                ║${NC}"
    echo -e "${GREEN}║                                                       ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Commands:${NC}"
    echo "  View logs:    docker compose logs -f backend"
    echo "  Stop:         docker compose down"
    echo "  Restart:      docker compose restart"
    echo "  Clean all:    docker compose down -v"
    echo ""
else
    echo -e "${RED}Deployment failed. Check logs with: docker compose logs${NC}"
    exit 1
fi
