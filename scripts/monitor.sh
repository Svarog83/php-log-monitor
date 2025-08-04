#!/bin/bash

# Log Monitor Management Script
# Usage: ./scripts/monitor.sh [start|stop|restart|status|logs] [--debug]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="config/projects.yaml"
LOG_FILE="var/log/monitor.log"
INTERVAL="1"
DEBUG_FLAG=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Function to check if monitor is running
is_running() {
    pgrep -f "php src/console.php" > /dev/null 2>&1
}

# Function to get process info
get_process_info() {
    ps aux | grep "php src/console.php" | grep -v grep
}

# Function to start the monitor
start_monitor() {
    if is_running; then
        print_warning "Monitor is already running"
        get_process_info
        return 1
    fi

    print_status "Starting log monitor..."
    
    # Create log directory if it doesn't exist
    mkdir -p "$PROJECT_DIR/var/log"
    
    # Start the monitor
    cd "$PROJECT_DIR"
    nohup php src/console.php "$CONFIG_FILE" -i "$INTERVAL" $DEBUG_FLAG > "$LOG_FILE" 2>&1 &
    
    # Wait a moment and check if it started successfully
    sleep 2
    if is_running; then
        print_status "Monitor started successfully"
        get_process_info
    else
        print_error "Failed to start monitor"
        return 1
    fi
}

# Function to stop the monitor
stop_monitor() {
    if ! is_running; then
        print_warning "Monitor is not running"
        return 1
    fi

    print_status "Stopping log monitor..."
    pkill -f "php src/console.php"
    
    # Wait a moment and check if it stopped
    sleep 2
    if ! is_running; then
        print_status "Monitor stopped successfully"
    else
        print_error "Failed to stop monitor"
        return 1
    fi
}

# Function to restart the monitor
restart_monitor() {
    print_status "Restarting log monitor..."
    stop_monitor
    sleep 1
    start_monitor
}

# Function to show status
show_status() {
    if is_running; then
        print_status "Monitor is running"
        get_process_info
    else
        print_warning "Monitor is not running"
    fi
}

# Function to show logs
show_logs() {
    if [ ! -f "$PROJECT_DIR/$LOG_FILE" ]; then
        print_error "Log file not found: $LOG_FILE"
        return 1
    fi
    
    print_info "Showing last 50 lines of monitor log:"
    echo "----------------------------------------"
    tail -50 "$PROJECT_DIR/$LOG_FILE"
    echo "----------------------------------------"
    print_info "Use 'tail -f $LOG_FILE' to follow logs in real-time"
}

# Function to show help
show_help() {
    echo "Log Monitor Management Script"
    echo ""
    echo "Usage: $0 [COMMAND] [--debug]"
    echo ""
    echo "Commands:"
    echo "  start     Start the log monitor in background"
    echo "  stop      Stop the log monitor"
    echo "  restart   Restart the log monitor"
    echo "  status    Show monitor status and process info"
    echo "  logs      Show recent monitor logs"
    echo "  help      Show this help message"
    echo ""
    echo "Options:"
    echo "  --debug   Enable debug output (for start/restart commands)"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 start --debug"
    echo "  $0 restart --debug"
    echo "  $0 status"
    echo "  $0 logs"
    echo "  $0 stop"
}

# Parse command line arguments
COMMAND="${1:-help}"
DEBUG_FLAG=""

# Check for debug flag
if [ "$2" = "--debug" ]; then
    DEBUG_FLAG="--debug"
    print_info "Debug mode enabled"
fi

# Main script logic
case "$COMMAND" in
    start)
        start_monitor
        ;;
    stop)
        stop_monitor
        ;;
    restart)
        restart_monitor
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $COMMAND"
        echo ""
        show_help
        exit 1
        ;;
esac 