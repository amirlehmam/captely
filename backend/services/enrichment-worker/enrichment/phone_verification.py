"""
Phone verification module with carrier and geographic information
"""
import re
import phonenumbers
from phonenumbers import carrier, geocoder, timezone
from typing import Optional
from dataclasses import dataclass

@dataclass
class PhoneVerificationResult:
    """Result of phone verification"""
    phone: str
    is_valid: bool
    is_mobile: bool
    is_landline: bool
    is_voip: bool
    country: str
    carrier_name: str
    region: str
    formatted_international: str
    formatted_national: str
    score: int  # 0-100
    reason: str


class PhoneVerifier:
    """Advanced phone verification with carrier and location detection"""
    
    def __init__(self):
        # VoIP providers (common ones)
        self.voip_patterns = {
            "skype", "google", "vonage", "magicjack", "ooma", "ringcentral",
            "8x8", "nextiva", "dialpad", "zoom", "webex", "teams"
        }
        
        # Mobile carrier patterns that indicate mobile
        self.mobile_indicators = {
            "mobile", "wireless", "cellular", "cell", "gsm", "cdma", "lte"
        }
    
    async def verify_phone(self, phone: str, country_hint: str = None) -> PhoneVerificationResult:
        """
        Comprehensive phone verification with classification
        """
        phone = phone.strip()
        
        # Clean the phone number
        cleaned_phone = self._clean_phone_number(phone)
        
        try:
            # Parse the phone number
            parsed_number = phonenumbers.parse(cleaned_phone, country_hint)
            
            # Check if the number is valid
            is_valid = phonenumbers.is_valid_number(parsed_number)
            
            if not is_valid:
                return PhoneVerificationResult(
                    phone=phone,
                    is_valid=False,
                    is_mobile=False,
                    is_landline=False,
                    is_voip=False,
                    country="",
                    carrier_name="",
                    region="",
                    formatted_international="",
                    formatted_national="",
                    score=0,
                    reason="Invalid phone number"
                )
            
            # Get country information
            country_code = phonenumbers.region_code_for_number(parsed_number)
            
            # Get carrier information
            carrier_name = carrier.name_for_number(parsed_number, "en")
            
            # Get geographic information
            location = geocoder.description_for_number(parsed_number, "en")
            
            # Get formatted numbers
            international_format = phonenumbers.format_number(
                parsed_number, phonenumbers.PhoneNumberFormat.INTERNATIONAL
            )
            national_format = phonenumbers.format_number(
                parsed_number, phonenumbers.PhoneNumberFormat.NATIONAL
            )
            
            # Determine phone type
            phone_type = phonenumbers.number_type(parsed_number)
            is_mobile, is_landline, is_voip = self._classify_phone_type(phone_type, carrier_name)
            
            # Calculate quality score
            score = self._calculate_phone_score(
                is_valid=is_valid,
                is_mobile=is_mobile,
                has_carrier=bool(carrier_name),
                has_location=bool(location),
                country_code=country_code
            )
            
            return PhoneVerificationResult(
                phone=phone,
                is_valid=is_valid,
                is_mobile=is_mobile,
                is_landline=is_landline,
                is_voip=is_voip,
                country=country_code or "",
                carrier_name=carrier_name or "",
                region=location or "",
                formatted_international=international_format,
                formatted_national=national_format,
                score=score,
                reason="Phone verification completed"
            )
            
        except phonenumbers.phonenumberutil.NumberParseException as e:
            return PhoneVerificationResult(
                phone=phone,
                is_valid=False,
                is_mobile=False,
                is_landline=False,
                is_voip=False,
                country="",
                carrier_name="",
                region="",
                formatted_international="",
                formatted_national="",
                score=0,
                reason=f"Parse error: {e.error_type.name}"
            )
        except Exception as e:
            return PhoneVerificationResult(
                phone=phone,
                is_valid=False,
                is_mobile=False,
                is_landline=False,
                is_voip=False,
                country="",
                carrier_name="",
                region="",
                formatted_international="",
                formatted_national="",
                score=0,
                reason=f"Verification error: {str(e)}"
            )
    
    def _clean_phone_number(self, phone: str) -> str:
        """Clean and normalize phone number"""
        # Remove common separators and formatting
        cleaned = re.sub(r'[^\d+]', '', phone)
        
        # If no international prefix, assume it might need one
        if not cleaned.startswith('+'):
            # Common patterns that indicate international format
            if cleaned.startswith('00'):
                cleaned = '+' + cleaned[2:]
            elif len(cleaned) >= 10:
                # If it looks like a US number, add +1
                if len(cleaned) == 10:
                    cleaned = '+1' + cleaned
                # If it looks like it already has country code
                elif len(cleaned) > 10:
                    cleaned = '+' + cleaned
        
        return cleaned
    
    def _classify_phone_type(self, phone_type, carrier_name: str) -> tuple[bool, bool, bool]:
        """Classify phone as mobile, landline, or VoIP"""
        carrier_lower = (carrier_name or "").lower()
        
        # Check for VoIP indicators
        is_voip = any(voip in carrier_lower for voip in self.voip_patterns)
        if is_voip:
            return False, False, True
        
        # Check phonenumbers library classification
        mobile_types = {
            phonenumbers.PhoneNumberType.MOBILE,
            phonenumbers.PhoneNumberType.PERSONAL_NUMBER,
            phonenumbers.PhoneNumberType.PAGER
        }
        
        landline_types = {
            phonenumbers.PhoneNumberType.FIXED_LINE,
            phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE
        }
        
        voip_types = {
            phonenumbers.PhoneNumberType.VOIP,
        }
        
        if phone_type in mobile_types:
            is_mobile = True
            is_landline = False
        elif phone_type in landline_types:
            # Further check carrier name for mobile indicators
            is_mobile = any(indicator in carrier_lower for indicator in self.mobile_indicators)
            is_landline = not is_mobile
        elif phone_type in voip_types:
            return False, False, True
        else:
            # Unknown type, try to infer from carrier name
            is_mobile = any(indicator in carrier_lower for indicator in self.mobile_indicators)
            is_landline = not is_mobile and not is_voip
        
        return is_mobile, is_landline, False
    
    def _calculate_phone_score(self, is_valid: bool, is_mobile: bool, 
                              has_carrier: bool, has_location: bool, country_code: str) -> int:
        """Calculate phone quality score (0-100)"""
        if not is_valid:
            return 0
        
        score = 50  # Base score for valid number
        
        # Mobile bonus (more valuable for business)
        if is_mobile:
            score += 25
        else:
            score += 15  # Landline still has value
        
        # Carrier information bonus
        if has_carrier:
            score += 15
        
        # Location information bonus
        if has_location:
            score += 10
        
        # Country-specific adjustments
        if country_code:
            # Higher score for common business countries
            high_value_countries = {"US", "CA", "GB", "AU", "DE", "FR", "IT", "ES"}
            if country_code in high_value_countries:
                score += 5
        
        return min(100, score)


# Global instance
phone_verifier = PhoneVerifier() 