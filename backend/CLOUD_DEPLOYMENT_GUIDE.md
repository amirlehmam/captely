# 🚀 Captely Cloud Deployment Guide

**Deploy your Captely application to DigitalOcean for production use and beta testing.**

## 📊 Cost Analysis & Recommendations

### **Option 1: Starter Setup (Recommended for Beta)**
```yaml
💰 Total Monthly Cost: ~$50-70

Components:
├── 1x Droplet (4GB RAM, 2 vCPUs): $24/month
├── Managed PostgreSQL (1GB): $15/month  
├── Managed Redis (1GB): $15/month
├── Load Balancer: $12/month
├── Backups & Monitoring: $5/month
└── Domain & SSL: Free (Let's Encrypt)

✅ Suitable for: 1000+ contacts/month, 5-10 concurrent users
✅ Can handle: ~50,000 enrichment requests/month
✅ 99.99% uptime SLA
```

### **Option 2: Production Setup**
```yaml
💰 Total Monthly Cost: ~$100-150

Components:
├── 2x Droplets (8GB RAM each): $96/month ($48 each)
├── Managed PostgreSQL (4GB): $60/month  
├── Managed Redis (2GB): $30/month
├── Load Balancer: $12/month
├── Spaces (Object Storage): $5/month
└── Monitoring & Backups: $10/month

✅ Suitable for: 10,000+ contacts/month, 50+ concurrent users
✅ Can handle: ~500,000 enrichment requests/month
✅ Auto-scaling capabilities
```

## 🛠️ Step-by-Step Deployment

### **Step 1: Create DigitalOcean Account**

1. **Sign up** at [DigitalOcean](https://www.digitalocean.com) using the link for **$200 free credits**
2. **Verify** your account and add a payment method
3. **Create** a new project called "Captely"

### **Step 2: Create a Droplet**

```bash
# Option A: Via DigitalOcean Control Panel
1. Click "Create" → "Droplets"
2. Choose "Ubuntu 22.04 LTS"
3. Select "Regular Intel" plan: $24/month (4GB RAM, 2 vCPUs)
4. Choose datacenter region closest to your users
5. Add SSH key or create password
6. Enable "Monitoring" and "IPv6"
7. Set hostname: "captely-app"
8. Click "Create Droplet"

# Option B: Via CLI (after installing doctl)
doctl compute droplet create captely-app \
  --image ubuntu-22-04-x64 \
  --size s-2vcpu-4gb \
  --region nyc1 \
  --ssh-keys YOUR_SSH_KEY_ID \
  --enable-monitoring \
  --enable-ipv6
```

### **Step 3: Create Managed Database & Redis**

#### **PostgreSQL Database**
```bash
# Via Control Panel:
1. Go to "Databases" → "Create Database"
2. Select "PostgreSQL 15"
3. Choose "Basic" plan: $15/month (1GB RAM)
4. Same region as your Droplet
5. Name: "captely-db"
6. Create database: "captely"

# Note the connection details for later
```

#### **Redis Cache**
```bash
# Via Control Panel:
1. Go to "Databases" → "Create Database"  
2. Select "Redis 7"
3. Choose "Basic" plan: $15/month (1GB RAM)
4. Same region as your Droplet
5. Name: "captely-redis"

# Note the connection details for later
```

### **Step 4: Setup Your Domain (Optional but Recommended)**

1. **Purchase a domain** or use an existing one
2. **Point DNS** to your Droplet's IP address:
   ```
   A Record: @ → YOUR_DROPLET_IP
   A Record: www → YOUR_DROPLET_IP
   ```
3. **Wait** for DNS propagation (5-30 minutes)

### **Step 5: Connect to Your Droplet**

```bash
# SSH into your droplet
ssh root@YOUR_DROPLET_IP

# Update the system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install additional tools
apt install -y git curl wget ufw htop
```

### **Step 6: Clone and Deploy Your Repository**

```bash
# Clone your repository
cd /opt
git clone https://github.com/yourusername/captely.git
cd captely/backend

# Make deployment script executable
chmod +x deploy.sh

# Copy and configure environment
cp env.production.template .env
nano .env  # Edit with your actual values
```

### **Step 7: Configure Environment Variables**

Update your `.env` file with actual values:

```bash
# Database (from DigitalOcean database panel)
DATABASE_URL=postgresql+asyncpg://doadmin:PASSWORD@captely-db-do-user-xxxxx.b.db.ondigitalocean.com:25060/captely?sslmode=require

# Redis (from DigitalOcean redis panel)  
REDIS_URL=redis://default:PASSWORD@captely-redis-do-user-xxxxx.b.db.ondigitalocean.com:25061

# JWT Secret (generate strong secret)
JWT_SECRET=your-256-bit-secret-key-here

# Your domain
VITE_AUTH_URL=https://yourdomain.com/api/auth
VITE_IMPORT_URL=https://yourdomain.com/api/import
# ... (other URLs)

# API Keys (your actual keys)
ICYPEAS_API=your-icypeas-key
DROPCONTACT_API=your-dropcontact-key
HUNTER_API=your-hunter-key
APOLLO_API=your-apollo-key

# Stripe (for billing)
STRIPE_SECRET_KEY=sk_live_your-stripe-key
STRIPE_PUBLISHABLE_KEY=pk_live_your-stripe-key
```

### **Step 8: Run Deployment**

```bash
# Deploy with your domain
./deploy.sh yourdomain.com production

# Or deploy with IP for testing
./deploy.sh $(curl -s http://checkip.amazonaws.com) production
```

### **Step 9: Initialize Database**

```bash
# Run database migrations
docker exec -it captely-auth-service python -c "
from app.database import init_db
import asyncio
asyncio.run(init_db())
"

# Create initial admin user (optional)
docker exec -it captely-auth-service python -c "
from app.auth import create_user
import asyncio
asyncio.run(create_user('admin@yourdomain.com', 'secure-password', is_admin=True))
"
```

### **Step 10: Configure Load Balancer (Production)**

For production, add a DigitalOcean Load Balancer:

```bash
# Via Control Panel:
1. Go to "Networking" → "Load Balancers"
2. Create Load Balancer in same region
3. Add your Droplet as backend
4. Configure health checks on port 80
5. Enable SSL termination
6. Update DNS to point to Load Balancer IP
```

## 🔧 Post-Deployment Configuration

### **SSL Certificate Setup**

```bash
# Install Certbot for Let's Encrypt
apt install -y certbot

# Get SSL certificate
certbot certonly --standalone -d yourdomain.com --non-interactive --agree-tos --email admin@yourdomain.com

# Copy certificates
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/cert.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/key.pem

# Restart nginx
docker-compose -f docker-compose.prod.yaml restart nginx
```

### **Monitoring Setup**

```bash
# Check service status
docker-compose -f docker-compose.prod.yaml ps

# View logs
docker-compose -f docker-compose.prod.yaml logs -f

# Monitor resource usage
htop
```

### **Backup Configuration**

```bash
# Manual backup
/opt/captely/backup.sh

# Check backup status
ls -la /opt/captely/backups/
```

## 🌐 Access Your Application

Once deployed, access your application:

- **Main App**: `https://yourdomain.com`
- **API Health**: `https://yourdomain.com/health`
- **Flower Monitoring**: `https://yourdomain.com/flower`
- **Admin Panel**: `https://yourdomain.com/admin`

## 🔍 Troubleshooting

### **Common Issues**

#### **Services Won't Start**
```bash
# Check logs
docker-compose -f docker-compose.prod.yaml logs

# Check disk space
df -h

# Check memory usage
free -m

# Restart services
docker-compose -f docker-compose.prod.yaml restart
```

#### **Database Connection Issues**
```bash
# Test database connection
docker exec -it captely-auth-service python -c "
import asyncpg
import asyncio
async def test():
    conn = await asyncpg.connect('YOUR_DATABASE_URL')
    print('Database connected successfully')
    await conn.close()
asyncio.run(test())
"
```

#### **SSL Certificate Issues**
```bash
# Check certificate validity
openssl x509 -in ssl/cert.pem -text -noout

# Renew Let's Encrypt certificate
certbot renew

# Test SSL
curl -I https://yourdomain.com
```

### **Performance Optimization**

#### **Scale Workers**
```bash
# Scale enrichment workers
docker-compose -f docker-compose.prod.yaml up -d --scale enrichment-worker=3

# Monitor worker performance
docker stats
```

#### **Database Optimization**
```bash
# Monitor database performance
docker exec -it captely-auth-service python -c "
# Add database monitoring queries
"
```

## 📈 Scaling & Monitoring

### **Horizontal Scaling**

When you need more capacity:

1. **Add more Droplets**
2. **Use Load Balancer** to distribute traffic  
3. **Scale database** to higher tier
4. **Add Redis clustering**

### **Monitoring Tools**

- **DigitalOcean Monitoring**: Built-in metrics
- **Flower**: Celery task monitoring  
- **Nginx logs**: Access and error logs
- **Docker stats**: Container resource usage

### **Alerts Setup**

```bash
# CPU alert (via DigitalOcean)
1. Go to "Monitoring" in control panel
2. Create alert for CPU > 80%
3. Add notification email

# Custom application alerts
# Add to your application monitoring
```

## 🚀 Going Live Checklist

- [ ] Domain configured and DNS propagated
- [ ] SSL certificates installed and working
- [ ] All environment variables configured
- [ ] Database initialized with schema
- [ ] All services running and healthy
- [ ] Firewall configured properly
- [ ] Backups scheduled and tested
- [ ] Monitoring and alerts configured
- [ ] Load testing completed
- [ ] Error tracking configured

## 💡 Tips for Beta Testing

1. **Start with smaller Droplet** and scale up as needed
2. **Use staging environment** for testing before production
3. **Monitor costs** regularly in DigitalOcean dashboard
4. **Set up alerts** for resource usage
5. **Document issues** and user feedback
6. **Plan for data migration** when scaling

## 🔗 Useful Links

- [DigitalOcean Documentation](https://docs.digitalocean.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

**🎉 Congratulations!** Your Captely application is now running in the cloud and ready for beta testing!

For support, check the logs and refer to this guide. Good luck with your launch! 🚀 