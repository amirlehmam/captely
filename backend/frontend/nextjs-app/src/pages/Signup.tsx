import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle,
  AlertCircle, Loader2, User, Building2, Phone, Check, 
  ChevronLeft, Shield, Globe, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '../services/api';

interface SignupFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  company: string;
  phone: string;
  agreeToTerms: boolean;
  marketingEmails: boolean;
  authMethod: 'email' | 'google' | 'apple';
}

interface SignupPageProps {
  onLogin: () => void;
}

// Professional email domains validation
const GENERIC_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'live.com', 'msn.com', 'ymail.com', 'protonmail.com',
  'mail.com', 'gmx.com', 'tutanota.com', 'zoho.com', 'fastmail.com'
];

// Mock confetti for now - will be replaced with real implementation
const confetti = (options?: any) => {
  console.log('Confetti triggered!', options);
};

const SignupPage: React.FC<SignupPageProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  const [formData, setFormData] = useState<SignupFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    company: '',
    phone: '',
    agreeToTerms: false,
    marketingEmails: true,
    authMethod: 'email'
  });

  const [errors, setErrors] = useState<Partial<SignupFormData>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof SignupFormData, boolean>>>({});

  useEffect(() => {
    // Mouse tracking for subtle parallax effect
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 10 - 5,
        y: (e.clientY / window.innerHeight) * 10 - 5
      });
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Load Google OAuth SDK
    const loadGoogleOAuth = () => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleOAuth;
      document.head.appendChild(script);
    };

    loadGoogleOAuth();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const initializeGoogleOAuth = () => {
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '112233445566-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com',
        callback: handleGoogleSignup,
        auto_select: false,
        cancel_on_tap_outside: true
      });
    }
  };

  const validateProfessionalEmail = (email: string): string => {
    if (!email) return 'Professional email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    
    const domain = email.split('@')[1]?.toLowerCase();
    if (GENERIC_EMAIL_DOMAINS.includes(domain)) {
      return 'Please use your professional email address (not Gmail, Yahoo, etc.)';
    }
    
    return '';
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<SignupFormData> = {};
    let isValid = true;

    if (step === 1) {
      // Step 1: Authentication method selection
      if (formData.authMethod === 'email') {
        const emailError = validateProfessionalEmail(formData.email);
        if (emailError) {
          newErrors.email = emailError;
          isValid = false;
        }
      }
    } else if (step === 2) {
      // Step 2: Complete information
      if (!formData.firstName) {
        newErrors.firstName = 'First name is required';
        isValid = false;
      }
      if (!formData.lastName) {
        newErrors.lastName = 'Last name is required';
        isValid = false;
      }
      if (!formData.company) {
        newErrors.company = 'Company name is required';
        isValid = false;
      }
      if (!formData.phone) {
        newErrors.phone = 'Phone number is required';
        isValid = false;
      }
      
      if (formData.authMethod === 'email') {
      if (!formData.password) {
        newErrors.password = 'Password is required';
        isValid = false;
      } else if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
        isValid = false;
      }
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
        isValid = false;
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
        isValid = false;
      }
      }
      
      if (!formData.agreeToTerms) {
        newErrors.agreeToTerms = 'You must agree to the terms' as any;
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleInputChange = (field: keyof SignupFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleAuthMethodSelect = (method: 'email' | 'google' | 'apple') => {
    setFormData(prev => ({ ...prev, authMethod: method }));
    
    if (method === 'google') {
      handleGoogleSignIn();
    } else if (method === 'apple') {
      handleAppleSignIn();
    }
  };

  const handleGoogleSignIn = () => {
    if (window.google) {
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed()) {
          toast.error('Google Sign-In popup was blocked. Please allow popups.');
        }
      });
    } else {
      toast.error('Google Sign-In is not available. Please try again.');
    }
  };

  const handleGoogleSignup = async (response: any) => {
    try {
      setLoading(true);
      
      // Send the Google ID token to backend for verification
      const result = await apiService.oauthSignup('google', {
        credential: response.credential
      });
      
      if (result.needsInfo) {
        // User needs to complete their profile
        setFormData(prev => ({
          ...prev,
          email: result.user.email,
          firstName: result.user.first_name || '',
          lastName: result.user.last_name || '',
          authMethod: 'google'
        }));
        setCurrentStep(2);
        toast.success('Connected with Google! Please complete your profile.');
      } else {
        // User is fully registered
        triggerConfetti();
        toast.success('Welcome to Captely! 🎉');
        onLogin();
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.message || 'Google sign-up failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      if (!window.AppleID) {
        toast.error('Apple Sign-In is not available. Please try again.');
        return;
      }

      setLoading(true);
      
      const response = await window.AppleID.auth.signIn({
        scope: 'name email',
        redirectURI: window.location.origin + '/auth/apple/callback',
        state: 'signup'
      });

      // Send Apple authorization to backend
      const result = await apiService.oauthSignup('apple', {
        authorization: response.authorization,
        user: response.user
      });

      if (result.needsInfo) {
        setFormData(prev => ({
          ...prev,
          email: result.user.email,
          firstName: result.user.first_name || '',
          lastName: result.user.last_name || '',
          authMethod: 'apple'
        }));
        setCurrentStep(2);
        toast.success('Connected with Apple! Please complete your profile.');
      } else {
        triggerConfetti();
        toast.success('Welcome to Captely! 🎉');
        onLogin();
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.message || 'Apple sign-up failed');
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(2);
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(1);
  };

  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const handleSubmit = async () => {
    if (!validateStep(2)) {
      toast.error('Please fill in all required fields and agree to the terms');
      return;
    }

    setLoading(true);

    try {
      if (formData.authMethod === 'email') {
      await apiService.signup({
        email: formData.email,
        password: formData.password,
          first_name: formData.firstName,
          last_name: formData.lastName,
          company: formData.company
        });
      } else {
        // Complete OAuth signup with additional info
        await apiService.completeOAuthSignup({
        firstName: formData.firstName,
        lastName: formData.lastName,
        company: formData.company,
          phone: formData.phone,
          authMethod: formData.authMethod
      });
      }
      
      triggerConfetti();
      toast.success('Welcome to Captely! 🎉', { duration: 3000 });
      onLogin();
      
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Choose your authentication method</h3>
        <p className="text-gray-600 text-sm">Select how you'd like to create your account</p>
      </div>

      {/* OAuth Buttons */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => handleAuthMethodSelect('google')}
          disabled={loading}
          className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50"
          >
          <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <button
          type="button"
          onClick={() => handleAuthMethodSelect('apple')}
          disabled={loading}
          className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-black text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 disabled:opacity-50"
        >
          <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 17 2.94 12.45 4.7 9.39C5.57 7.87 7.13 6.91 8.82 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
          </svg>
          Continue with Apple
        </button>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Or with professional email</span>
        </div>
      </div>

      {/* Professional Email Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Professional Email Address
          </label>
          <div className="relative">
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={`w-full px-4 py-3 pl-12 bg-gray-50 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
                errors.email && touched.email
                  ? 'border-red-300 focus:ring-red-500 focus:bg-red-50'
                  : 'border-gray-300 focus:ring-blue-500 focus:bg-white focus:border-blue-500'
              }`}
              placeholder="john@yourcompany.com"
            />
            <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            {formData.email && touched.email && !errors.email && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2"
              >
                <CheckCircle className="w-5 h-5 text-green-500" />
              </motion.div>
            )}
          </div>
          {errors.email && touched.email && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-1 text-sm text-red-600 flex items-center"
            >
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.email}
            </motion.p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Please use your company email (not Gmail, Yahoo, etc.)
          </p>
        </div>

        <motion.button
          type="button"
          onClick={() => {
            setFormData(prev => ({ ...prev, authMethod: 'email' }));
            handleNextStep();
          }}
          disabled={loading || !formData.email || !!errors.email}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <span>Continue with Email</span>
          <ArrowRight className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Security note */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h5 className="font-medium text-blue-900 mb-1">Secure & Professional</h5>
            <p className="text-sm text-blue-700">
              We require professional email addresses to ensure a business-focused environment. 
              Your data is encrypted and secure.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Complete your profile</h3>
        <p className="text-gray-600 text-sm">Tell us a bit about yourself and your company</p>
      </div>

      {/* Email display (read-only) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
        <div className="flex items-center px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg">
          <Mail className="w-5 h-5 text-gray-400 mr-3" />
          <span className="text-gray-900">{formData.email}</span>
          {formData.authMethod !== 'email' && (
            <span className="ml-auto px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
              {formData.authMethod === 'google' ? 'Google' : 'Apple'} Connected
            </span>
          )}
        </div>
      </div>

      {/* Name fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
            First Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className={`w-full px-4 py-3 pl-12 bg-gray-50 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
                      errors.firstName && touched.firstName
                        ? 'border-red-300 focus:ring-red-500 focus:bg-red-50'
                        : 'border-gray-300 focus:ring-blue-500 focus:bg-white focus:border-blue-500'
                    }`}
                    placeholder="John"
                  />
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
                {errors.firstName && touched.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
            Last Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className={`w-full px-4 py-3 bg-gray-50 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
                      errors.lastName && touched.lastName
                        ? 'border-red-300 focus:ring-red-500 focus:bg-red-50'
                        : 'border-gray-300 focus:ring-blue-500 focus:bg-white focus:border-blue-500'
                    }`}
                    placeholder="Doe"
                  />
                </div>
                {errors.lastName && touched.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                )}
              </div>
            </div>

      {/* Company field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
          Company Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
            type="text"
            value={formData.company}
            onChange={(e) => handleInputChange('company', e.target.value)}
                  className={`w-full px-4 py-3 pl-12 bg-gray-50 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
              errors.company && touched.company
                      ? 'border-red-300 focus:ring-red-500 focus:bg-red-50'
                      : 'border-gray-300 focus:ring-blue-500 focus:bg-white focus:border-blue-500'
                  }`}
            placeholder="Acme Inc."
                />
          <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
        {errors.company && touched.company && (
          <p className="mt-1 text-sm text-red-600">{errors.company}</p>
                )}
              </div>

      {/* Phone field */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Phone Number <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            className={`w-full px-4 py-3 pl-12 bg-gray-50 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
              errors.phone && touched.phone
                ? 'border-red-300 focus:ring-red-500 focus:bg-red-50'
                : 'border-gray-300 focus:ring-blue-500 focus:bg-white focus:border-blue-500'
            }`}
            placeholder="+1 (555) 123-4567"
          />
          <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
        {errors.phone && touched.phone && (
          <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
              )}
            </div>

      {/* Password fields (only for email signup) */}
      {formData.authMethod === 'email' && (
        <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
              Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={`w-full px-4 py-3 pl-12 pr-12 bg-gray-50 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
                    errors.password && touched.password
                      ? 'border-red-300 focus:ring-red-500 focus:bg-red-50'
                      : 'border-gray-300 focus:ring-blue-500 focus:bg-white focus:border-blue-500'
                  }`}
                  placeholder="••••••••"
                />
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && touched.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className={`w-full px-4 py-3 pl-12 pr-12 bg-gray-50 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
                    errors.confirmPassword && touched.confirmPassword
                      ? 'border-red-300 focus:ring-red-500 focus:bg-red-50'
                      : 'border-gray-300 focus:ring-blue-500 focus:bg-white focus:border-blue-500'
                  }`}
                  placeholder="••••••••"
                />
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && touched.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>
              </div>
      )}

      {/* Terms and conditions */}
            <div className="space-y-3">
              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={formData.agreeToTerms}
                  onChange={(e) => handleInputChange('agreeToTerms', e.target.checked)}
                  className={`w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1 ${
                    errors.agreeToTerms && touched.agreeToTerms
                      ? 'border-red-500 ring-2 ring-red-200'
                      : ''
                  }`}
                />
                <span className={`ml-2 text-sm ${
                  errors.agreeToTerms && touched.agreeToTerms
                    ? 'text-red-700'
                    : 'text-gray-700'
                }`}>
                  I agree to the{' '}
            <a href="/terms" target="_blank" className="text-blue-600 hover:text-blue-700">
              Terms of Service
            </a>
                  {' '}and{' '}
            <a href="/privacy" target="_blank" className="text-blue-600 hover:text-blue-700">
              Privacy Policy
            </a>
                </span>
              </label>
              {errors.agreeToTerms && touched.agreeToTerms && (
                <p className="ml-6 text-sm text-red-600 font-medium">{errors.agreeToTerms}</p>
              )}

              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={formData.marketingEmails}
                  onChange={(e) => handleInputChange('marketingEmails', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Send me tips, product updates and special offers
                </span>
              </label>
            </div>
          </motion.div>
        );

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100 rounded-full blur-3xl opacity-30"
          animate={{
            x: mousePosition.x,
            y: mousePosition.y,
          }}
          transition={{ type: 'spring', stiffness: 50 }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-100 rounded-full blur-3xl opacity-30"
          animate={{
            x: -mousePosition.x,
            y: -mousePosition.y,
          }}
          transition={{ type: 'spring', stiffness: 50 }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl shadow-lg mb-6 overflow-hidden bg-white p-2">
              <img 
                src="/logo.png" 
                alt="Captely Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Create your account
            </h1>
            <p className="text-gray-600">
              Start your 14-day free trial
            </p>
          </motion.div>

          {/* Progress steps */}
          <div className="flex items-center justify-center mb-8">
            {[1, 2].map((step) => (
              <React.Fragment key={step}>
                <motion.div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all duration-300 ${
                    currentStep >= step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                  animate={{
                    scale: currentStep === step ? 1.1 : 1,
                  }}
                >
                  {currentStep > step ? <Check className="w-5 h-5" /> : step}
                </motion.div>
                {step < 2 && (
                  <div className={`w-16 h-1 mx-2 rounded transition-all duration-300 ${
                    currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Form card */}
          <motion.div
            layout
            className="bg-white rounded-2xl shadow-xl p-8"
          >
            <AnimatePresence mode="wait">
              {currentStep === 1 ? renderStep1() : renderStep2()}
            </AnimatePresence>

            {/* Navigation buttons */}
            {currentStep === 2 && (
            <div className="flex items-center justify-between mt-6">
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  type="button"
                  onClick={handlePrevStep}
                  className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 mr-1" />
                  Back
                </motion.button>
              
              <motion.button
                type="button"
                  onClick={handleSubmit}
                disabled={loading}
                  className="py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Creating account...</span>
                  </>
                  ) : (
                  <>
                    <span>Complete signup</span>
                    <CheckCircle className="w-5 h-5" />
                  </>
                )}
              </motion.button>
            </div>
            )}
          </motion.div>

          {/* Login link */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 text-center"
          >
            <span className="text-sm text-gray-600">
              Already have an account?{' '}
            </span>
            <Link
              to="/login"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              Sign in
            </Link>
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 text-center text-sm text-gray-500"
          >
            <p>© 2025 Captely. All rights reserved.</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

// Extend Window interface for OAuth SDKs
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (callback?: any) => void;
        };
      };
    };
    AppleID?: {
      auth: {
        signIn: (config: any) => Promise<any>;
      };
    };
  }
}

export default SignupPage; 