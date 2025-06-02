#!/bin/bash

echo "🔧 Setting up Captely server on DigitalOcean..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install essential packages
echo "🛠️ Installing essential packages..."
apt install -y curl wget git vim htop ufw fail2ban

# Install Docker
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# Install Docker Compose
echo "📋 Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify installations
echo "✅ Verifying installations..."
docker --version
docker-compose --version

# Setup firewall
echo "🔒 Configuring firewall..."
ufw --force enable
ufw allow ssh
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # Frontend (temporary for testing)
ufw allow 5555/tcp  # Flower monitoring
ufw status

# Configure fail2ban for SSH protection
echo "🛡️ Configuring fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

# Create directories
echo "📁 Creating application directories..."
mkdir -p /opt/captely/{ssl,backups,logs}
chmod 755 /opt/captely

# Install certbot for SSL
echo "🔐 Installing certbot for SSL certificates..."
apt install -y certbot

echo "✅ Server setup completed!"
echo "📍 Your server IP: $(curl -s http://checkip.amazonaws.com)"
echo ""
echo "🚀 Next: Clone your repository and deploy!" 