"""
Enrichment package for cascading enrichment with cost optimization
"""

# Export verification modules
try:
    from .email_verification import email_verifier, EmailVerificationResult
    from .phone_verification import phone_verifier, PhoneVerificationResult
    
    # Mark verification as available
    VERIFICATION_AVAILABLE = True
    
    print("✅ Email and phone verification modules loaded successfully")
    
except ImportError as e:
    print(f"⚠️ Verification modules not available: {e}")
    
    # Create dummy verifiers if imports fail
    email_verifier = None
    phone_verifier = None
    EmailVerificationResult = None
    PhoneVerificationResult = None
    VERIFICATION_AVAILABLE = False

__all__ = [
    'email_verifier', 
    'phone_verifier', 
    'EmailVerificationResult', 
    'PhoneVerificationResult',
    'VERIFICATION_AVAILABLE'
] 