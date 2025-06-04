"""
Email verification module with 4-level verification system
"""
import re
import socket
import smtplib
import asyncio
import dns.resolver
from typing import Dict, List, Optional
from dataclasses import dataclass

# Common disposable email domains
DISPOSABLE_DOMAINS = {
    "10minutemail.com", "guerrillamail.com", "mailinator.com", "tempmail.org",
    "temp-mail.org", "throwaway.email", "dispostable.com", "yopmail.com",
    "sharklasers.com", "grr.la", "guerrillamailblock.com", "pokemail.net",
    "spam4.me", "bccto.me", "chacuo.net", "dispostable.com", "rcpt.at"
}

# Common role-based email prefixes
ROLE_BASED_PREFIXES = {
    "admin", "administrator", "contact", "help", "info", "mail", "noreply",
    "no-reply", "postmaster", "root", "sales", "support", "webmaster",
    "marketing", "hr", "finance", "legal", "billing", "accounting"
}

@dataclass
class EmailVerificationResult:
    """Result of email verification"""
    email: str
    is_valid: bool
    verification_level: int  # 1-4 (syntax, domain, MX, SMTP)
    is_catchall: bool
    is_disposable: bool
    is_role_based: bool
    deliverable: bool
    score: int  # 0-100
    reason: str


class EmailVerifier:
    """Advanced email verification with 4-level checking"""
    
    def __init__(self):
        self.timeout = 10
        
    async def verify_email(self, email: str) -> EmailVerificationResult:
        """
        Perform 4-level email verification
        Level 1: Syntax validation
        Level 2: Domain validation
        Level 3: MX record validation
        Level 4: SMTP validation
        """
        email = email.strip().lower()
        
        # Level 1: Syntax validation
        if not self._is_valid_syntax(email):
            return EmailVerificationResult(
                email=email,
                is_valid=False,
                verification_level=1,
                is_catchall=False,
                is_disposable=False,
                is_role_based=False,
                deliverable=False,
                score=0,
                reason="Invalid email syntax"
            )
        
        # Extract domain
        domain = email.split('@')[1]
        
        # Check for disposable domain
        is_disposable = domain in DISPOSABLE_DOMAINS
        
        # Check for role-based email
        local_part = email.split('@')[0]
        is_role_based = any(local_part.startswith(prefix) for prefix in ROLE_BASED_PREFIXES)
        
        # Level 2: Domain validation
        if not await self._is_valid_domain(domain):
            return EmailVerificationResult(
                email=email,
                is_valid=False,
                verification_level=2,
                is_catchall=False,
                is_disposable=is_disposable,
                is_role_based=is_role_based,
                deliverable=False,
                score=10 if not is_disposable else 0,
                reason="Invalid domain"
            )
        
        # Level 3: MX record validation
        mx_servers = await self._get_mx_records(domain)
        if not mx_servers:
            return EmailVerificationResult(
                email=email,
                is_valid=False,
                verification_level=3,
                is_catchall=False,
                is_disposable=is_disposable,
                is_role_based=is_role_based,
                deliverable=False,
                score=20 if not is_disposable else 0,
                reason="No MX records found"
            )
        
        # Level 4: SMTP validation
        smtp_result = await self._verify_smtp(email, mx_servers[0])
        
        # Calculate final score
        score = self._calculate_score(
            verification_level=4,
            is_disposable=is_disposable,
            is_role_based=is_role_based,
            is_catchall=smtp_result.get("is_catchall", False),
            deliverable=smtp_result.get("deliverable", False)
        )
        
        return EmailVerificationResult(
            email=email,
            is_valid=smtp_result.get("deliverable", False),
            verification_level=4,
            is_catchall=smtp_result.get("is_catchall", False),
            is_disposable=is_disposable,
            is_role_based=is_role_based,
            deliverable=smtp_result.get("deliverable", False),
            score=score,
            reason=smtp_result.get("reason", "SMTP verification completed")
        )
    
    def _is_valid_syntax(self, email: str) -> bool:
        """Validate email syntax using RFC-compliant regex"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None
    
    async def _is_valid_domain(self, domain: str) -> bool:
        """Check if domain is valid and resolvable"""
        try:
            # Try to resolve the domain
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, socket.gethostbyname, domain)
            return True
        except (socket.gaierror, Exception):
            return False
    
    async def _get_mx_records(self, domain: str) -> List[str]:
        """Get MX records for domain"""
        try:
            loop = asyncio.get_event_loop()
            mx_records = await loop.run_in_executor(None, self._resolve_mx, domain)
            return [str(mx.exchange) for mx in sorted(mx_records, key=lambda x: x.preference)]
        except Exception:
            return []
    
    def _resolve_mx(self, domain: str):
        """Synchronous MX record resolution"""
        try:
            return dns.resolver.resolve(domain, 'MX')
        except Exception:
            return []
    
    async def _verify_smtp(self, email: str, mx_server: str) -> Dict:
        """Perform SMTP verification"""
        try:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, self._smtp_check, email, mx_server)
        except Exception as e:
            return {
                "deliverable": False,
                "is_catchall": False,
                "reason": f"SMTP error: {str(e)}"
            }
    
    def _smtp_check(self, email: str, mx_server: str) -> Dict:
        """Synchronous SMTP check"""
        try:
            # Remove trailing dot from MX server if present
            mx_server = mx_server.rstrip('.')
            
            # Connect to SMTP server
            with smtplib.SMTP(mx_server, 25, timeout=self.timeout) as server:
                server.helo("captely.com")
                
                # Try to send RCPT TO command
                code, message = server.rcpt(email)
                
                if code == 250:
                    return {
                        "deliverable": True,
                        "is_catchall": False,
                        "reason": "Email address accepted"
                    }
                elif code == 550:
                    return {
                        "deliverable": False,
                        "is_catchall": False,
                        "reason": "Email address rejected"
                    }
                else:
                    # Check for catch-all by testing invalid email
                    test_email = f"nonexistent{int(asyncio.get_event_loop().time())}@{email.split('@')[1]}"
                    test_code, _ = server.rcpt(test_email)
                    
                    is_catchall = (test_code == 250)
                    
                    return {
                        "deliverable": code in [250, 251, 252],
                        "is_catchall": is_catchall,
                        "reason": f"SMTP code: {code}"
                    }
                    
        except smtplib.SMTPConnectError:
            return {
                "deliverable": False,
                "is_catchall": False,
                "reason": "Could not connect to SMTP server"
            }
        except smtplib.SMTPServerDisconnected:
            return {
                "deliverable": False,
                "is_catchall": False,
                "reason": "SMTP server disconnected"
            }
        except Exception as e:
            return {
                "deliverable": False,
                "is_catchall": False,
                "reason": f"SMTP verification failed: {str(e)}"
            }
    
    def _calculate_score(self, verification_level: int, is_disposable: bool, 
                        is_role_based: bool, is_catchall: bool, deliverable: bool) -> int:
        """Calculate email quality score (0-100)"""
        score = 0
        
        # Base score by verification level
        level_scores = {1: 10, 2: 30, 3: 50, 4: 70}
        score += level_scores.get(verification_level, 0)
        
        # Deliverability bonus
        if deliverable:
            score += 20
        
        # Penalties
        if is_disposable:
            score -= 40
        if is_role_based:
            score -= 15
        if is_catchall:
            score -= 10
        
        # Ensure score is within bounds
        return max(0, min(100, score))


# Global instance
email_verifier = EmailVerifier() 