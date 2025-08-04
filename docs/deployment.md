# Deployment & Operations Guide

This guide covers how to deploy and operate the Log Monitor in production environments.

## Background Execution

The Log Monitor is designed to run as a long-running background process. Here are the recommended approaches for production deployment.

### Method 1: Using `nohup` (Recommended)

This is the simplest approach for most production environments.

#### Start the Monitor

```bash
# Start monitoring all projects in background
nohup php src/console.php config/projects.yaml -i 1 > var/log/monitor.log 2>&1 &

# Start monitoring specific project
nohup php src/console.php config/projects.yaml --project=myapp -i 1 > var/log/monitor.log 2>&1 &

# Start with custom interval
nohup php src/console.php config/projects.yaml -i 0.5 > var/log/monitor.log 2>&1 &
```

#### Check if Running

```bash
# Check if the process is running
ps aux | grep "php src/console.php" | grep -v grep

# Check process details
ps -ef | grep "php src/console.php" | grep -v grep
```

#### View Logs

```bash
# View monitor logs in real-time
tail -f var/log/monitor.log

# View last 50 lines
tail -50 var/log/monitor.log

# View all logs
cat var/log/monitor.log
```

#### Stop the Monitor

```bash
# Stop all monitor processes
pkill -f "php src/console.php"

# Or stop by process ID (replace PID with actual process ID)
kill PID
```

#### Restart the Monitor

```bash
# Stop existing process
pkill -f "php src/console.php"

# Start new process
nohup php src/console.php config/projects.yaml -i 1 > var/log/monitor.log 2>&1 &
```

### Method 2: Using `screen` (Interactive Sessions)

Useful when you need to occasionally interact with the process.

```bash
# Start a new screen session
screen -S log-monitor

# Run the monitor
php src/console.php config/projects.yaml -i 1

# Detach from screen: Ctrl+A, then D
# Reattach later: screen -r log-monitor
# List sessions: screen -ls
```

### Method 3: Using `tmux` (Modern Alternative)

```bash
# Start a new tmux session
tmux new-session -d -s log-monitor 'php src/console.php config/projects.yaml -i 1'

# Attach to session
tmux attach-session -t log-monitor

# Detach: Ctrl+B, then D
# List sessions: tmux list-sessions
```

### Method 4: Systemd Service (Linux)

Create a systemd service file for automatic startup and management.

#### Create Service File

Create `/etc/systemd/system/log-monitor.service`:

```ini
[Unit]
Description=Log Monitor Service
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/path/to/your/project
ExecStart=/usr/bin/php src/console.php config/projects.yaml -i 1
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

#### Manage the Service

```bash
# Enable and start the service
sudo systemctl enable log-monitor
sudo systemctl start log-monitor

# Check status
sudo systemctl status log-monitor

# View logs
sudo journalctl -u log-monitor -f

# Stop the service
sudo systemctl stop log-monitor

# Restart the service
sudo systemctl restart log-monitor
```

## Production Considerations

### Log Rotation

Configure log rotation to prevent log files from growing too large:

```bash
# Add to /etc/logrotate.d/log-monitor
/path/to/project/var/log/monitor.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
}
```

### Monitoring the Monitor

Set up monitoring for the monitor process:

```bash
# Simple health check script
#!/bin/bash
if ! pgrep -f "php src/console.php" > /dev/null; then
    echo "Log monitor is not running!"
    exit 1
fi
echo "Log monitor is running"
exit 0
```

### Resource Management

- **Memory**: The monitor typically uses 20-50MB of RAM
- **CPU**: Minimal CPU usage, mainly during file scanning
- **Disk**: Position files and logs may grow over time
- **File Descriptors**: Monitor keeps file handles open for active log files

### Security Considerations

- Run the monitor with appropriate user permissions
- Ensure log directories are readable by the monitor user
- Consider using dedicated service accounts
- Restrict access to configuration files

## Troubleshooting

### Common Issues

#### Process Not Starting
```bash
# Check PHP version
php --version

# Check dependencies
composer install

# Check configuration
php src/console.php config/projects.yaml --help
```

#### Process Stopped Unexpectedly
```bash
# Check for errors in monitor log
tail -50 var/log/monitor.log

# Check system resources
top -p $(pgrep -f "php src/console.php")

# Check file permissions
ls -la var/log/
ls -la var/positions/
```

#### High Memory Usage
```bash
# Check memory usage
ps aux | grep "php src/console.php" | grep -v grep

# Restart if needed
pkill -f "php src/console.php"
nohup php src/console.php config/projects.yaml -i 1 > var/log/monitor.log 2>&1 &
```

### Debug Mode

Run with debug output for troubleshooting:

```bash
# Run with debug output
php src/console.php config/projects.yaml -i 1 --debug

# Or in background with debug
nohup php src/console.php config/projects.yaml -i 1 --debug > var/log/monitor-debug.log 2>&1 &

# Using management script with debug
./scripts/monitor.sh start --debug
./scripts/monitor.sh restart --debug
```

Debug mode provides detailed information about:
- File discovery and switching
- Position tracking operations
- Monitoring cycles
- Error conditions
- Configuration loading

## Performance Tuning

### Scan Interval

Adjust the scan interval based on your needs:

- **High frequency logs**: Use `-i 0.1` to `-i 0.5`
- **Normal logs**: Use `-i 1` (default)
- **Low frequency logs**: Use `-i 5` to `-i 10`

### Multiple Instances

For high-volume environments, consider running multiple instances:

```bash
# Instance 1: Monitor project A
nohup php src/console.php config/projects.yaml --project=projectA -i 0.5 > var/log/monitor-A.log 2>&1 &

# Instance 2: Monitor project B  
nohup php src/console.php config/projects.yaml --project=projectB -i 0.5 > var/log/monitor-B.log 2>&1 &
```

## Backup and Recovery

### Position Files

Backup position files to prevent reprocessing:

```bash
# Backup positions
cp -r var/positions/ var/positions-backup/

# Restore positions
cp -r var/positions-backup/ var/positions/
```

### Configuration

Keep configuration files in version control and backup regularly.

## Quick Reference

### Essential Commands

```bash
# Start
nohup php src/console.php config/projects.yaml -i 1 > var/log/monitor.log 2>&1 &

# Check status
ps aux | grep "php src/console.php" | grep -v grep

# View logs
tail -f var/log/monitor.log

# Stop
pkill -f "php src/console.php"

# Restart
pkill -f "php src/console.php" && nohup php src/console.php config/projects.yaml -i 1 > var/log/monitor.log 2>&1 &
```

### Using the Management Script

For easier management, use the provided script:

```bash
# Start the monitor
./scripts/monitor.sh start

# Start with debug output
./scripts/monitor.sh start --debug

# Check status
./scripts/monitor.sh status

# View logs
./scripts/monitor.sh logs

# Stop the monitor
./scripts/monitor.sh stop

# Restart the monitor
./scripts/monitor.sh restart

# Restart with debug output
./scripts/monitor.sh restart --debug
``` 