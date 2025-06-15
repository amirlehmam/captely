import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle,
  AlertCircle, Loader2, LogIn, ChevronRight, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import DarkModeToggle from '../components/common/DarkModeToggle';
import Logo from '../components/common/Logo';

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface LoginPageProps {
  onLogin: () => void;
}

// Declare global types for OAuth
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

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
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

  // Auto-focus email on mount
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailInputRef.current?.focus();
    
    // Load remembered email
    const rememberedEmail = localStorage.getItem('rememberEmail');
    if (rememberedEmail) {
      setFormData(prev => ({ ...prev, email: rememberedEmail, rememberMe: true }));
    }
  }, []);

  // Mouse movement effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Google OAuth setup
  useEffect(() => {
    // Load Google OAuth script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log('🟢 Google OAuth script loaded');
      if (window.google) {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        console.log('🔑 Google Client ID:', clientId ? 'Found' : 'Missing');
        
        if (!clientId) {
          console.error('❌ VITE_GOOGLE_CLIENT_ID is not set');
          return;
        }
        
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleResponse,
            auto_select: false,
          });
          console.log('✅ Google OAuth initialized successfully');
        } catch (error) {
          console.error('❌ Error initializing Google OAuth:', error);
        }
      } else {
        console.error('❌ Google accounts object not found');
      }
    };

    script.onerror = () => {
      console.error('❌ Failed to load Google OAuth script');
    };

    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  const triggerGoogleSignIn = () => {
    console.log('🚀 Triggering Google Sign In...');
    
    if (!window.google) {
      console.error('❌ Google not loaded');
      toast.error('Google authentication is not available. Please try again.');
      return;
    }
    
    if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
      console.error('❌ Google Client ID not configured');
      toast.error('Google authentication is not properly configured.');
      return;
    }
    
    try {
      window.google.accounts.id.prompt((notification: any) => {
        console.log('🔔 Google prompt notification:', notification);
        if (notification.isNotDisplayed()) {
          console.log('🚫 Google prompt not displayed, trying renderButton approach...');
          // Fallback: create a temporary button and click it
          const tempDiv = document.createElement('div');
          tempDiv.style.position = 'absolute';
          tempDiv.style.top = '-9999px';
          document.body.appendChild(tempDiv);
          
          window.google.accounts.id.renderButton(tempDiv, {
            theme: 'outline',
            size: 'large',
            width: 250
          });
          
          // Find and click the button
          setTimeout(() => {
            const button = tempDiv.querySelector('div[role="button"]') as HTMLElement;
            if (button) {
              button.click();
            }
            document.body.removeChild(tempDiv);
          }, 100);
        }
      });
    } catch (error) {
      console.error('❌ Error triggering Google sign in:', error);
      toast.error('Failed to start Google authentication. Please try again.');
    }
  };

  const handleGoogleResponse = async (response: any) => {
    try {
      setLoading(true);
      
      // Send the Google JWT token to your backend
      const result = await apiService.oauthSignup('google', {
        credential: response.credential
      });
      
      toast.success(t('auth.login.loginSuccess'));
      onLogin();
      
      // Small delay to ensure credit context refreshes before navigation
      setTimeout(() => {
        navigate('/');
      }, 100);
    } catch (error: any) {
      setErrors(prev => ({
        ...prev,
        general: error.message || t('auth.login.invalidCredentials')
      }));
      toast.error(t('auth.login.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      
      if (!window.AppleID) {
        throw new Error('Apple ID not loaded');
      }
      
      const response = await window.AppleID.auth.signIn({
        clientId: import.meta.env.VITE_APPLE_CLIENT_ID,
        redirectURI: window.location.origin + '/auth/apple/callback',
        scope: 'name email',
        state: 'login',
        usePopup: true,
      });

      // Send response to your backend
      const result = await apiService.oauthSignup('apple', {
        authorization: response.authorization,
        user: response.user
      });

      toast.success(t('auth.login.loginSuccess'));
      onLogin();
      
      // Small delay to ensure credit context refreshes before navigation
      setTimeout(() => {
        navigate('/');
      }, 100);
    } catch (error: any) {
      setErrors(prev => ({
        ...prev,
        general: error.message || t('auth.login.invalidCredentials')
      }));
      toast.error(t('auth.login.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (email: string): string => {
    if (!email) return t('auth.login.emailRequired');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return t('errors.validation');
    return '';
  };

  const validatePassword = (password: string): string => {
    if (!password) return t('auth.login.passwordRequired');
    if (password.length < 8) return t('errors.validation');
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

    try {
      // Attempt login
      await apiService.login(formData.email, formData.password);
      
      // Success
      toast.success(t('auth.login.loginSuccess'), {
        duration: 2000
      });
      
      // Store remember me preference
      if (formData.rememberMe) {
        localStorage.setItem('rememberEmail', formData.email);
      }
      
      onLogin();
      
      // Small delay to ensure credit context refreshes before navigation
      setTimeout(() => {
        navigate('/');
      }, 100);
    } catch (error: any) {
      setErrors(prev => ({
        ...prev,
        general: error.message || t('auth.login.invalidCredentials')
      }));
      
      toast.error(t('auth.login.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('common.goodMorning');
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-slate-900 relative overflow-hidden">
      {/* Language & Theme Switchers */}
      <div className="absolute top-6 right-6 z-20 flex items-center space-x-3">
        <DarkModeToggle size="sm" />
        <LanguageSwitcher />
      </div>

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Interactive cursor effect */}
      <div 
        className="fixed w-6 h-6 rounded-full bg-blue-400 opacity-30 pointer-events-none z-50 transition-all duration-100 ease-out"
        style={{
          left: mousePosition.x - 12,
          top: mousePosition.y - 12,
          background: `radial-gradient(circle, rgba(59, 130, 246, 0.6) 0%, rgba(59, 130, 246, 0) 70%)`
        }}
      />

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          {/* Logo and greeting */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center mb-6"
          >
            <Logo 
              size="auth" 
              variant="minimal" 
              animated={true}
              showText={false}
              className="mb-4"
              />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {getGreeting()}!
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              {t('auth.login.subtitle')}
            </p>
          </motion.div>

          {/* Login form card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* OAuth Buttons */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={triggerGoogleSignIn}
                  disabled={loading}
                  className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50"
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
                  onClick={handleAppleSignIn}
                  disabled={loading}
                  className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-black dark:bg-gray-900 text-sm font-medium text-white hover:bg-gray-800 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 disabled:opacity-50"
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
                  <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">Or sign in with email</span>
                </div>
              </div>

              {/* Email field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('auth.login.emailLabel')}
                </label>
                <div className="relative">
                  <input
                    ref={emailInputRef}
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={`w-full px-4 py-3 pl-12 bg-gray-50 dark:bg-gray-700 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 ${
                      errors.email && touched.email
                        ? 'border-red-300 dark:border-red-600 focus:ring-red-500 focus:bg-red-50 dark:focus:bg-red-900/20'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-600 focus:border-blue-500 dark:focus:border-blue-400'
                    }`}
                    placeholder="you@example.com"
                  />
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
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
                      className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center"
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
                  {t('auth.login.passwordLabel')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className={`w-full px-4 py-3 pl-12 pr-12 bg-gray-50 dark:bg-gray-700 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 ${
                      errors.password && touched.password
                        ? 'border-red-300 dark:border-red-600 focus:ring-red-500 focus:bg-red-50 dark:focus:bg-red-900/20'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-600 focus:border-blue-500 dark:focus:border-blue-400'
                    }`}
                    placeholder="••••••••"
                  />
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
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
                      className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center"
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
                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {t('auth.login.rememberMe')}
                  </span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                >
                  {t('auth.login.forgotPassword')}
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
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-4 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center space-x-2 ${
                  loading ? 'opacity-75 cursor-not-allowed' : ''
                }`}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t('common.loading')}</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    <span>{t('auth.login.signInButton')}</span>
                  </>
                )}
              </motion.button>

              {/* Sign up link */}
              <div className="text-center pt-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('auth.login.noAccount')}{' '}
                <Link
                  to="/signup"
                    className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                    {t('auth.login.createAccount')}
                </Link>
                </p>
              </div>
            </form>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage; 