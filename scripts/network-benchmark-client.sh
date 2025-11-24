#!/bin/bash
#
# 网络性能测试 - 客户端脚本 (macOS)
# 用途：从本地 Mac 测试到服务器的网络性能
#

set -e

# 配置
SERVER="${1:-ss.niracler.com}"
IPERF_PORT=5201
HTTP_PORT=8080

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=================================="
echo "网络性能基准测试"
echo "=================================="
echo ""
echo "目标服务器: $SERVER"
echo "测试时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 检查并安装 iperf3
if ! command -v iperf3 &> /dev/null; then
    echo -e "${YELLOW}安装 iperf3...${NC}"
    brew install iperf3
fi

# 创建结果目录
RESULT_DIR="$HOME/network-test-results"
mkdir -p "$RESULT_DIR"
RESULT_FILE="$RESULT_DIR/benchmark-$(date '+%Y%m%d-%H%M%S').txt"

# 保存结果函数
save_result() {
    echo "$1" | tee -a "$RESULT_FILE"
}

echo "" | tee "$RESULT_FILE"
save_result "=================================="
save_result "网络性能基准测试报告"
save_result "=================================="
save_result "服务器: $SERVER"
save_result "测试时间: $(date '+%Y-%m-%d %H:%M:%S')"
save_result ""

# ==========================================
# 测试 1: ICMP Ping 测试
# ==========================================
echo -e "${GREEN}[1/6] ICMP Ping 测试 (30 包)${NC}"
save_result "----------------------------------------"
save_result "[测试 1] ICMP Ping 延迟与丢包率"
save_result "----------------------------------------"

PING_RESULT=$(ping -c 30 "$SERVER" 2>&1)
echo "$PING_RESULT"

# 提取关键指标
PACKET_LOSS=$(echo "$PING_RESULT" | grep "packet loss" | awk '{print $(NF-3)" "$(NF-2)" "$(NF-1)}')
RTT_STATS=$(echo "$PING_RESULT" | grep "round-trip" | cut -d= -f2 | xargs)

save_result "丢包率: $PACKET_LOSS"
save_result "RTT 延迟: $RTT_STATS"
save_result ""

echo ""
sleep 2

# ==========================================
# 测试 2: HTTP 下载速度测试
# ==========================================
echo -e "${GREEN}[2/6] HTTP 下载速度测试 (100MB)${NC}"
save_result "----------------------------------------"
save_result "[测试 2] HTTP 下载速度"
save_result "----------------------------------------"

echo "正在下载 100MB 测试文件..."
WGET_OUTPUT=$(curl -o /dev/null -w "\n下载大小: %{size_download} bytes\n下载时间: %{time_total} 秒\n平均速度: %{speed_download} bytes/sec\n" \
    "http://$SERVER:$HTTP_PORT/test100mb.bin" 2>&1)

echo "$WGET_OUTPUT"
save_result "$WGET_OUTPUT"

# 计算 Mbps
SPEED_BYTES=$(echo "$WGET_OUTPUT" | grep "平均速度" | awk '{print $2}')
SPEED_MBPS=$(echo "scale=2; $SPEED_BYTES * 8 / 1000000" | bc)
save_result "下载速度: ${SPEED_MBPS} Mbps"
save_result ""

echo ""
sleep 2

# ==========================================
# 测试 3: iperf3 TCP 下载测试
# ==========================================
echo -e "${GREEN}[3/6] iperf3 TCP 下载测试 (服务器 -> 本地, 30秒)${NC}"
save_result "----------------------------------------"
save_result "[测试 3] iperf3 TCP 下载速度"
save_result "----------------------------------------"

IPERF_DOWNLOAD=$(iperf3 -c "$SERVER" -p "$IPERF_PORT" -t 30 -f m 2>&1)
echo "$IPERF_DOWNLOAD"

# 提取关键数据
DOWNLOAD_SPEED=$(echo "$IPERF_DOWNLOAD" | grep "receiver" | awk '{print $(NF-2)" "$(NF-1)}')
save_result "TCP 下载速度: $DOWNLOAD_SPEED"
save_result ""

echo ""
sleep 2

# ==========================================
# 测试 4: iperf3 TCP 上传测试
# ==========================================
echo -e "${GREEN}[4/6] iperf3 TCP 上传测试 (本地 -> 服务器, 30秒)${NC}"
save_result "----------------------------------------"
save_result "[测试 4] iperf3 TCP 上传速度"
save_result "----------------------------------------"

IPERF_UPLOAD=$(iperf3 -c "$SERVER" -p "$IPERF_PORT" -t 30 -R -f m 2>&1)
echo "$IPERF_UPLOAD"

# 提取关键数据
UPLOAD_SPEED=$(echo "$IPERF_UPLOAD" | grep "receiver" | awk '{print $(NF-2)" "$(NF-1)}')
save_result "TCP 上传速度: $UPLOAD_SPEED"
save_result ""

echo ""
sleep 2

# ==========================================
# 测试 5: iperf3 UDP 测试
# ==========================================
echo -e "${GREEN}[5/6] iperf3 UDP 测试 (100 Mbps 目标带宽, 20秒)${NC}"
save_result "----------------------------------------"
save_result "[测试 5] iperf3 UDP 性能"
save_result "----------------------------------------"

IPERF_UDP=$(iperf3 -c "$SERVER" -p "$IPERF_PORT" -u -b 100M -t 20 -f m 2>&1)
echo "$IPERF_UDP"

# 提取 UDP 关键数据
UDP_SPEED=$(echo "$IPERF_UDP" | grep "receiver" | awk '{print $(NF-2)" "$(NF-1)}')
UDP_JITTER=$(echo "$IPERF_UDP" | grep "receiver" | awk '{print $(NF-5)" "$(NF-4)}')
UDP_LOSS=$(echo "$IPERF_UDP" | grep "receiver" | grep -oP '\(\K[^)]+' || echo "0%")

save_result "UDP 速度: $UDP_SPEED"
save_result "UDP 抖动: $UDP_JITTER"
save_result "UDP 丢包: $UDP_LOSS"
save_result ""

echo ""
sleep 2

# ==========================================
# 测试 6: MTR 路由追踪
# ==========================================
echo -e "${GREEN}[6/6] MTR 路由追踪 (50 包)${NC}"
save_result "----------------------------------------"
save_result "[测试 6] 路由追踪分析"
save_result "----------------------------------------"

if command -v mtr &> /dev/null; then
    MTR_RESULT=$(mtr -r -c 50 "$SERVER" 2>&1)
    echo "$MTR_RESULT"
    save_result "$MTR_RESULT"
else
    echo -e "${YELLOW}未安装 mtr，使用 traceroute...${NC}"
    TRACE_RESULT=$(traceroute -m 20 "$SERVER" 2>&1)
    echo "$TRACE_RESULT"
    save_result "$TRACE_RESULT"

    echo ""
    echo -e "${YELLOW}提示: 可以使用 'brew install mtr' 安装 MTR 获得更详细的分析${NC}"
fi

save_result ""

# ==========================================
# 生成测试总结
# ==========================================
echo ""
echo "=================================="
echo -e "${GREEN}测试完成！${NC}"
echo "=================================="
echo ""

save_result "=========================================="
save_result "测试总结"
save_result "=========================================="
save_result ""
save_result "基准性能指标："
save_result "  • Ping 延迟: $RTT_STATS"
save_result "  • Ping 丢包: $PACKET_LOSS"
save_result "  • HTTP 下载: ${SPEED_MBPS} Mbps"
save_result "  • TCP 下载: $DOWNLOAD_SPEED"
save_result "  • TCP 上传: $UPLOAD_SPEED"
save_result "  • UDP 速度: $UDP_SPEED (丢包: $UDP_LOSS)"
save_result ""
save_result "与 Shadowsocks 对比："
save_result "  • 当前 SS 下载: 1.89 Mbps"
save_result "  • 理论最大下载: $DOWNLOAD_SPEED"
save_result "  • 性能损失: 待计算"
save_result ""
save_result "建议："

# 生成优化建议
if command -v bc &> /dev/null && [ -n "$DOWNLOAD_SPEED" ]; then
    THEORETICAL_MBPS=$(echo "$DOWNLOAD_SPEED" | grep -oP '[\d.]+' | head -1)
    CURRENT_SS_MBPS=1.89

    if (( $(echo "$THEORETICAL_MBPS > 10" | bc -l) )); then
        save_result "  ✓ 服务器网络性能良好 (>${THEORETICAL_MBPS%.*} Mbps)"
        save_result "  → 问题出在 Shadowsocks 配置，建议启用 BBR 和优化配置"
    elif (( $(echo "$THEORETICAL_MBPS > 5" | bc -l) )); then
        save_result "  ⚠ 服务器网络性能一般 (~${THEORETICAL_MBPS%.*} Mbps)"
        save_result "  → 同时优化网络配置和 Shadowsocks"
    else
        save_result "  ✗ 服务器网络性能较差 (<5 Mbps)"
        save_result "  → 考虑更换 VPS 或使用 CDN 中转"
    fi
fi

save_result ""
save_result "完整报告已保存到:"
save_result "$RESULT_FILE"
save_result ""

echo ""
echo -e "${BLUE}完整报告已保存到:${NC}"
echo "$RESULT_FILE"
echo ""
echo -e "${YELLOW}下一步:${NC}"
echo "1. 查看详细报告: cat $RESULT_FILE"
echo "2. 如果基准速度 >10 Mbps，说明是 SS 配置问题，可以开始优化"
echo "3. 如果基准速度 <5 Mbps，可能需要考虑换服务器或线路"
echo ""
