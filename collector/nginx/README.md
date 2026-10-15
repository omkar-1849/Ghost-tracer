# Nginx Setup for Sentinel Collector

This guide explains how to configure Nginx to ship logs to Sentinel via the `sentinel-collector` daemon.

## 1. Real Client IP Configuration

When Nginx sits behind a load balancer (such as AWS ALB, GCP Cloud Load Balancing, HAProxy, or Cloudflare), `$remote_addr` defaults to the IP address of the load balancer rather than the actual visitor.

To record the real visitor IP:
1. Ensure the Nginx `http_realip_module` is enabled (`nginx -V` should show `--with-http_realip_module`).
2. Add your trusted proxy network CIDRs to your Nginx configuration:

```nginx
# /etc/nginx/conf.d/real_ip.conf
set_real_ip_from 10.0.0.0/8;        # Your load balancer subnet
real_ip_header X-Forwarded-For;
real_ip_recursive on;
```

## 2. Access Log Format

Sentinel Collector parses Nginx's standard `combined` log format:

```nginx
access_log /var/log/nginx/access.log combined;
```

Alternatively, you can write to a dedicated log file to isolate Sentinel ingestion:

```nginx
access_log /var/log/nginx/sentinel_access.log combined buffer=32k flush=1s;
```

## 3. Log Rotation

Sentinel Collector seamlessly detects log rotations and in-place truncations (`copytruncate`). Ensure `logrotate` preserves file readability by the unprivileged collector service user:

```
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
```
