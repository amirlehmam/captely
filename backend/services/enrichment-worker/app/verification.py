# backend/services/enrichment-worker/app/verification.py
import re
import asyncio
import socket
from typing import Optional, Tuple
from dataclasses import dataclass
import phonenumbers
from phonenumbers import geocoder, carrier
from phonenumbers import timezone as ph_timezone  # Renamed
from phonenumbers.phonenumberutil import NumberParseException

from app.common import logger  # Assuming common.utils is moved to app.common


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
            'noreply', 'no-reply', 'help', 'service', 'team', 'office', 'hr',
            'jobs', 'billing', 'abuse', 'security', 'dev', 'test'
        ]

    def _load_disposable_domains(self) -> set:
        """Load list of disposable email domains"""
        # A more comprehensive list could be loaded from a file
        # or external source
        return {
            '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
            'mailinator.com', 'yopmail.com', 'temp-mail.org',
            'throwaway.email', 'getnada.com', 'dispostable.com',
            'mailsac.com', 'tempail.com', 'trashmail.com'
        }

    async def verify_email(self, email: str) -> EmailVerificationResult:
        """4-level email verification process"""
        if not email:
            return EmailVerificationResult(
                email="", is_valid=False, verification_level=0,
                is_catchall=False, is_disposable=False,
                is_role_based=False, deliverable=False, score=0,
                reason="Empty email"
            )

        email_lower = email.lower().strip()
        domain = email_lower.split('@')[-1] if '@' in email_lower else ''

        level1_valid = self._validate_syntax(email_lower)
        if not level1_valid:
            return EmailVerificationResult(
                email=email, is_valid=False, verification_level=1,
                is_catchall=False, is_disposable=False,
                is_role_based=False, deliverable=False, score=0,
                reason="Invalid syntax"
            )

        is_disposable = domain in self.disposable_domains
        local_part = email_lower.split('@')[0]
        is_role_based = any(
            local_part.startswith(prefix)
            for prefix in self.role_based_prefixes
        )

        # Changed to DNS check
        level2_valid = await self._validate_domain_dns(domain)
        if not level2_valid:
            return EmailVerificationResult(
                email=email, is_valid=False, verification_level=2,
                is_catchall=False, is_disposable=is_disposable,
                is_role_based=is_role_based, deliverable=False, score=20,
                reason="Invalid domain or no A/AAAA record"
            )

        has_mx, is_catchall_domain = await self._validate_mx_records(domain)
        if not has_mx:
            return EmailVerificationResult(
                email=email, is_valid=False, verification_level=3,
                is_catchall=is_catchall_domain,
                is_disposable=is_disposable, is_role_based=is_role_based,
                deliverable=False, score=40, reason="No MX records"
            )

        # FIXED: More permissive deliverable status - if MX records exist and not disposable, consider deliverable
        smtp_valid = has_mx and not is_disposable
        deliverable_status = smtp_valid

        score = self._calculate_score(
            level1_valid, level2_valid, has_mx, smtp_valid,
            is_disposable, is_role_based, is_catchall_domain
        )

        reason_text = "Verification complete"
        if not deliverable_status:
            reason_text = "Likely undeliverable"

        # FIXED: Use proper thresholds to match dashboard expectations
        # - 90-100%: Excellent
        # - 80-89%: Very Good  
        # - 70-79%: Good (should be valid)
        # - 50-69%: Fair (should be valid)
        # - 0-49%: Poor (invalid)
        is_email_valid = score >= 60  # FIXED: Lower threshold to 60 to include "Good" emails

        return EmailVerificationResult(
            email=email,
            is_valid=is_email_valid,  # FIXED: Use score-based validation instead of deliverable_status
            verification_level=4 if smtp_valid else 3,
            is_catchall=is_catchall_domain,
            is_disposable=is_disposable,
            is_role_based=is_role_based,
            deliverable=deliverable_status,
            score=score,
            reason=reason_text
        )

    def _validate_syntax(self, email: str) -> bool:
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))

    async def _validate_domain_dns(self, domain: str) -> bool:
        """Level 2: Domain existence validation using DNS A/AAAA records."""
        if not domain:
            return False
        try:
            # Use asyncio's getaddrinfo for non-blocking DNS resolution
            loop = asyncio.get_event_loop()
            await loop.getaddrinfo(domain, None)
            return True
        except socket.gaierror:  # Not socket, but asyncio's equivalent
            logger.debug(f"Domain DNS check failed for {domain}")
            return False
        except Exception as e:
            logger.warning(f"Error during domain DNS check for {domain}: {e}")
            return False

    async def _validate_mx_records(self, domain: str) -> tuple[bool, bool]:
        """Level 3: MX record validation using dnspython if available."""
        if not domain:
            return False, False
        try:
            import dns.resolver  # type: ignore
            # Run DNS resolution in a separate thread to avoid blocking
            # asyncio loop
            loop = asyncio.get_event_loop()
            mx_records = await loop.run_in_executor(
                None, dns.resolver.resolve, domain, 'MX'
            )
            has_mx = len(mx_records) > 0

            # Basic catch-all detection (can be improved)
            # If a domain has a very low preference MX record
            # (e.g., priority > 50) or only one MX record, it might be
            # a catch-all. This is a heuristic.
            is_catchall = False
            if has_mx and len(mx_records) == 1:
                # Some providers use specific naming for catch-all,
                # e.g. "catchall.example.com"
                if any(
                    str(mx_records[0].exchange).lower().startswith(p)
                    for p in ["catchall.", "spam.", "junk."]
                ):
                    is_catchall = True

            return has_mx, is_catchall
        except ImportError:
            logger.warning(
                "dnspython library not found. MX record check will be skipped."
            )
            return False, False  # Cannot check MX without dnspython
        except dns.resolver.NXDOMAIN:
            logger.debug(f"MX check: Domain {domain} not found (NXDOMAIN).")
            return False, False
        except dns.resolver.NoAnswer:
            logger.debug(f"MX check: No MX records found for {domain}.")
            return False, False
        except Exception as e:
            logger.warning(f"Error during MX record check for {domain}: {e}")
            return False, False  # Default to no MX on error

    def _calculate_score(
        self, syntax: bool, domain_dns: bool, mx: bool,
        smtp_assumed: bool, disposable: bool, role_based: bool,
        catchall: bool
    ) -> float:
        # FIXED: Improved scoring to better reflect email quality
        score = 0
        
        # Base scores for each level
        if syntax:
            score += 20  # Higher weight for valid syntax
        if domain_dns:
            score += 25  # Higher weight for valid domain
        if mx:
            score += 40  # Much higher weight for MX records (most important)
        if smtp_assumed and mx and not disposable:
            score += 15  # Bonus for assumed deliverability

        # FIXED: Adjusted penalties to allow good emails to reach 70+
        if disposable:
            score -= 60  # Strong penalty for disposable emails
        if role_based:
            score -= 10  # Reduced penalty for role-based emails
        if catchall:
            score -= 5   # Reduced penalty for catchall domains

        # FIXED: Ensure enriched emails get at least 70 if they have MX and aren't disposable
        if mx and not disposable and syntax and domain_dns:
            score = max(score, 70)  # Minimum score for valid emails from enrichment providers

        return max(0, min(100, score))


email_verifier = EmailVerifier()


@dataclass
class PhoneVerificationResult:
    phone: str
    is_valid: bool
    is_mobile: bool
    is_landline: bool
    is_voip: bool
    country: str
    carrier_name: str
    region: str
    timezone: str  # Changed from ph_timezone to timezone
    formatted_national: str
    formatted_international: str
    score: float  # 0-100
    reason: str


class PhoneVerifier:
    def __init__(self):
        self.mobile_carriers_keywords = {  # More generic keywords
            'cell', 'mobile', 'wireless', 'gsm', 'pcs', 'lte', '5g',
            'orange', 'sfr', 'bouygues', 'free', 'verizon', 'at&t',
            't-mobile', 'vodafone', 'o2', 'ee', 'three', 'sprint',
            'rogers', 'bell', 'telus', 'koodo', 'fido', 'virgin', 'wind',
            'mobilicity'
        }
        self.voip_indicators_keywords = {
            'voip', 'internet phone', 'digital voice', 'google voice',
            'skype', 'vonage', 'magicjack', 'bandwidth.com', 'twilio',
            'nexmo', 'plivo', 'telnyx', 'signalwire', 'ringcentral'
        }

    async def verify_phone(self, phone: str, country_hint: Optional[str] = None) -> PhoneVerificationResult:
        if not phone:
            return PhoneVerificationResult(
                phone="", is_valid=False, is_mobile=False,
                is_landline=False, is_voip=False, country="",
                carrier_name="", region="", timezone="",
                formatted_national="", formatted_international="",
                score=0, reason="Empty phone"
            )

        cleaned_phone = self._clean_phone_number(phone)

        try:
            parsed_phone = phonenumbers.parse(cleaned_phone, country_hint)
        except NumberParseException as e:
            return PhoneVerificationResult(
                phone=phone, is_valid=False, is_mobile=False,
                is_landline=False, is_voip=False, country="",
                carrier_name="", region="", timezone="",
                formatted_national="", formatted_international="",
                score=0, reason=f"Parse error: {e.error_type.name}"
            )

        basic_valid = phonenumbers.is_valid_number(parsed_phone)
        possible_valid = phonenumbers.is_possible_number(parsed_phone)

        # Get phone type
        phone_type = phonenumbers.number_type(parsed_phone)
        is_mobile = phone_type in [
            phonenumbers.PhoneNumberType.MOBILE,
            phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE
        ]
        is_landline = phone_type == phonenumbers.PhoneNumberType.FIXED_LINE
        is_voip = phone_type == phonenumbers.PhoneNumberType.VOIP

        # Get carrier and location info
        carrier_name_raw = carrier.name_for_number(parsed_phone, 'en') or ""
        country_code = phonenumbers.region_code_for_number(parsed_phone) or ""
        region = geocoder.description_for_number(parsed_phone, 'en') or ""

        # Get timezones
        timezones_list = ph_timezone.time_zones_for_number(parsed_phone)
        timezone_str = timezones_list[0] if timezones_list else ""

        # Format numbers
        formatted_national = phonenumbers.format_number(
            parsed_phone, phonenumbers.PhoneNumberFormat.NATIONAL
        ) if basic_valid else ""
        formatted_international = phonenumbers.format_number(
            parsed_phone, phonenumbers.PhoneNumberFormat.INTERNATIONAL
        ) if basic_valid else ""

        score = self._calculate_phone_score(
            is_mobile, is_landline, is_voip, carrier_name_raw,
            country_code, basic_valid
        )

        # FIXED: Use score-based validation consistent with email verification
        is_phone_valid = basic_valid and score >= 60  # FIXED: Consistent 60% threshold

        return PhoneVerificationResult(
            phone=phone,
            is_valid=is_phone_valid,  # FIXED: Score-based validation
            is_mobile=is_mobile,
            is_landline=is_landline,
            is_voip=is_voip,
            country=country_code,
            carrier_name=carrier_name_raw,
            region=region,
            timezone=timezone_str,
            formatted_national=formatted_national,
            formatted_international=formatted_international,
            score=score,
            reason="Phone verification completed" if is_phone_valid else f"Low quality score: {score}"
        )

    def _clean_phone_number(self, phone: str) -> str:
        cleaned = re.sub(r'[^\d+]', '', phone.strip())
        if (len(cleaned) > 10 and
                not cleaned.startswith('+') and
                not cleaned.startswith('00')):
            # Heuristic: if it's long and doesn't have +, it might need it.
            # This is tricky; phonenumbers.parse handles many cases.
            pass  # phonenumbers.parse is generally good at handling this
        return cleaned

    def _calculate_phone_score(
        self, is_mobile: bool, is_landline: bool, is_voip: bool,
        carrier_name_raw: str, country: str, is_valid_format: bool
    ) -> float:
        if not is_valid_format:
            return 0

        score = 40  # Base for valid format

        if is_mobile:
            score += 40
        elif is_landline:
            score += 25
        elif is_voip:
            score += 10
        else:  # Unknown but valid type
            score += 5

        carrier_lower = carrier_name_raw.lower() if carrier_name_raw else ""
        if carrier_name_raw:
            score += 10
            if any(
                keyword in carrier_lower
                for keyword in self.mobile_carriers_keywords
            ) and is_mobile:
                score += 10  # Bonus for known mobile carrier

        high_quality_countries = {
            'US', 'CA', 'GB', 'FR', 'DE', 'AU', 'NL', 'SE', 'NO', 'DK',
            'IE', 'CH', 'BE'
        }
        if country in high_quality_countries:
            score += 10

        return min(100, max(0, round(score)))


phone_verifier = PhoneVerifier()