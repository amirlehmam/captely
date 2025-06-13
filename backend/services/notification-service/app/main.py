"""
Notification Service for Captely
Handles email alerts, credit warnings, and job completion notifications
"""
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Dict, List, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime, timedelta
import smtplib
import asyncio
import httpx
from email.mime.text import MIMEText as MimeText
from email.mime.multipart import MIMEMultipart as MimeMultipart
from jose import jwt, JWTError
import os

from common.config import get_settings
from common.db import get_async_session
from common.utils import logger

app = FastAPI(
    title="Captely Notification Service",
    description="Email alerts, credit warnings, and job notifications",
    version="1.0.0"
)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

def verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Verify JWT token and return user ID"""
    token = credentials.credentials
    
    # 🔥 TESTING: Allow test tokens for development
    if token == "test-token":
        return "00000000-0000-0000-0002-000000000001"  # Test user ID
    
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Pydantic models
class EmailNotification(BaseModel):
    recipient_email: EmailStr
    subject: str
    template_name: str
    template_data: Dict[str, Any]
    priority: str = "normal"  # high, normal, low

class JobCompletionNotification(BaseModel):
    user_id: str
    job_id: str
    job_status: str
    results_summary: Dict[str, Any]

class CreditAlertNotification(BaseModel):
    user_id: str
    current_credits: int
    threshold: int
    alert_type: str  # low_credits, no_credits, limit_exceeded

class NotificationPreferences(BaseModel):
    user_id: str
    email_notifications: bool = True
    job_completion_alerts: bool = True
    credit_warnings: bool = True
    weekly_summary: bool = True
    low_credit_threshold: int = 50

# Email templates
EMAIL_TEMPLATES = {
    "job_completion": {
        "subject": "🎉 Your enrichment job is complete!",
        "html": """
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
                <h1>Job Complete!</h1>
                <p>Your enrichment job "{job_name}" has finished processing.</p>
            </div>
            <div style="padding: 30px;">
                <h2>Results Summary</h2>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <div style="display: flex; justify-content: space-between; margin: 10px 0;">
                        <span><strong>Total Contacts:</strong></span>
                        <span>{total_contacts}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 10px 0;">
                        <span><strong>Emails Found:</strong></span>
                        <span>{emails_found} ({success_rate}%)</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 10px 0;">
                        <span><strong>Phone Numbers:</strong></span>
                        <span>{phones_found}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 10px 0;">
                        <span><strong>Credits Used:</strong></span>
                        <span>{credits_used}</span>
                    </div>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{dashboard_url}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        View Results
                    </a>
                </div>
            </div>
        </body>
        </html>
        """
    },
    "low_credits": {
        "subject": "⚠️ Low Credit Alert - Captely",
        "html": """
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #f39c12; color: white; padding: 30px; text-align: center;">
                <h1>⚠️ Low Credits Alert</h1>
                <p>Your credit balance is running low.</p>
            </div>
            <div style="padding: 30px;">
                <p>Hi there,</p>
                <p>Your Captely account currently has <strong>{current_credits} credits</strong> remaining.</p>
                <p>To continue enriching your contacts without interruption, we recommend topping up your account.</p>
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0;">
                    <p><strong>Tip:</strong> Consider setting up automatic top-ups to never run out of credits!</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{topup_url}" style="background: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        Top Up Credits
                    </a>
                </div>
            </div>
        </body>
        </html>
        """
    },
    "weekly_summary": {
        "subject": "📊 Your Weekly Captely Summary",
        "html": """
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #2c3e50; color: white; padding: 30px; text-align: center;">
                <h1>📊 Weekly Summary</h1>
                <p>Here's what you accomplished this week!</p>
            </div>
            <div style="padding: 30px;">
                <h2>This Week's Activity</h2>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <div style="display: flex; justify-content: space-between; margin: 10px 0;">
                        <span><strong>Contacts Processed:</strong></span>
                        <span>{weekly_contacts}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 10px 0;">
                        <span><strong>Emails Found:</strong></span>
                        <span>{weekly_emails}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 10px 0;">
                        <span><strong>Success Rate:</strong></span>
                        <span>{weekly_success_rate}%</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 10px 0;">
                        <span><strong>Credits Used:</strong></span>
                        <span>{weekly_credits}</span>
                    </div>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{analytics_url}" style="background: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        View Full Analytics
                    </a>
                </div>
            </div>
        </body>
        </html>
        """
    }
}

class EmailService:
    """Email service for sending notifications"""
    
    def __init__(self):
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_username = os.getenv("SMTP_USERNAME", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.from_email = os.getenv("FROM_EMAIL", "noreply@captely.com")
        self.from_name = os.getenv("FROM_NAME", "Captely")
    
    async def send_email(self, to_email: str, subject: str, html_content: str, text_content: str = None):
        """Send an email using SMTP"""
        try:
            msg = MimeMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            
            # Add text version if provided
            if text_content:
                text_part = MimeText(text_content, 'plain')
                msg.attach(text_part)
            
            # Add HTML version
            html_part = MimeText(html_content, 'html')
            msg.attach(html_part)
            
            # Send the email
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.smtp_username, self.smtp_password)
            server.send_message(msg)
            server.quit()
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

email_service = EmailService()

@app.post("/api/notifications/send-email")
async def send_email_notification(
    notification: EmailNotification,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session)
):
    """Send a custom email notification"""
    
    template = EMAIL_TEMPLATES.get(notification.template_name)
    if not template:
        raise HTTPException(status_code=400, detail="Template not found")
    
    # Render template
    html_content = template["html"].format(**notification.template_data)
    subject = template["subject"]
    
    # Send email in background
    background_tasks.add_task(
        email_service.send_email,
        notification.recipient_email,
        subject,
        html_content
    )
    
    # Log the notification
    log_query = """
        INSERT INTO notification_logs (recipient_email, template_name, subject, status, created_at)
        VALUES (:recipient_email, :template_name, :subject, :status, :created_at)
    """
    await session.execute(text(log_query), {
        "recipient_email": notification.recipient_email,
        "template_name": notification.template_name,
        "subject": subject,
        "status": "queued",
        "created_at": datetime.now()
    })
    await session.commit()
    
    return {"status": "queued", "message": "Email notification queued for delivery"}

@app.post("/api/notifications/job-completion")
async def notify_job_completion(
    notification: JobCompletionNotification,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session)
):
    """Send job completion notification"""
    
    # Get user email and preferences
    user_query = """
        SELECT u.email, np.job_completion_alerts, np.email_notifications
        FROM users u
        LEFT JOIN notification_preferences np ON u.id = np.user_id
        WHERE u.id = :user_id
    """
    result = await session.execute(text(user_query), {"user_id": notification.user_id})
    user_data = result.fetchone()
    
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_email = user_data[0]
    job_completion_alerts = user_data[1] if user_data[1] is not None else True  # Default to True
    email_notifications = user_data[2] if user_data[2] is not None else True  # Default to True
    
    # Check if user wants job completion notifications
    if not job_completion_alerts or not email_notifications:
        return {"status": "skipped", "reason": "User has disabled job completion notifications"}
    
    # Prepare template data
    template_data = {
        "job_name": f"Job {notification.job_id[:8]}",
        "total_contacts": notification.results_summary.get("total_contacts", 0),
        "emails_found": notification.results_summary.get("emails_found", 0),
        "phones_found": notification.results_summary.get("phones_found", 0),
        "success_rate": round(notification.results_summary.get("success_rate", 0), 1),
        "credits_used": notification.results_summary.get("credits_used", 0),
        "dashboard_url": f"https://app.captely.com/dashboard?job={notification.job_id}"
    }
    
    # Send notification
    email_notif = EmailNotification(
        recipient_email=user_email,
        subject="",  # Will be overridden by template
        template_name="job_completion",
        template_data=template_data,
        priority="normal"
    )
    
    return await send_email_notification(email_notif, background_tasks, session)

@app.post("/api/notifications/credit-alert")
async def notify_credit_alert(
    notification: CreditAlertNotification,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session)
):
    """Send credit alert notification"""
    
    # Get user email and preferences
    user_query = """
        SELECT email, notification_preferences FROM users WHERE id = :user_id
    """
    result = await session.execute(text(user_query), {"user_id": notification.user_id})
    user_data = result.fetchone()
    
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_email = user_data[0]
    preferences = user_data[1] or {}
    
    # Check if user wants credit warnings
    if not preferences.get("credit_warnings", True):
        return {"status": "skipped", "reason": "User has disabled credit warnings"}
    
    # Determine template based on alert type
    template_name = "low_credits"
    if notification.alert_type == "no_credits":
        template_name = "no_credits"
    elif notification.alert_type == "limit_exceeded":
        template_name = "limit_exceeded"
    
    # Prepare template data
    template_data = {
        "current_credits": notification.current_credits,
        "threshold": notification.threshold,
        "topup_url": "https://app.captely.com/billing/topup"
    }
    
    # Send notification
    email_notif = EmailNotification(
        recipient_email=user_email,
        subject="",  # Will be overridden by template
        template_name=template_name,
        template_data=template_data,
        priority="high" if notification.alert_type == "no_credits" else "normal"
    )
    
    return await send_email_notification(email_notif, background_tasks, session)

@app.get("/api/notifications/preferences/{user_id}")
async def get_notification_preferences(
    user_id: str,
    session: AsyncSession = Depends(get_async_session),
    auth_user: str = Depends(verify_jwt)
):
    """Get user's notification preferences"""
    
    query = """
        SELECT notification_preferences FROM users WHERE id = :user_id
    """
    result = await session.execute(text(query), {"user_id": user_id})
    preferences = result.scalar()
    
    # Default preferences if none set
    default_prefs = {
        "email_notifications": True,
        "job_completion_alerts": True,
        "credit_warnings": True,
        "weekly_summary": True,
        "low_credit_threshold": 50
    }
    
    return preferences or default_prefs

@app.post("/api/notifications/preferences/{user_id}")
async def update_notification_preferences(
    user_id: str,
    preferences: NotificationPreferences,
    session: AsyncSession = Depends(get_async_session),
    auth_user: str = Depends(verify_jwt)
):
    """Update user's notification preferences"""
    
    prefs_dict = preferences.dict()
    del prefs_dict["user_id"]  # Remove user_id from the preferences
    
    query = """
        UPDATE users SET 
            notification_preferences = :preferences,
            updated_at = :updated_at
        WHERE id = :user_id
    """
    
    await session.execute(text(query), {
        "preferences": prefs_dict,
        "user_id": user_id,
        "updated_at": datetime.now()
    })
    await session.commit()
    
    return {"status": "updated", "preferences": prefs_dict}

@app.post("/api/notifications/weekly-summary")
async def send_weekly_summaries(
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session)
):
    """Send weekly summary emails to all users who have opted in"""
    
    # Get users who want weekly summaries
    users_query = """
        SELECT id, email, notification_preferences 
        FROM users 
        WHERE notification_preferences->>'weekly_summary' = 'true' 
           OR notification_preferences IS NULL
    """
    result = await session.execute(text(users_query))
    users = result.fetchall()
    
    one_week_ago = datetime.now() - timedelta(days=7)
    sent_count = 0
    
    for user in users:
        user_id, email, preferences = user
        
        # Get weekly stats for this user
        stats_query = """
            SELECT 
                COUNT(*) as contacts,
                COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as emails,
                SUM(credits_consumed) as credits
            FROM contacts 
            WHERE job_id IN (
                SELECT id FROM import_jobs WHERE user_id = :user_id
            )
            AND created_at >= :one_week_ago
        """
        
        stats_result = await session.execute(text(stats_query), {
            "user_id": user_id,
            "one_week_ago": one_week_ago
        })
        stats = stats_result.fetchone()
        
        # Skip if no activity
        if not stats or stats[0] == 0:
            continue
        
        # Prepare template data
        weekly_contacts = stats[0] or 0
        weekly_emails = stats[1] or 0
        template_data = {
            "weekly_contacts": weekly_contacts,
            "weekly_emails": weekly_emails,
            "weekly_success_rate": round((weekly_emails / weekly_contacts * 100) if weekly_contacts > 0 else 0, 1),
            "weekly_credits": stats[2] or 0,
            "analytics_url": "https://app.captely.com/analytics"
        }
        
        # Send summary email
        background_tasks.add_task(
            email_service.send_email,
            email,
            EMAIL_TEMPLATES["weekly_summary"]["subject"],
            EMAIL_TEMPLATES["weekly_summary"]["html"].format(**template_data)
        )
        sent_count += 1
    
    return {"status": "success", "sent_count": sent_count}

@app.get("/api/notifications/")
async def get_user_notifications(
    limit: int = 50,
    session: AsyncSession = Depends(get_async_session),
    auth_user: str = Depends(verify_jwt)
):
    """Get notifications for the authenticated user"""
    
    try:
        # Get recent notification logs for this user
        user_query = "SELECT email FROM users WHERE id = :user_id"
        user_result = await session.execute(text(user_query), {"user_id": auth_user})
        user_email = user_result.scalar()
        
        if not user_email:
            return {"notifications": []}
        
        # Get recent notifications from logs with job info
        logs_query = """
            SELECT nl.template_name, nl.subject, nl.status, nl.created_at, nl.recipient_email,
                   ij.id as job_id, ij.file_name
            FROM notification_logs nl
            LEFT JOIN import_jobs ij ON ij.user_id = :user_id 
                AND DATE(ij.created_at) = DATE(nl.created_at)
                AND nl.template_name = 'job_completion'
            WHERE nl.recipient_email = :email 
            ORDER BY nl.created_at DESC 
            LIMIT :limit
        """
        
        result = await session.execute(text(logs_query), {
            "email": user_email,
            "user_id": auth_user,
            "limit": limit
        })
        logs = result.fetchall()
        
        # Format notifications for frontend
        notifications = []
        for log in logs:
            template_name, subject, status, created_at, recipient_email, job_id, file_name = log
            
            # Map template names to notification types
            notification_type = "system_update"
            if template_name == "job_completion":
                notification_type = "job_completed"
            elif template_name in ["low_credits", "no_credits"]:
                notification_type = "low_credits"
            elif template_name == "weekly_summary":
                notification_type = "batch_complete"
            
            # Prepare notification data with job_id for job completion notifications
            notification_data = {}
            if template_name == "job_completion" and job_id:
                notification_data = {
                    "job_id": job_id,
                    "file_name": file_name
                }
            
            notifications.append({
                "id": f"{template_name}_{int(created_at.timestamp())}",
                "type": notification_type,
                "title": subject,
                "message": _get_notification_message(template_name, subject),
                "read": status in ["delivered", "read"],
                "created_at": created_at.isoformat(),
                "data": notification_data
            })
        
        # 🔥 IF NO NOTIFICATIONS, ADD SOME TEST ONES FOR DEMO
        if len(notifications) == 0:
            # Check if user has any completed jobs to create notifications for
            jobs_query = """
                SELECT id, file_name, created_at, total, completed
                FROM import_jobs 
                WHERE user_id = :user_id 
                AND status = 'completed'
                ORDER BY created_at DESC 
                LIMIT 3
            """
            job_result = await session.execute(text(jobs_query), {"user_id": auth_user})
            completed_jobs = job_result.fetchall()
            
            for job in completed_jobs:
                job_id, file_name, created_at, total, completed = job
                notifications.append({
                    "id": f"job_completed_{int(created_at.timestamp())}",
                    "type": "job_completed",
                    "title": "Enrichment Complete! 🎉",
                    "message": f"{file_name or f'Job {job_id[:8]}'} has been processed successfully",
                    "read": False,
                    "created_at": created_at.isoformat(),
                    "data": {
                        "job_id": job_id,
                        "file_name": file_name
                    }
                })
        
        return {"notifications": notifications}
        
    except Exception as e:
        logger.error(f"Error fetching notifications for user {auth_user}: {str(e)}")
        return {"notifications": []}

def _get_notification_message(template_name: str, subject: str) -> str:
    """Generate notification message based on template"""
    if template_name == "job_completion":
        return "Your enrichment job has finished processing. Click to view results."
    elif template_name == "low_credits":
        return "Your credit balance is running low. Consider topping up to continue."
    elif template_name == "weekly_summary":
        return "Your weekly activity summary is ready to view."
    else:
        return subject

@app.post("/api/notifications/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: str,
    session: AsyncSession = Depends(get_async_session),
    auth_user: str = Depends(verify_jwt)
):
    """Mark a specific notification as read"""
    
    try:
        # Extract timestamp from notification ID
        if "_" in notification_id:
            timestamp_str = notification_id.split("_")[-1]
            timestamp = datetime.fromtimestamp(int(timestamp_str))
            
            # Update notification status (if logs table has status tracking)
            update_query = """
                UPDATE notification_logs 
                SET status = 'read' 
                WHERE created_at = :timestamp 
                AND recipient_email = (
                    SELECT email FROM users WHERE id = :user_id
                )
            """
            
            await session.execute(text(update_query), {
                "timestamp": timestamp,
                "user_id": auth_user
            })
            await session.commit()
        
        return {"success": True}
        
    except Exception as e:
        logger.error(f"Error marking notification as read: {str(e)}")
        return {"success": False}

@app.post("/api/notifications/mark-all-read")
async def mark_all_notifications_as_read(
    session: AsyncSession = Depends(get_async_session),
    auth_user: str = Depends(verify_jwt)
):
    """Mark all notifications as read for the authenticated user"""
    
    try:
        # Get user's email
        user_query = "SELECT email FROM users WHERE id = :user_id"
        user_result = await session.execute(text(user_query), {"user_id": auth_user})
        user_email = user_result.scalar()
        
        if user_email:
            # Mark all notifications as read
            update_query = """
                UPDATE notification_logs 
                SET status = 'read' 
                WHERE recipient_email = :email
            """
            
            await session.execute(text(update_query), {"email": user_email})
            await session.commit()
        
        return {"success": True}
        
    except Exception as e:
        logger.error(f"Error marking all notifications as read: {str(e)}")
        return {"success": False}

@app.delete("/api/notifications/all")
async def delete_all_notifications(
    session: AsyncSession = Depends(get_async_session),
    auth_user: str = Depends(verify_jwt)
):
    """Delete all notifications for the authenticated user"""
    
    try:
        # Get user's email
        user_query = "SELECT email FROM users WHERE id = :user_id"
        user_result = await session.execute(text(user_query), {"user_id": auth_user})
        user_email = user_result.scalar()
        
        if user_email:
            # Delete all notification logs for this user
            delete_query = """
                DELETE FROM notification_logs 
                WHERE recipient_email = :email
            """
            
            await session.execute(text(delete_query), {"email": user_email})
            await session.commit()
        
        return {"success": True, "message": "All notifications deleted"}
        
    except Exception as e:
        logger.error(f"Error deleting all notifications: {str(e)}")
        return {"success": False, "error": str(e)}

@app.get("/api/notifications/logs/{user_id}")
async def get_notification_logs(
    user_id: str,
    limit: int = 50,
    session: AsyncSession = Depends(get_async_session),
    auth_user: str = Depends(verify_jwt)
):
    """Get notification logs for a user"""
    
    # Get user's email first
    user_query = "SELECT email FROM users WHERE id = :user_id"
    user_result = await session.execute(text(user_query), {"user_id": user_id})
    user_email = user_result.scalar()
    
    if not user_email:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get notification logs
    logs_query = """
        SELECT template_name, subject, status, created_at, delivered_at, error_message
        FROM notification_logs 
        WHERE recipient_email = :email
        ORDER BY created_at DESC
        LIMIT :limit
    """
    
    result = await session.execute(text(logs_query), {
        "email": user_email,
        "limit": limit
    })
    
    logs = [
        {
            "template_name": row[0],
            "subject": row[1],
            "status": row[2],
            "created_at": row[3],
            "delivered_at": row[4],
            "error_message": row[5]
        }
        for row in result.fetchall()
    ]
    
    return {"logs": logs}

# Background task to check for credit alerts
async def check_credit_alerts():
    """Background task to check for users with low credits"""
    async with AsyncSessionLocal() as session:
        # Find users with low credits who haven't been alerted recently
        query = """
            SELECT id, email, credits, notification_preferences
            FROM users 
            WHERE credits <= COALESCE(
                (notification_preferences->>'low_credit_threshold')::int, 
                50
            )
            AND (
                last_credit_alert IS NULL 
                OR last_credit_alert < NOW() - INTERVAL '24 hours'
            )
        """
        
        result = await session.execute(text(query))
        users = result.fetchall()
        
        for user in users:
            user_id, email, credits, preferences = user
            threshold = (preferences or {}).get("low_credit_threshold", 50)
            
            # Send alert
            notification = CreditAlertNotification(
                user_id=user_id,
                current_credits=credits,
                threshold=threshold,
                alert_type="low_credits" if credits > 0 else "no_credits"
            )
            
            # This would be called via API in real implementation
            # await notify_credit_alert(notification, BackgroundTasks(), session)
            
            # Update last alert time
            update_query = """
                UPDATE users SET last_credit_alert = NOW() WHERE id = :user_id
            """
            await session.execute(text(update_query), {"user_id": user_id})
        
        await session.commit()

# Health check endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "notification-service", "version": "1.0.0"}

@app.get("/api/health")
async def api_health_check():
    """API health check endpoint"""
    return {"status": "healthy", "service": "notification-service", "version": "1.0.0"}

@app.post("/api/notifications/test")
async def create_test_notifications(
    session: AsyncSession = Depends(get_async_session),
    auth_user: str = Depends(verify_jwt)
):
    """Create test notifications for development/testing"""
    
    try:
        # Get user email
        user_query = "SELECT email FROM users WHERE id = :user_id"
        user_result = await session.execute(text(user_query), {"user_id": auth_user})
        user_email = user_result.scalar()
        
        if not user_email:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Create test notification logs
        test_notifications = [
            {
                "template_name": "job_completion",
                "subject": "🎉 Your enrichment job is complete!",
                "status": "delivered"
            },
            {
                "template_name": "low_credits", 
                "subject": "⚠️ Low Credit Warning",
                "status": "delivered"
            },
            {
                "template_name": "weekly_summary",
                "subject": "📊 Your Weekly Summary",
                "status": "delivered"
            }
        ]
        
        for notif in test_notifications:
            log_query = """
                INSERT INTO notification_logs (recipient_email, template_name, subject, status, created_at)
                VALUES (:recipient_email, :template_name, :subject, :status, :created_at)
            """
            await session.execute(text(log_query), {
                "recipient_email": user_email,
                "template_name": notif["template_name"],
                "subject": notif["subject"],
                "status": notif["status"],
                "created_at": datetime.now()
            })
        
        await session.commit()
        
        return {"status": "success", "message": "Test notifications created"}
        
    except Exception as e:
        logger.error(f"Error creating test notifications: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 