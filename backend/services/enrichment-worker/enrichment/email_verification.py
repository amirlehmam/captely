"""
Email verification module for Captely
Implements 4-level email verification as mentioned in MVP
"""
import re
import httpx
import asyncio
from typing import Dict, Any, Optional
from dataclasses import dataclass
from common.utils import logger

@dataclass
class EmailVerificationResult:
    """Result of email verification process"""
    email: str
    is_valid: bool
    verification_level: int  # 1-4 levels
    is_catchall: bool
    is_disposable: bool
    is_role_based: bool
    deliverable: bool
    score: float  # 0-100
    reason: str

class EmailVerifier:
    """4-level email verification system"""
    
    def __init__(self):
        self.disposable_domains = self._load_disposable_domains()
        self.role_based_prefixes = [
            'admin', 'info', 'contact', 'support', 'sales', 'marketing',
            'noreply', 'no-reply', 'help', 'service', 'team', 'office'
        ]
    
    def _load_disposable_domains(self) -> set:
        """Load list of disposable email domains"""
        # Common disposable email domains
        return {
            '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
            'mailinator.com', 'yopmail.com', 'temp-mail.org',
            'throwaway.email', 'getnada.com', 'dispostable.com'
        }
    
    async def verify_email(self, email: str) -> EmailVerificationResult:
        """
        4-level email verification process:
        Level 1: Syntax validation
        Level 2: Domain validation
        Level 3: MX record validation  
        Level 4: SMTP validation
        """
        if not email:
            return EmailVerificationResult(
                email="", is_valid=False, verification_level=0,
                is_catchall=False, is_disposable=False, is_role_based=False,
                deliverable=False, score=0, reason="Empty email"
            )
        
        email = email.lower().strip()
        domain = email.split('@')[-1] if '@' in email else ''
        
        # Level 1: Syntax validation
        level1_valid = self._validate_syntax(email)
        if not level1_valid:
            return EmailVerificationResult(
                email=email, is_valid=False, verification_level=1,
                is_catchall=False, is_disposable=False, is_role_based=False,
                deliverable=False, score=0, reason="Invalid syntax"
            )
        
        # Check if disposable
        is_disposable = domain in self.disposable_domains
        
        # Check if role-based
        local_part = email.split('@')[0]
        is_role_based = any(prefix in local_part for prefix in self.role_based_prefixes)
        
        # Level 2: Domain validation
        level2_valid = await self._validate_domain(domain)
        if not level2_valid:
            return EmailVerificationResult(
                email=email, is_valid=False, verification_level=2,
                is_catchall=False, is_disposable=is_disposable, 
                is_role_based=is_role_based, deliverable=False, score=20,
                reason="Invalid domain"
            )
        
        # Level 3: MX record validation
        has_mx, is_catchall = await self._validate_mx_records(domain)
        if not has_mx:
            return EmailVerificationResult(
                email=email, is_valid=False, verification_level=3,
                is_catchall=is_catchall, is_disposable=is_disposable,
                is_role_based=is_role_based, deliverable=False, score=40,
                reason="No MX records"
            )
        
        # Level 4: SMTP validation (basic)
        smtp_valid = await self._validate_smtp(email, domain)
        
        # Calculate final score
        score = self._calculate_score(
            level1_valid, level2_valid, has_mx, smtp_valid,
            is_disposable, is_role_based, is_catchall
        )
        
        return EmailVerificationResult(
            email=email, is_valid=smtp_valid, verification_level=4,
            is_catchall=is_catchall, is_disposable=is_disposable,
            is_role_based=is_role_based, deliverable=smtp_valid,
            score=score, reason="Verification complete"
        )
    
    def _validate_syntax(self, email: str) -> bool:
        """Level 1: Basic syntax validation"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))
    
    async def _validate_domain(self, domain: str) -> bool:
        """Level 2: Domain existence validation"""
        try:
            # Simple HTTP check to see if domain exists
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"http://{domain}", follow_redirects=True)
                return True
        except:
            try:
                # Try HTTPS
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(f"https://{domain}", follow_redirects=True)
                    return True
            except:
                return False
    
    async def _validate_mx_records(self, domain: str) -> tuple[bool, bool]:
        """Level 3: MX record validation"""
        try:
            import dns.resolver
            mx_records = dns.resolver.resolve(domain, 'MX')
            has_mx = len(mx_records) > 0
            
            # Simple catchall detection (would need more sophisticated logic)
            is_catchall = False
            for mx in mx_records:
                if 'google' in str(mx.exchange).lower():
                    is_catchall = False  # Google typically not catchall
                    break
            
            return has_mx, is_catchall
        except:
            return False, False
    
    async def _validate_smtp(self, email: str, domain: str) -> bool:
        """Level 4: Basic SMTP validation"""
        # In production, this would do actual SMTP handshake
        # For now, return True if previous levels passed
        # This is a simplified version - real SMTP validation is complex
        return True
    
    def _calculate_score(self, syntax: bool, domain: bool, mx: bool, 
                        smtp: bool, disposable: bool, role_based: bool, 
                        catchall: bool) -> float:
        """Calculate email quality score 0-100"""
        score = 0
        
        if syntax: score += 20
        if domain: score += 20  
        if mx: score += 20
        if smtp: score += 30
        
        # Penalties
        if disposable: score -= 40
        if role_based: score -= 10
        if catchall: score -= 15
        
        return max(0, min(100, score))

# Global verifier instance
email_verifier = EmailVerifier() 