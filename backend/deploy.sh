#!/bin/bash

# Captely Cloud Deployment Script for DigitalOcean
# This script automates the deployment of your application

set -e  # Exit on any error

echo "🚀 Starting Captely Cloud Deployment..."

# Configuration
PROJECT_NAME="captely"
DOMAIN=${1:-"your-domain.com"}
ENVIRONMENT=${2:-"production"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on DigitalOcean Droplet
check_environment() {
    log_info "Checking deployment environment..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    log_success "Environment check passed"
}

# Create necessary directories
setup_directories() {
    log_info "Setting up directories..."
    
    mkdir -p /opt/captely/{ssl,backups,logs}
    chmod 755 /opt/captely
    
    log_success "Directories created"
}

# Generate SSL certificates (Let's Encrypt)
setup_ssl() {
    log_info "Setting up SSL certificates..."
    
    if [ "$DOMAIN" == "your-domain.com" ]; then
        log_warning "Using self-signed certificates for demo. Update DOMAIN for production."
        # Generate self-signed certificates for testing
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ssl/key.pem \
            -out ssl/cert.pem \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"
    else
        # Use Certbot for real SSL certificates
        if command -v certbot &> /dev/null; then
            log_info "Generating Let's Encrypt certificates..."
            certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
            cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ssl/cert.pem
            cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ssl/key.pem
        else
            log_warning "Certbot not found. Install certbot for automatic SSL certificates."
            log_info "Generating self-signed certificates..."
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout ssl/key.pem \
                -out ssl/cert.pem \
                -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"
        fi
    fi
    
    log_success "SSL certificates configured"
}

# Setup firewall
setup_firewall() {
    log_info "Configuring firewall..."
    
    # Enable UFW if available
    if command -v ufw &> /dev/null; then
        ufw --force enable
        ufw allow ssh
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow 5555/tcp  # Flower (can be restricted)
        log_success "Firewall configured"
    else
        log_warning "UFW not available. Configure firewall manually."
    fi
}

# Create environment file
setup_environment() {
    log_info "Setting up environment variables..."
    
    if [ ! -f .env ]; then
        log_warning ".env file not found. Creating from template..."
        cp env.production.template .env
        
        echo ""
        log_warning "🔑 IMPORTANT: Update the .env file with your actual values:"
        log_warning "   - Database connection strings"
        log_warning "   - API keys"
        log_warning "   - JWT secrets"
        log_warning "   - Domain configuration"
        echo ""
        read -p "Press Enter after updating .env file to continue..."
    fi
    
    log_success "Environment configuration ready"
}

# Deploy with Docker Compose
deploy_application() {
    log_info "Deploying application..."
    
    # Pull latest images and build
    docker-compose -f docker-compose.prod.yaml pull
    docker-compose -f docker-compose.prod.yaml build --no-cache
    
    # Start services
    docker-compose -f docker-compose.prod.yaml up -d
    
    log_success "Application deployed"
}

# Setup monitoring and logging
setup_monitoring() {
    log_info "Setting up monitoring..."
    
    # Create log rotation for Docker
    cat > /etc/logrotate.d/docker-captely << EOF
/var/log/docker/captely/*.log {
    daily
    missingok
    rotate 7
    compress
    notifempty
    create 644 root root
    postrotate
        docker kill --signal="USR1" \$(docker ps -q --filter name=captely) 2>/dev/null || true
    endscript
}
EOF
    
    log_success "Monitoring configured"
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    sleep 30  # Wait for services to start
    
    # Check if services are running
    if docker-compose -f docker-compose.prod.yaml ps | grep -q "Up"; then
        log_success "Services are running"
        
        # Check specific endpoints
        if curl -f -s http://localhost/health > /dev/null; then
            log_success "Application is responding"
        else
            log_warning "Application not responding on health endpoint"
        fi
    else
        log_error "Some services failed to start"
        docker-compose -f docker-compose.prod.yaml logs
        exit 1
    fi
}

# Backup strategy
setup_backup() {
    log_info "Setting up backup strategy..."
    
    cat > /opt/captely/backup.sh << 'EOF'
#!/bin/bash
# Captely Backup Script
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/captely/backups"

# Database backup (adjust connection string)
docker exec captely-db pg_dump -U postgres captely > $BACKUP_DIR/db_backup_$DATE.sql

# Compress old backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -exec gzip {} \;

# Remove old compressed backups (older than 30 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
EOF
    
    chmod +x /opt/captely/backup.sh
    
    # Add to crontab for daily backups
    (crontab -l 2>/dev/null; echo "0 2 * * * /opt/captely/backup.sh") | crontab -
    
    log_success "Backup strategy configured"
}

# Main deployment flow
main() {
    echo "🎯 Deploying Captely to DigitalOcean"
    echo "Domain: $DOMAIN"
    echo "Environment: $ENVIRONMENT"
    echo "----------------------------------------"
    
    check_environment
    setup_directories
    setup_ssl
    setup_firewall
    setup_environment
    deploy_application
    setup_monitoring
    health_check
    setup_backup
    
    echo ""
    log_success "🎉 Deployment completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Update your DNS to point to this server's IP"
    echo "2. Verify all services at: https://$DOMAIN"
    echo "3. Check Flower monitoring at: https://$DOMAIN/flower"
    echo "4. Monitor logs: docker-compose -f docker-compose.prod.yaml logs -f"
    echo ""
    echo "🔧 Useful commands:"
    echo "- Restart services: docker-compose -f docker-compose.prod.yaml restart"
    echo "- View logs: docker-compose -f docker-compose.prod.yaml logs"
    echo "- Scale workers: docker-compose -f docker-compose.prod.yaml up -d --scale enrichment-worker=3"
    echo ""
}

# Run main function
main "$@" 