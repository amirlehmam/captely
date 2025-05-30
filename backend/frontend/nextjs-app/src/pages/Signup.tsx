import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, Lock, Eye, EyeOff, ArrowRight, Shield, CheckCircle,
  AlertCircle, Loader2, User, Building, Phone, Globe,
  Github, Chrome, Apple, Twitter, Zap, Star, Sparkles,
  ShieldCheck, UserCheck, ChevronRight, ChevronLeft,
  Wifi, WifiOff, Moon, Sun, Languages, Heart, Building2,
  Award, TrendingUp, Users, Check, X, Info, Briefcase
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '../services/api';
import confetti from 'canvas-confetti';

// Google reCAPTCHA v3
declare global {
  interface Window {
    grecaptcha: any;
    onRecaptchaLoad: () => void;
  }
}

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'; // Test key

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
}

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  tips: string[];
}

interface SignupPageProps {
  onLogin: () => void;
}

const SignupPage: React.FC<SignupPageProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('en');
  const [isOnline, setIsOnline] = useState(true);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    score: 0,
    label: 'Very Weak',
    color: 'bg-red-500',
    tips: []
  });
  
  const [formData, setFormData] = useState<SignupFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    company: '',
    phone: '',
    agreeToTerms: false,
    marketingEmails: true
  });

  const [errors, setErrors] = useState<Partial<SignupFormData>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof SignupFormData, boolean>>>({});

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' }
  ];

  const socialProviders = [
    { id: 'google', name: 'Google', icon: <Chrome className="w-5 h-5" />, color: 'hover:bg-red-50 hover:border-red-300' },
    { id: 'github', name: 'GitHub', icon: <Github className="w-5 h-5" />, color: 'hover:bg-gray-100 hover:border-gray-400' },
    { id: 'apple', name: 'Apple', icon: <Apple className="w-5 h-5" />, color: 'hover:bg-gray-900 hover:text-white hover:border-gray-900' },
    { id: 'twitter', name: 'Twitter', icon: <Twitter className="w-5 h-5" />, color: 'hover:bg-blue-50 hover:border-blue-300' }
  ];

  const benefits = [
    { icon: <TrendingUp className="w-6 h-6" />, title: 'Boost Sales', description: 'Increase conversion by 40%' },
    { icon: <Users className="w-6 h-6" />, title: 'Find Leads', description: 'Access millions of contacts' },
    { icon: <Shield className="w-6 h-6" />, title: 'Data Security', description: '256-bit encryption' },
    { icon: <Award className="w-6 h-6" />, title: 'Industry Leader', description: 'Trusted by 10,000+ companies' }
  ];

  const testimonials = [
    { name: 'Sarah Chen', role: 'CEO at TechStart', text: 'Captely transformed our sales process. Amazing results!' },
    { name: 'Mike Johnson', role: 'Sales Director', text: 'The best lead enrichment platform we\'ve ever used.' },
    { name: 'Emma Davis', role: 'Marketing Manager', text: 'Incredible data quality and customer support.' }
  ];

  useEffect(() => {
    // Load reCAPTCHA
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    window.onRecaptchaLoad = () => {
      console.log('reCAPTCHA loaded');
    };

    // Check online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Mouse tracking for parallax effect
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 20 - 10,
        y: (e.clientY / window.innerHeight) * 20 - 10
      });
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Check dark mode preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('mousemove', handleMouseMove);
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  const calculatePasswordStrength = (password: string): PasswordStrength => {
    let score = 0;
    const tips: string[] = [];

    if (password.length >= 8) score++;
    else tips.push('Use at least 8 characters');

    if (password.length >= 12) score++;
    else if (password.length >= 8) tips.push('Use 12+ characters for better security');

    if (/[a-z]/.test(password)) score++;
    else tips.push('Include lowercase letters');

    if (/[A-Z]/.test(password)) score++;
    else tips.push('Include uppercase letters');

    if (/[0-9]/.test(password)) score++;
    else tips.push('Include numbers');

    if (/[^A-Za-z0-9]/.test(password)) score++;
    else tips.push('Include special characters');

    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500', 'bg-emerald-500'];

    return {
      score,
      label: labels[score] || labels[0],
      color: colors[score] || colors[0],
      tips
    };
  };

  const executeRecaptcha = async (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (window.grecaptcha) {
        window.grecaptcha.ready(() => {
          window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'signup' })
            .then((token: string) => {
              setCaptchaToken(token);
              resolve(token);
            })
            .catch(() => resolve(null));
        });
      } else {
        resolve(null);
      }
    });
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<SignupFormData> = {};
    let isValid = true;

    if (step === 1) {
      if (!formData.firstName) {
        newErrors.firstName = 'First name is required';
        isValid = false;
      }
      if (!formData.lastName) {
        newErrors.lastName = 'Last name is required';
        isValid = false;
      }
      if (!formData.email) {
        newErrors.email = 'Email is required';
        isValid = false;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email';
        isValid = false;
      }
    } else if (step === 2) {
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
    } else if (step === 3) {
      if (!formData.company) {
        newErrors.company = 'Company name is required';
        isValid = false;
      }
      if (!formData.agreeToTerms) {
        newErrors.agreeToTerms = 'You must agree to the terms';
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

    // Update password strength
    if (field === 'password' && typeof value === 'string') {
      setPasswordStrength(calculatePasswordStrength(value));
    }
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
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
    if (!validateStep(3)) return;

    setLoading(true);

    try {
      // Execute reCAPTCHA
      const token = await executeRecaptcha();
      if (!token) {
        throw new Error('CAPTCHA verification failed');
      }

      // Attempt signup
      await apiService.signup({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        company: formData.company,
        phone: formData.phone
      });
      
      // Success animations
      triggerConfetti();
      toast.success('Welcome to Captely! 🎉', {
        duration: 5000,
        icon: <Sparkles className="w-5 h-5" />
      });
      
      // Auto login
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

  const handleSocialSignup = async (provider: string) => {
    setLoading(true);
    toast.loading(`Connecting to ${provider}...`);
    
    // Simulate OAuth flow
    setTimeout(() => {
      toast.dismiss();
      toast.error(`${provider} signup coming soon!`);
      setLoading(false);
    }, 1500);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  First Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className={`w-full px-4 py-3 pl-12 bg-gray-50 dark:bg-gray-900 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
                      errors.firstName && touched.firstName
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Last Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
                      errors.lastName && touched.lastName
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                    }`}
                    placeholder="Doe"
                  />
                </div>
                {errors.lastName && touched.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`w-full px-4 py-3 pl-12 bg-gray-50 dark:bg-gray-900 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
                    errors.email && touched.email
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                  }`}
                  placeholder="john@example.com"
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
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={`w-full px-4 py-3 pl-12 pr-12 bg-gray-50 dark:bg-gray-900 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
                    errors.password && touched.password
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
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

              {/* Password strength indicator */}
              {formData.password && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Password Strength</span>
                    <span className={`text-sm font-medium ${
                      passwordStrength.score >= 5 ? 'text-green-600' :
                      passwordStrength.score >= 3 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className={`h-full ${passwordStrength.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(passwordStrength.score / 6) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  {passwordStrength.tips.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {passwordStrength.tips.map((tip, index) => (
                        <li key={index} className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                          <X className="w-3 h-3 mr-1 text-red-500" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className={`w-full px-4 py-3 pl-12 pr-12 bg-gray-50 dark:bg-gray-900 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
                    errors.confirmPassword && touched.confirmPassword
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
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
                {formData.confirmPassword && touched.confirmPassword && !errors.confirmPassword && formData.password === formData.confirmPassword && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute right-12 top-1/2 transform -translate-y-1/2"
                  >
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </motion.div>
                )}
              </div>
              {errors.confirmPassword && touched.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Company Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                  className={`w-full px-4 py-3 pl-12 bg-gray-50 dark:bg-gray-900 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
                    errors.company && touched.company
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                  }`}
                  placeholder="Acme Inc."
                />
                <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
              {errors.company && touched.company && (
                <p className="mt-1 text-sm text-red-600">{errors.company}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Phone Number (Optional)
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full px-4 py-3 pl-12 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                  placeholder="+1 (555) 123-4567"
                />
                <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={formData.agreeToTerms}
                  onChange={(e) => handleInputChange('agreeToTerms', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  I agree to the{' '}
                  <a href="/terms" className="text-blue-600 hover:text-blue-700">Terms of Service</a>
                  {' '}and{' '}
                  <a href="/privacy" className="text-blue-600 hover:text-blue-700">Privacy Policy</a>
                </span>
              </label>
              {errors.agreeToTerms && touched.agreeToTerms && (
                <p className="ml-6 text-sm text-red-600">{errors.agreeToTerms}</p>
              )}

              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={formData.marketingEmails}
                  onChange={(e) => handleInputChange('marketingEmails', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Send me tips, product updates and special offers
                </span>
              </label>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className={`min-h-screen relative overflow-hidden transition-colors duration-500 ${
      darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'
    }`}>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full blur-3xl opacity-20"
          animate={{
            x: mousePosition.x * 2,
            y: mousePosition.y * 2,
          }}
          transition={{ type: 'spring', stiffness: 50 }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-teal-400 to-blue-600 rounded-full blur-3xl opacity-20"
          animate={{
            x: -mousePosition.x * 2,
            y: -mousePosition.y * 2,
          }}
          transition={{ type: 'spring', stiffness: 50 }}
        />
      </div>

      {/* Header controls */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-4 right-4 flex items-center space-x-4 z-10"
      >
        {/* Language selector */}
        <div className="relative group">
          <button className="p-2 rounded-lg bg-white/80 backdrop-blur-sm border border-gray-200 hover:bg-white transition-all duration-200">
            <Languages className="w-5 h-5 text-gray-700" />
          </button>
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
            {languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 ${
                  language === lang.code ? 'bg-blue-50 text-blue-600' : ''
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dark mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-lg bg-white/80 backdrop-blur-sm border border-gray-200 hover:bg-white transition-all duration-200"
        >
          {darkMode ? <Sun className="w-5 h-5 text-gray-700" /> : <Moon className="w-5 h-5 text-gray-700" />}
        </button>

        {/* Connection status */}
        <div className={`px-3 py-2 rounded-lg flex items-center space-x-2 ${
          isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          <span className="text-sm font-medium">{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </motion.div>

      {/* Main content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-6xl flex gap-8">
          {/* Left side - Benefits */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="hidden lg:flex lg:w-1/2 flex-col justify-center p-8"
          >
            <div className="mb-8">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Join 10,000+ companies using Captely
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400">
                Transform your sales process with AI-powered lead enrichment
              </p>
            </div>

            {/* Benefits grid */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-xl p-4 shadow-lg"
                >
                  <div className="text-blue-600 mb-2">{benefit.icon}</div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{benefit.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{benefit.description}</p>
                </motion.div>
              ))}
            </div>

            {/* Testimonials carousel */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-xl p-6 shadow-lg">
              <div className="flex items-center mb-4">
                <div className="flex -space-x-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full border-2 border-white" />
                  ))}
                </div>
                <div className="ml-4 flex">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
              </div>
              <motion.div
                key={Math.floor(Date.now() / 5000)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2"
              >
                <p className="text-gray-700 dark:text-gray-300 italic">
                  "{testimonials[Math.floor(Date.now() / 5000) % testimonials.length].text}"
                </p>
                <div className="text-sm">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {testimonials[Math.floor(Date.now() / 5000) % testimonials.length].name}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    {testimonials[Math.floor(Date.now() / 5000) % testimonials.length].role}
                  </p>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Right side - Signup form */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full lg:w-1/2 flex items-center justify-center"
          >
            <div className="w-full max-w-md">
              {/* Logo */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-8"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-teal-500 to-blue-600 rounded-2xl shadow-2xl mb-4">
                  <Zap className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Create your account
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Start your 14-day free trial
                </p>
              </motion.div>

              {/* Progress steps */}
              <div className="flex items-center justify-center mb-8">
                {[1, 2, 3].map((step) => (
                  <React.Fragment key={step}>
                    <motion.div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 ${
                        currentStep >= step
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                      }`}
                      animate={{
                        scale: currentStep === step ? 1.1 : 1,
                      }}
                    >
                      {currentStep > step ? <Check className="w-5 h-5" /> : step}
                    </motion.div>
                    {step < 3 && (
                      <div className={`w-16 h-1 mx-2 rounded transition-all duration-300 ${
                        currentStep > step ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'bg-gray-200 dark:bg-gray-700'
                      }`} />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Form card */}
              <motion.div
                layout
                className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-8"
              >
                <AnimatePresence mode="wait">
                  {renderStep()}
                </AnimatePresence>

                {/* Navigation buttons */}
                <div className="flex items-center justify-between mt-6">
                  {currentStep > 1 && (
                    <motion.button
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      type="button"
                      onClick={handlePrevStep}
                      className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      <ChevronLeft className="w-5 h-5 mr-1" />
                      Back
                    </motion.button>
                  )}
                  
                  <motion.button
                    type="button"
                    onClick={currentStep === 3 ? handleSubmit : handleNextStep}
                    disabled={loading || !isOnline}
                    className={`${currentStep === 1 ? 'w-full' : 'ml-auto'} py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-2 ${
                      loading || !isOnline ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    whileTap={{ scale: 0.98 }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Creating account...</span>
                      </>
                    ) : currentStep === 3 ? (
                      <>
                        <span>Complete signup</span>
                        <CheckCircle className="w-5 h-5" />
                      </>
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>
                </div>

                {/* Social signup - only on step 1 */}
                {currentStep === 1 && (
                  <div className="mt-6">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white dark:bg-gray-800 text-gray-500">
                          Or sign up with
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 mt-6">
                      {socialProviders.map((provider) => (
                        <motion.button
                          key={provider.id}
                          type="button"
                          onClick={() => handleSocialSignup(provider.name)}
                          className={`flex items-center justify-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg transition-all duration-200 ${provider.color}`}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {provider.icon}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Login link */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-6 text-center"
              >
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Already have an account?{' '}
                </span>
                <Link
                  to="/login"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Sign in
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage; 