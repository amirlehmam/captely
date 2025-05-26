"""
Phone verification module for Captely
Detects mobile vs landline and validates phone numbers
"""
import re
import httpx
import asyncio
from typing import Dict, Any, Optional, Tuple
from dataclasses import dataclass
import phonenumbers
from phonenumbers import geocoder, carrier, timezone
from phonenumbers.phonenumberutil import NumberParseException
from common.utils import logger

@dataclass
class PhoneVerificationResult:
    """Result of phone verification process"""
    phone: str
    is_valid: bool
    is_mobile: bool
    is_landline: bool
    is_voip: bool
    country: str
    carrier_name: str
    region: str
    timezone: str
    formatted_national: str
    formatted_international: str
    score: float  # 0-100
    reason: str

class PhoneVerifier:
    """Phone verification and classification system"""
    
    def __init__(self):
        # Mobile carrier indicators
        self.mobile_carriers = {
            'orange', 'sfr', 'bouygues', 'free', 'verizon', 'at&t', 't-mobile',
            'vodafone', 'o2', 'ee', 'three', 'sprint', 'rogers', 'bell',
            'telus', 'koodo', 'fido', 'virgin', 'wind', 'mobilicity'
        }
        
        # VoIP service indicators
        self.voip_indicators = {
            'google', 'skype', 'vonage', 'magic', 'bandwidth', 'twilio',
            'nexmo', 'plivo', 'telnyx', 'signalwire'
        }
    
    async def verify_phone(self, phone: str, country_hint: str = None) -> PhoneVerificationResult:
        """
        Comprehensive phone verification:
        1. Parse and validate format
        2. Determine phone type (mobile/landline/voip)
        3. Get carrier and location info
        4. Validate if number is active (basic check)
        """
        if not phone:
            return PhoneVerificationResult(
                phone="", is_valid=False, is_mobile=False, is_landline=False,
                is_voip=False, country="", carrier_name="", region="",
                timezone="", formatted_national="", formatted_international="",
                score=0, reason="Empty phone number"
            )
        
        # Clean the phone number
        cleaned_phone = self._clean_phone(phone)
        
        try:
            # Parse the phone number
            parsed_number = phonenumbers.parse(cleaned_phone, country_hint)
            
            # Check if valid
            if not phonenumbers.is_valid_number(parsed_number):
                return PhoneVerificationResult(
                    phone=cleaned_phone, is_valid=False, is_mobile=False, 
                    is_landline=False, is_voip=False, country="", carrier_name="",
                    region="", timezone="", formatted_national="", 
                    formatted_international="", score=0, reason="Invalid number format"
                )
            
            # Get basic info
            country = phonenumbers.region_code_for_number(parsed_number)
            region = geocoder.description_for_number(parsed_number, "en")
            carrier_name = carrier.name_for_number(parsed_number, "en")
            timezones = timezone.time_zones_for_number(parsed_number)
            timezone_str = timezones[0] if timezones else ""
            
            # Format the number
            formatted_national = phonenumbers.format_number(
                parsed_number, phonenumbers.PhoneNumberFormat.NATIONAL
            )
            formatted_international = phonenumbers.format_number(
                parsed_number, phonenumbers.PhoneNumberFormat.INTERNATIONAL
            )
            
            # Determine phone type
            number_type = phonenumbers.number_type(parsed_number)
            is_mobile, is_landline, is_voip = self._classify_phone_type(
                number_type, carrier_name
            )
            
            # Calculate score
            score = self._calculate_phone_score(
                is_mobile, is_landline, is_voip, carrier_name, country
            )
            
            # Additional validation for active status (simplified)
            is_likely_active = await self._check_number_activity(parsed_number, carrier_name)
            if not is_likely_active:
                score -= 20
            
            return PhoneVerificationResult(
                phone=cleaned_phone, is_valid=True, is_mobile=is_mobile,
                is_landline=is_landline, is_voip=is_voip, country=country,
                carrier_name=carrier_name, region=region, timezone=timezone_str,
                formatted_national=formatted_national, 
                formatted_international=formatted_international,
                score=score, reason="Verification complete"
            )
            
        except NumberParseException as e:
            return PhoneVerificationResult(
                phone=cleaned_phone, is_valid=False, is_mobile=False,
                is_landline=False, is_voip=False, country="", carrier_name="",
                region="", timezone="", formatted_national="",
                formatted_international="", score=0, 
                reason=f"Parse error: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Phone verification error for {phone}: {str(e)}")
            return PhoneVerificationResult(
                phone=cleaned_phone, is_valid=False, is_mobile=False,
                is_landline=False, is_voip=False, country="", carrier_name="",
                region="", timezone="", formatted_national="",
                formatted_international="", score=0,
                reason=f"Verification failed: {str(e)}"
            )
    
    def _clean_phone(self, phone: str) -> str:
        """Clean and normalize phone number"""
        # Remove common formatting
        cleaned = re.sub(r'[^\d+]', '', phone.strip())
        
        # Add + if missing and looks international
        if len(cleaned) > 10 and not cleaned.startswith('+'):
            cleaned = '+' + cleaned
        
        return cleaned
    
    def _classify_phone_type(self, number_type: int, carrier_name: str) -> Tuple[bool, bool, bool]:
        """Classify phone as mobile, landline, or VoIP"""
        is_mobile = False
        is_landline = False
        is_voip = False
        
        # Check based on phonenumbers library classification
        if number_type == phonenumbers.PhoneNumberType.MOBILE:
            is_mobile = True
        elif number_type == phonenumbers.PhoneNumberType.FIXED_LINE:
            is_landline = True
        elif number_type == phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE:
            # Need to check carrier to determine
            if carrier_name and any(mobile in carrier_name.lower() for mobile in self.mobile_carriers):
                is_mobile = True
            else:
                is_landline = True
        elif number_type == phonenumbers.PhoneNumberType.VOIP:
            is_voip = True
        
        # Additional VoIP detection based on carrier
        if carrier_name and any(voip in carrier_name.lower() for voip in self.voip_indicators):
            is_voip = True
            is_mobile = False
            is_landline = False
        
        return is_mobile, is_landline, is_voip
    
    def _calculate_phone_score(self, is_mobile: bool, is_landline: bool, 
                              is_voip: bool, carrier_name: str, country: str) -> float:
        """Calculate phone quality score 0-100"""
        score = 50  # Base score for valid number
        
        # Type scoring
        if is_mobile:
            score += 30  # Mobile numbers are usually more valuable
        elif is_landline:
            score += 20  # Landlines are good but less flexible
        elif is_voip:
            score += 10  # VoIP numbers are less reliable
        
        # Carrier scoring
        if carrier_name:
            score += 10  # Having carrier info is good
            if any(known in carrier_name.lower() for known in self.mobile_carriers):
                score += 10  # Known carrier is better
        
        # Country scoring (some countries have better phone systems)
        high_quality_countries = {'US', 'CA', 'GB', 'FR', 'DE', 'AU', 'NL', 'SE', 'NO', 'DK'}
        if country in high_quality_countries:
            score += 10
        
        return min(100, max(0, score))
    
    async def _check_number_activity(self, parsed_number, carrier_name: str) -> bool:
        """Basic check for number activity (simplified implementation)"""
        # In a real implementation, this might use HLR lookup services
        # For now, we'll do basic heuristics
        
        # Numbers without carriers are often inactive
        if not carrier_name:
            return False
        
        # VoIP numbers from known providers are usually active
        if any(voip in carrier_name.lower() for voip in self.voip_indicators):
            return True
        
        # Mobile carriers are usually active
        if any(mobile in carrier_name.lower() for mobile in self.mobile_carriers):
            return True
        
        # Default to likely active
        return True

# Global verifier instance
phone_verifier = PhoneVerifier() 