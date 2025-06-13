import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Phone, Zap, CheckCircle, AlertCircle, Sparkles, ArrowRight, Edit3 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

export type EnrichmentType = {
  email: boolean;
  phone: boolean;
};

interface EnrichmentConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (enrichmentType: EnrichmentType, customFilename?: string) => void;
  fileName?: string;
}

const EnrichmentConfirmModal: React.FC<EnrichmentConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  fileName
}) => {
  const { t, formatMessage } = useLanguage();
  const { isDark } = useTheme();
  
  const [selectedEmail, setSelectedEmail] = useState(true);
  const [selectedPhone, setSelectedPhone] = useState(true);
  const [customFilename, setCustomFilename] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Set default filename when modal opens
  useEffect(() => {
    if (isOpen && fileName) {
      // Remove file extension and set as default
      const nameWithoutExtension = fileName.replace(/\.(csv|xlsx|xls)$/i, '');
      setCustomFilename(nameWithoutExtension);
    } else if (isOpen && !fileName) {
      setCustomFilename('imported_contacts');
    }
  }, [isOpen, fileName]);

  // Prevent any background updates when modal is open
  useEffect(() => {
    if (isOpen) {
      // Disable page scrolling
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  // Show celebration when both are selected
  useEffect(() => {
    if (selectedEmail && selectedPhone) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [selectedEmail, selectedPhone]);

  const handleConfirm = async () => {
    setIsConfirming(true);
    
    // Pass the custom filename to the parent
    setTimeout(() => {
      onConfirm({
        email: selectedEmail,
        phone: selectedPhone
      }, customFilename.trim() || fileName);
      setIsConfirming(false);
    }, 800);
  };

  const containerVariants = {
    hidden: { 
      opacity: 0,
      scale: 0.8,
      y: 50,
      rotateX: -15
    },
    visible: { 
      opacity: 1,
      scale: 1,
      y: 0,
      rotateX: 0,
      transition: {
        type: "spring",
        damping: 20,
        stiffness: 300,
        duration: 0.6,
        staggerChildren: 0.1
      }
    },
    exit: { 
      opacity: 0,
      scale: 0.9,
      y: -20,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 300,
        duration: 0.4
      }
    }
  };

  const childVariants = {
    hidden: { 
      opacity: 0, 
      y: 20,
      scale: 0.95
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        damping: 20,
        stiffness: 300
      }
    }
  };

  const optionVariants = {
    unselected: { 
      scale: 1,
      borderColor: "rgba(156, 163, 175, 0.3)",
      backgroundColor: "rgba(249, 250, 251, 0.5)"
    },
    selected: { 
      scale: 1.02,
      borderColor: "rgba(59, 130, 246, 0.8)",
      backgroundColor: "rgba(59, 130, 246, 0.1)",
      boxShadow: "0 0 25px rgba(59, 130, 246, 0.3)"
    },
    hover: {
      scale: 1.01,
      transition: { duration: 0.2 }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999999] flex items-center justify-center p-4"
        style={{ zIndex: 999999 }}
      >
        {/* Ultra-premium backdrop with glassmorphism */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-blue-900/90 to-purple-900/95 backdrop-blur-2xl"
        onClick={onClose}
        />

        {/* Floating particles background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-white/20 rounded-full"
              initial={{ 
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                opacity: 0
              }}
              animate={{ 
                y: [null, -100, -200],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: Math.random() * 3 + 2,
                repeat: Infinity,
                delay: Math.random() * 2
              }}
            />
          ))}
        </div>

        {/* Main modal container */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="relative w-full max-w-md mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Premium card with multiple layers */}
          <div className="relative">
            {/* Outer glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-xl transform scale-110" />
            
            {/* Main card */}
            <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
              {/* Header with premium gradient */}
      <motion.div
                variants={childVariants}
                className="relative px-8 py-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 overflow-hidden"
              >
                {/* Header background pattern */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5" />
                  <div className="absolute top-4 left-8 w-2 h-2 bg-white/30 rounded-full animate-pulse" />
                  <div className="absolute top-12 right-12 w-1 h-1 bg-white/40 rounded-full animate-pulse delay-1000" />
                  <div className="absolute bottom-8 left-16 w-1.5 h-1.5 bg-white/25 rounded-full animate-pulse delay-2000" />
                </div>
                
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ 
                        type: "spring", 
                        damping: 15, 
                        stiffness: 300,
                        delay: 0.2 
                      }}
                      className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center"
                    >
                      <Zap className="w-6 h-6 text-white" />
                    </motion.div>
                <div>
                      <motion.h2 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-xl font-bold text-white tracking-wide"
                      >
                        ⚡ Import CSV & Enrichment
                      </motion.h2>
                      {fileName && (
                        <motion.p 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 }}
                          className="text-white/80 text-sm mt-1 font-medium"
                        >
                          📄 File selected: {fileName}
                        </motion.p>
                      )}
            </div>
          </div>

                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose}
                    className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-all duration-200"
                  >
                    <X className="w-4 h-4 text-white" />
                  </motion.button>
                </div>
              </motion.div>

              {/* Content area */}
              <div className="px-8 py-8">
                <motion.div variants={childVariants}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-6 text-center">
                    Choose your enrichment options:
                  </h3>
                </motion.div>

                {/* Filename Input Section */}
                <motion.div variants={childVariants} className="mb-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    📝 Batch Name
                  </label>
                  <div className="relative">
                    <Edit3 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={customFilename}
                      onChange={(e) => setCustomFilename(e.target.value)}
                      placeholder="Enter batch name..."
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 hover:bg-white"
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    💡 Customize the name to help you track your batches
                  </p>
                </motion.div>

                <div className="space-y-4">
                {/* Email Option */}
                  <motion.div
                    variants={childVariants}
                    whileHover="hover"
                    animate={selectedEmail ? "selected" : "unselected"}
                    variants={optionVariants}
                    onClick={() => setSelectedEmail(!selectedEmail)}
                    className="relative p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 group"
                  >
                    <div className="flex items-center space-x-4">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5, type: "spring", damping: 15 }}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                          selectedEmail 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg shadow-green-500/30' 
                            : 'bg-gray-100 group-hover:bg-gray-200'
                        }`}
                      >
                        {selectedEmail ? (
                          <CheckCircle className="w-6 h-6 text-white" />
                        ) : (
                          <Mail className="w-6 h-6 text-gray-500" />
                        )}
                      </motion.div>
                      <div className="flex-1">
                        <h4 className={`font-semibold transition-colors ${
                          selectedEmail ? 'text-green-700' : 'text-gray-700'
                        }`}>
                          📧 Email
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                          Find and verify email addresses
                        </p>
                      </div>
                    </div>
                    
                    {selectedEmail && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute top-2 right-2"
                      >
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                      </motion.div>
                    )}
                  </motion.div>

                  {/* Phone Option */}
                  <motion.div
                    variants={childVariants}
                    whileHover="hover"
                    animate={selectedPhone ? "selected" : "unselected"}
                    variants={optionVariants}
                    onClick={() => setSelectedPhone(!selectedPhone)}
                    className="relative p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 group"
                  >
                    <div className="flex items-center space-x-4">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.6, type: "spring", damping: 15 }}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                          selectedPhone 
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/30' 
                            : 'bg-gray-100 group-hover:bg-gray-200'
                        }`}
                      >
                        {selectedPhone ? (
                          <CheckCircle className="w-6 h-6 text-white" />
                        ) : (
                          <Phone className="w-6 h-6 text-gray-500" />
                        )}
                      </motion.div>
                      <div className="flex-1">
                        <h4 className={`font-semibold transition-colors ${
                          selectedPhone ? 'text-blue-700' : 'text-gray-700'
                        }`}>
                          📱 Phone
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                          Find and verify phone numbers
                      </p>
                    </div>
                  </div>
                    
                    {selectedPhone && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute top-2 right-2"
                      >
                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                      </motion.div>
                    )}
                  </motion.div>

                  {/* Both selected celebration */}
                  <AnimatePresence>
                    {selectedEmail && selectedPhone && (
                      <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.8 }}
                        className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-200"
                      >
                        <div className="flex items-center space-x-3">
                          <motion.div
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                          >
                            <Sparkles className="w-6 h-6 text-purple-600" />
                          </motion.div>
                    <div>
                            <p className="text-sm font-semibold text-purple-800">
                              🎉 Both - Complete enrichment enabled - Maximum enrichment!
                      </p>
                    </div>
                  </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Action buttons */}
                <motion.div 
                  variants={childVariants}
                  className="flex space-x-3 mt-8"
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="flex-1 px-6 py-3 text-gray-700 font-semibold rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all duration-200"
                  >
                    Cancel
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleConfirm}
                    disabled={(!selectedEmail && !selectedPhone) || isConfirming}
                    className={`flex-1 px-6 py-3 font-semibold rounded-2xl transition-all duration-300 ${
                      (!selectedEmail && !selectedPhone) || isConfirming
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-purple-700'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      {isConfirming ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                        />
                      ) : (
                        <>
                          <span>Start Enrichment</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </div>
                  </motion.button>
                </motion.div>

            {/* Warning if nothing selected */}
                <AnimatePresence>
                  {!selectedEmail && !selectedPhone && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl"
                    >
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <p className="text-sm text-amber-700">
                          Please select at least one enrichment option
                        </p>
                </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EnrichmentConfirmModal; 