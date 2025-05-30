import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, Lock, Eye, EyeOff, ArrowRight, Shield, CheckCircle,
  AlertCircle, Loader2, Fingerprint, Smartphone, Key, Globe,
  Github, Chrome, Apple, Twitter, Zap, Star, Sparkles,
  ShieldCheck, UserCheck, LogIn, HelpCircle, ChevronRight,
  Wifi, WifiOff, Moon, Sun, Languages, Heart
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '../services/api';

// Google reCAPTCHA v3
declare global {
  interface Window {
    grecaptcha: any;
    onRecaptchaLoad: () => void;
  }
}

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'; // Test key

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface SecurityCheck {
  id: string;
  label: string;
  status: 'pending' | 'checking' | 'passed' | 'failed';
  icon: React.ReactNode;
}

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('en');
  const [isOnline, setIsOnline] = useState(true);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showSecurityAnimation, setShowSecurityAnimation] = useState(false);
  const [trustScore, setTrustScore] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState(['', '', '', '', '', '']);
  const twoFactorRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false
  });

  const [errors, setErrors] = useState({
    email: '',
    password: '',
    general: ''
  });

  const [touched, setTouched] = useState({
    email: false,
    password: false
  });

  const [securityChecks, setSecurityChecks] = useState<SecurityCheck[]>([
    { id: 'captcha', label: 'Human verification', status: 'pending', icon: <Shield className="w-4 h-4" /> },
    { id: 'ssl', label: 'Secure connection', status: 'pending', icon: <Lock className="w-4 h-4" /> },
    { id: 'device', label: 'Device fingerprint', status: 'pending', icon: <Fingerprint className="w-4 h-4" /> },
    { id: 'location', label: 'Location verified', status: 'pending', icon: <Globe className="w-4 h-4" /> }
  ]);

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

    // Simulate security checks
    setTimeout(() => runSecurityChecks(), 1000);

    // Animate trust score
    const interval = setInterval(() => {
      setTrustScore(prev => {
        if (prev >= 98) {
          clearInterval(interval);
          return 98;
        }
        return prev + Math.random() * 10;
      });
    }, 200);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(interval);
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  const runSecurityChecks = async () => {
    const checks = [...securityChecks];
    
    for (let i = 0; i < checks.length; i++) {
      checks[i].status = 'checking';
      setSecurityChecks([...checks]);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      checks[i].status = 'passed';
      setSecurityChecks([...checks]);
    }
  };

  const executeRecaptcha = async (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (window.grecaptcha) {
        window.grecaptcha.ready(() => {
          window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'login' })
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

  const validateEmail = (email: string): string => {
    if (!email) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Please enter a valid email';
    return '';
  };

  const validatePassword = (password: string): string => {
    if (!password) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    return '';
  };

  const handleInputChange = (field: keyof LoginFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (typeof value === 'string' && (field === 'email' || field === 'password')) {
      setTouched(prev => ({ ...prev, [field]: true }));
      
      if (field === 'email') {
        setErrors(prev => ({ ...prev, email: validateEmail(value) }));
      } else if (field === 'password') {
        setErrors(prev => ({ ...prev, password: validatePassword(value) }));
      }
    }
  };

  const handleTwoFactorInput = (index: number, value: string) => {
    if (value.length > 1) return;
    
    const newCode = [...twoFactorCode];
    newCode[index] = value;
    setTwoFactorCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      twoFactorRefs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (index === 5 && value) {
      const code = newCode.join('');
      if (code.length === 6) {
        handleTwoFactorSubmit(code);
      }
    }
  };

  const handleTwoFactorKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !twoFactorCode[index] && index > 0) {
      twoFactorRefs.current[index - 1]?.focus();
    }
  };

  const handleTwoFactorSubmit = async (code: string) => {
    setLoading(true);
    try {
      // Simulate 2FA verification
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Two-factor authentication successful!');
      
      // Continue with login
      onLogin();
      navigate('/');
    } catch (error) {
      toast.error('Invalid verification code');
      setTwoFactorCode(['', '', '', '', '', '']);
      twoFactorRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);
    
    if (emailError || passwordError) {
      setErrors({
        email: emailError,
        password: passwordError,
        general: ''
      });
      setTouched({ email: true, password: true });
      return;
    }

    setLoading(true);
    setShowSecurityAnimation(true);

    try {
      // Execute reCAPTCHA
      const token = await executeRecaptcha();
      if (!token) {
        throw new Error('CAPTCHA verification failed');
      }

      // Attempt login
      await apiService.login(formData.email, formData.password);
      
      // Check if 2FA is required (mock check)
      const requires2FA = formData.email.includes('admin') || Math.random() > 0.7;
      
      if (requires2FA) {
        setShowTwoFactor(true);
        toast('Two-factor authentication required', {
          icon: <ShieldCheck className="w-5 h-5 text-blue-500" />
        });
      } else {
        // Success animations
        toast.success('Welcome back! Redirecting...', {
          duration: 3000,
          icon: <Sparkles className="w-5 h-5" />
        });
        
        // Store remember me preference
        if (formData.rememberMe) {
          localStorage.setItem('rememberEmail', formData.email);
        }
        
        onLogin();
        navigate('/');
      }
    } catch (error: any) {
      setErrors(prev => ({
        ...prev,
        general: error.message || 'Invalid email or password'
      }));
      
      // Shake animation
      const button = document.getElementById('login-button');
      button?.classList.add('animate-shake');
      setTimeout(() => button?.classList.remove('animate-shake'), 500);
      
      toast.error('Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
      if (!showTwoFactor) {
        setShowSecurityAnimation(false);
      }
    }
  };

  const handleSocialLogin = async (provider: string) => {
    setLoading(true);
    toast.loading(`Connecting to ${provider}...`);
    
    // Simulate OAuth flow
    setTimeout(() => {
      toast.dismiss();
      toast.error(`${provider} login coming soon!`);
      setLoading(false);
    }, 1500);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
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
        
        {/* Floating particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-blue-500 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            transition={{
              duration: Math.random() * 20 + 10,
              repeat: Infinity,
              repeatType: 'reverse',
            }}
          />
        ))}
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
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Logo and greeting */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-teal-500 to-blue-600 rounded-2xl shadow-2xl mb-4">
              <Zap className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {getGreeting()}!
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Welcome back to Captely
            </p>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Security Status
                  </span>
                </div>
                <span className="text-sm font-bold text-green-600">
                  {Math.round(trustScore)}% Secure
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-green-500 to-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${trustScore}%` }}
                  transition={{ duration: 2, ease: 'easeOut' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {securityChecks.map((check) => (
                  <div key={check.id} className="flex items-center space-x-2">
                    <AnimatePresence mode="wait">
                      {check.status === 'pending' && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <div className="w-4 h-4 rounded-full bg-gray-300" />
                        </motion.div>
                      )}
                      {check.status === 'checking' && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                        </motion.div>
                      )}
                      {check.status === 'passed' && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {check.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Login form card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-8"
          >
            <AnimatePresence mode="wait">
              {!showTwoFactor ? (
                <motion.form
                  key="login-form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSubmit}
                  className="space-y-6"
                >
                  {/* Email field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email address
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
                        placeholder="you@example.com"
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
                    <AnimatePresence>
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
                    </AnimatePresence>
                  </div>

                  {/* Password field */}
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
                    <AnimatePresence>
                      {errors.password && touched.password && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="mt-1 text-sm text-red-600 flex items-center"
                        >
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.password}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Remember me & Forgot password */}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.rememberMe}
                        onChange={(e) => handleInputChange('rememberMe', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Remember me
                      </span>
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  {/* General error */}
                  <AnimatePresence>
                    {errors.general && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                      >
                        <p className="text-sm text-red-600 dark:text-red-400 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-2" />
                          {errors.general}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit button */}
                  <motion.button
                    id="login-button"
                    type="submit"
                    disabled={loading || !isOnline}
                    className={`w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-2 ${
                      loading || !isOnline ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    whileTap={{ scale: 0.98 }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-5 h-5" />
                        <span>Sign in securely</span>
                      </>
                    )}
                  </motion.button>

                  {/* Social login */}
                  <div>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white dark:bg-gray-800 text-gray-500">
                          Or continue with
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 mt-6">
                      {socialProviders.map((provider) => (
                        <motion.button
                          key={provider.id}
                          type="button"
                          onClick={() => handleSocialLogin(provider.name)}
                          className={`flex items-center justify-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg transition-all duration-200 ${provider.color}`}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {provider.icon}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Sign up link */}
                  <div className="text-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Don't have an account?{' '}
                    </span>
                    <Link
                      to="/signup"
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      Sign up for free
                    </Link>
                  </div>
                </motion.form>
              ) : (
                <motion.div
                  key="2fa-form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
                      <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Two-Factor Authentication
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      Enter the 6-digit code from your authenticator app
                    </p>
                  </div>

                  <div className="flex justify-center space-x-2">
                    {twoFactorCode.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => (twoFactorRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleTwoFactorInput(index, e.target.value)}
                        onKeyDown={(e) => handleTwoFactorKeyDown(index, e)}
                        className="w-12 h-12 text-center text-xl font-bold bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowTwoFactor(false)}
                    className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Use a different authentication method
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Security badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 flex items-center justify-center space-x-6"
          >
            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
              <Lock className="w-4 h-4" />
              <span className="text-xs">256-bit SSL</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
              <Shield className="w-4 h-4" />
              <span className="text-xs">GDPR Compliant</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs">SOC 2 Type II</span>
            </div>
          </motion.div>

          {/* Help link */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-center"
          >
            <a
              href="/help"
              className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              <HelpCircle className="w-4 h-4 mr-1" />
              Need help signing in?
            </a>
          </motion.div>
        </motion.div>
      </div>

      {/* Security animation overlay */}
      <AnimatePresence>
        {showSecurityAnimation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center">
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full"
                  />
                  <Shield className="w-8 h-8 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="mt-4 text-gray-700 dark:text-gray-300 font-medium">
                  Securing your connection...
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LoginPage; 