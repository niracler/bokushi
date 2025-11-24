#!/bin/bash
#
# 网络性能测试 - 服务器端脚本
# 用途：在 CloudCone VPS 上运行，提供各种性能测试服务
#

set -e

echo "=================================="
echo "网络性能测试 - 服务器端"
echo "=================================="
echo ""

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否为 root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}请使用 sudo 运行此脚本${NC}"
   exit 1
fi

# 1. 安装必要工具
echo -e "${GREEN}[1/5] 检查并安装测试工具...${NC}"
apt update -qq
apt install -y iperf3 python3 >/dev/null 2>&1
echo "✓ iperf3 已安装"
echo ""

# 2. 生成测试文件
echo -e "${GREEN}[2/5] 生成测试文件...${NC}"
TEST_DIR="/tmp/network-test"
mkdir -p $TEST_DIR
cd $TEST_DIR

if [ ! -f "test100mb.bin" ]; then
    echo "生成 100MB 测试文件..."
    dd if=/dev/zero of=test100mb.bin bs=1M count=100 status=progress 2>&1 | tail -1
    echo "✓ 测试文件已生成"
else
    echo "✓ 测试文件已存在"
fi
echo ""

# 3. 配置防火墙
echo -e "${GREEN}[3/5] 配置防火墙规则...${NC}"
ufw allow 5201/tcp comment 'iperf3 TCP' >/dev/null 2>&1 || true
ufw allow 5201/udp comment 'iperf3 UDP' >/dev/null 2>&1 || true
ufw allow 8080/tcp comment 'HTTP test' >/dev/null 2>&1 || true
echo "✓ 已开放端口: 5201 (iperf3), 8080 (HTTP)"
echo ""

# 4. 显示服务器信息
echo -e "${GREEN}[4/5] 服务器信息${NC}"
echo "操作系统: $(lsb_release -d | cut -f2)"
echo "内核版本: $(uname -r)"
echo "CPU: $(grep "model name" /proc/cpuinfo | head -1 | cut -d: -f2 | xargs)"
echo "内存: $(free -h | awk '/^Mem:/ {print $2}')"
echo "当前 TCP 拥塞控制: $(sysctl net.ipv4.tcp_congestion_control | cut -d= -f2 | xargs)"
echo ""

# 5. 启动测试服务
echo -e "${GREEN}[5/5] 启动测试服务${NC}"
echo ""

# 检查并清理已占用的端口
echo "检查端口占用情况..."

# 检查 5201 端口
if lsof -Pi :5201 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}端口 5201 已被占用，正在释放...${NC}"
    lsof -ti:5201 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# 检查 8080 端口
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}端口 8080 已被占用，正在释放...${NC}"
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

echo "✓ 端口已清理"
echo ""

echo -e "${YELLOW}现在可以在本地运行客户端脚本进行测试${NC}"
echo ""
echo "提供的服务："
echo "  • iperf3 服务器: 端口 5201"
echo "  • HTTP 下载服务: 端口 8080"
echo ""
echo -e "${YELLOW}按 Ctrl+C 可以停止所有服务${NC}"
echo ""
echo "=================================="
echo ""

# 清理函数
cleanup() {
    echo ""
    echo -e "${YELLOW}清理测试环境...${NC}"
    pkill -f "iperf3 -s" 2>/dev/null || true
    pkill -f "python3 -m http.server" 2>/dev/null || true
    lsof -ti:5201 | xargs kill -9 2>/dev/null || true
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    ufw delete allow 5201/tcp 2>/dev/null || true
    ufw delete allow 5201/udp 2>/dev/null || true
    ufw delete allow 8080/tcp 2>/dev/null || true
    echo "✓ 清理完成"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 启动 iperf3 服务器（后台）
echo "启动 iperf3 服务器..."
iperf3 -s -p 5201 > /tmp/iperf3.log 2>&1 &
IPERF_PID=$!
sleep 1

if ps -p $IPERF_PID > /dev/null; then
    echo "✓ iperf3 运行中 (PID: $IPERF_PID)"
else
    echo -e "${RED}✗ iperf3 启动失败${NC}"
    exit 1
fi

# 启动 HTTP 服务器（前台，显示访问日志）
echo "启动 HTTP 测试服务器..."
cd $TEST_DIR
python3 -m http.server 8080
