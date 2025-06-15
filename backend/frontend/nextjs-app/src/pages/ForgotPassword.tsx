import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, ArrowLeft, Lock, Send, CheckCircle, AlertCircle,
  Loader2, Shield, Key, RefreshCw, HelpCircle, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '../services/api';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

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

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setEmailSent(true);
      setCountdown(60);
      
      // Start countdown
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      toast.success('Password reset email sent!');
    } catch (error: any) {
      setError('Failed to send reset email. Please try again.');
      toast.error('Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    setEmailSent(false);
    setCountdown(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className={`w-full ${isMobile ? 'max-w-sm' : 'max-w-md'}`}
      >
        {/* Back to login link */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${isMobile ? 'mb-6' : 'mb-8'}`}
        >
          <Link
            to="/login"
            className={`inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors ${isMobile ? 'text-sm' : ''}`}
          >
            <ArrowLeft className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'} mr-2`} />
            Back to login
          </Link>
        </motion.div>

        {/* Main card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 ${isMobile ? 'p-6' : 'p-8'}`}
        >
          <div className={`text-center ${isMobile ? 'mb-6' : 'mb-8'}`}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className={`inline-flex items-center justify-center ${isMobile ? 'w-12 h-12' : 'w-16 h-16'} bg-gradient-to-br from-blue-500 to-purple-600 rounded-full ${isMobile ? 'mb-3' : 'mb-4'}`}
            >
              {emailSent ? (
                <CheckCircle className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} text-white`} />
              ) : (
                <Key className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} text-white`} />
              )}
            </motion.div>
            <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 mb-2`}>
              {emailSent ? 'Check your email' : 'Forgot your password?'}
            </h1>
            <p className={`text-gray-600 ${isMobile ? 'text-sm' : ''}`}>
              {emailSent 
                ? `We've sent a password reset link to ${email}`
                : "No worries, we'll send you reset instructions."
              }
            </p>
          </div>

          <AnimatePresence mode="wait">
            {!emailSent ? (
              <motion.form
                key="email-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className={`space-y-${isMobile ? '4' : '6'}`}
              >
                <div>
                  <label className={`block ${isMobile ? 'text-sm' : 'text-sm'} font-medium text-gray-700 mb-2`}>
                    Email address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError('');
                      }}
                      className={`w-full ${isMobile ? 'px-3 py-3 pl-10' : 'px-4 py-3 pl-12'} bg-gray-50 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${
                        error
                          ? 'border-red-300 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
                      placeholder="you@example.com"
                    />
                    <Mail className={`absolute ${isMobile ? 'left-3' : 'left-4'} top-1/2 transform -translate-y-1/2 ${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-gray-400`} />
                  </div>
                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`mt-1 ${isMobile ? 'text-xs' : 'text-sm'} text-red-600 flex items-center`}
                      >
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  className={`w-full ${isMobile ? 'py-3 px-3' : 'py-3 px-4'} bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-2 ${
                    loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  whileTap={{ scale: 0.98 }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className={isMobile ? 'text-sm' : ''}>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      <span className={isMobile ? 'text-sm' : ''}>Send reset email</span>
                    </>
                  )}
                </motion.button>
              </motion.form>
            ) : (
              <motion.div
                key="success-message"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`space-y-${isMobile ? '4' : '6'}`}
              >
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-green-800`}>
                        We've sent a password reset link to your email address. 
                        Please check your inbox and follow the instructions.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600 mb-4`}>
                    Didn't receive the email? Check your spam folder or
                  </p>
                  <button
                    onClick={handleResend}
                    disabled={countdown > 0}
                    className={`inline-flex items-center ${isMobile ? 'px-3 py-2 text-xs' : 'px-4 py-2 text-sm'} border border-gray-300 rounded-lg font-medium transition-all duration-200 ${
                      countdown > 0
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend email'}
                  </button>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={() => navigate('/login')}
                    className={`w-full ${isMobile ? 'py-3 px-3 text-sm' : 'py-3 px-4'} bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-all duration-200`}
                  >
                    Return to login
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!emailSent && (
            <div className={`${isMobile ? 'mt-4' : 'mt-6'} text-center`}>
              <a
                href="/help"
                className={`inline-flex items-center ${isMobile ? 'text-xs' : 'text-sm'} text-gray-600 hover:text-gray-800`}
              >
                <HelpCircle className="w-4 h-4 mr-1" />
                Need help?
              </a>
            </div>
          )}
        </motion.div>

        {/* Security note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={`${isMobile ? 'mt-4' : 'mt-6'} text-center`}
        >
          <div className={`flex items-center justify-center space-x-2 text-gray-500 ${isMobile ? 'text-xs' : 'text-sm'}`}>
            <Shield className="w-4 h-4" />
            <span>Secure password reset</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage; 