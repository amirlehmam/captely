import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Phone, Zap, CheckCircle, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

interface EnrichmentConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (enrichmentType: EnrichmentType) => void;
  fileName?: string;
}

export interface EnrichmentType {
  email: boolean;
  phone: boolean;
}

const EnrichmentConfirmModal: React.FC<EnrichmentConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  fileName
}) => {
  const { t, formatMessage } = useLanguage();
  const { isDark } = useTheme();
  
  const [enrichmentType, setEnrichmentType] = useState<EnrichmentType>({
    email: true,
    phone: true
  });
  const [isHoveredEmail, setIsHoveredEmail] = useState(false);
  const [isHoveredPhone, setIsHoveredPhone] = useState(false);
  const [isSubmitHovered, setIsSubmitHovered] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('🎯 Modal opened with fileName:', fileName);
      setEnrichmentType({
        email: true,
        phone: true
      });
    }
  }, [isOpen, fileName]);

  const handleSubmit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🚀 SUBMIT CLICKED - enrichmentType:', enrichmentType);
    
    if (!enrichmentType.email && !enrichmentType.phone) {
      console.log('❌ No options selected');
      return;
    }
    
    console.log('✅ Calling onConfirm with:', enrichmentType);
    onConfirm(enrichmentType);
  };

  const handleCheckboxChange = (type: 'email' | 'phone') => {
    console.log('📝 CHECKBOX CHANGE - type:', type, 'current value:', enrichmentType[type]);
    
    setEnrichmentType(prev => {
      const newValue = {
        ...prev,
        [type]: !prev[type]
      };
      console.log('📝 New enrichment state:', newValue);
      return newValue;
    });
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('❌ CLOSE CLICKED');
    onClose();
  };

  const hasSelection = enrichmentType.email || enrichmentType.phone;

  // Animation variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { duration: 0.3, ease: "easeOut" }
    },
    exit: { 
      opacity: 0,
      transition: { duration: 0.2, ease: "easeIn" }
    }
  };

  const modalVariants = {
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
        damping: 25,
        stiffness: 300,
        duration: 0.6
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.9, 
      y: 30,
      transition: { duration: 0.2, ease: "easeIn" }
    }
  };

  const contentVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: "spring",
        damping: 20,
        stiffness: 300
      }
    }
  };

  const glowVariants = {
    initial: { scale: 1, opacity: 0.7 },
    animate: { 
      scale: [1, 1.05, 1],
      opacity: [0.7, 1, 0.7],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div 
        className="fixed inset-0 z-[999999] flex items-center justify-center p-4"
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999999
        }}
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={handleClose}
      >
        {/* Animated Backdrop with Blur */}
        <motion.div
          className="absolute inset-0"
          style={{ 
            background: isDark 
              ? 'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.15) 0%, rgba(0, 0, 0, 0.8) 70%)'
              : 'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.1) 0%, rgba(0, 0, 0, 0.6) 70%)',
            backdropFilter: 'blur(8px)',
            zIndex: 999999
          }}
        />

        {/* Floating Particles Effect */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute w-1 h-1 rounded-full ${isDark ? 'bg-blue-400' : 'bg-blue-500'}`}
            style={{
              left: `${20 + i * 15}%`,
              top: `${30 + (i % 3) * 20}%`,
            }}
            animate={{
              y: [-10, 10, -10],
              opacity: [0.3, 1, 0.3],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3
            }}
          />
        ))}

        {/* Main Modal */}
        <motion.div
          className={`relative w-full max-w-lg rounded-3xl shadow-2xl border backdrop-blur-xl ${
            isDark 
              ? 'bg-gray-900/90 border-gray-700/50' 
              : 'bg-white/95 border-gray-200/50'
          }`}
          style={{ 
            zIndex: 1000000,
            boxShadow: isDark 
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
          }}
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div
            variants={contentVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Glowing Header Background */}
            <motion.div
              className="absolute top-0 left-0 right-0 h-24 rounded-t-3xl opacity-20"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              }}
              variants={glowVariants}
              initial="initial"
              animate="animate"
            />

            {/* Header */}
            <motion.div 
              className="relative px-8 py-6"
              variants={itemVariants}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <motion.div 
                    className="relative"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div 
                      className="p-3 rounded-2xl"
                      style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
                      }}
                    >
                      <Zap className="h-6 w-6 text-white" />
                    </div>
                    <motion.div
                      className="absolute inset-0 rounded-2xl"
                      style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        filter: 'blur(8px)',
                        opacity: 0.4
                      }}
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.4, 0.6, 0.4],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  </motion.div>
                  <div className="ml-4">
                    <motion.h3 
                      className={`text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent ${
                        isDark ? 'from-white to-gray-300' : 'from-gray-900 to-gray-600'
                      }`}
                      variants={itemVariants}
                    >
                      <Sparkles className="inline h-5 w-5 mr-2 text-yellow-500" />
                      {t('enrichment.modal.title')}
                    </motion.h3>
                  </div>
                </div>
                <motion.button
                  type="button"
                  onClick={handleClose}
                  className={`p-2 rounded-xl transition-all duration-300 ${
                    isDark 
                      ? 'text-gray-400 hover:text-white hover:bg-gray-800/80' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/80'
                  }`}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  variants={itemVariants}
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>
            </motion.div>

            {/* Content */}
            <div className="px-8 pb-8">
              {fileName && (
                <motion.div 
                  className={`mb-8 p-5 border rounded-2xl backdrop-blur-sm ${
                    isDark 
                      ? 'bg-blue-500/10 border-blue-500/30' 
                      : 'bg-blue-50/80 border-blue-200/60'
                  }`}
                  variants={itemVariants}
                  whileHover={{ scale: 1.02 }}
                  style={{
                    boxShadow: '0 8px 32px rgba(59, 130, 246, 0.1)'
                  }}
                >
                  <div className="flex items-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <CheckCircle className="h-5 w-5 text-blue-500 mr-3" />
                    </motion.div>
                    <span className={`text-sm font-medium ${
                      isDark ? 'text-blue-300' : 'text-blue-900'
                    }`}>
                      {formatMessage('enrichment.modal.fileSelected', { fileName })}
                    </span>
                  </div>
                </motion.div>
              )}

              <motion.div className="mb-8" variants={itemVariants}>
                <h4 className={`text-lg font-semibold mb-6 ${
                  isDark ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  {t('enrichment.modal.chooseEnrichment')}
                </h4>
                
                <div className="space-y-4">
                  {/* Email Option */}
                  <motion.div 
                    className={`cursor-pointer border rounded-2xl p-6 transition-all duration-300 ${
                      enrichmentType.email 
                        ? isDark
                          ? 'border-green-500/50 bg-green-500/10 shadow-lg shadow-green-500/20' 
                          : 'border-green-400/60 bg-green-50/80 shadow-lg shadow-green-400/20'
                        : isDark
                          ? 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600/80 hover:bg-gray-800/50' 
                          : 'border-gray-200/60 bg-white/60 hover:border-gray-300/80 hover:bg-gray-50/80'
                    }`}
                    onClick={() => handleCheckboxChange('email')}
                    onMouseEnter={() => setIsHoveredEmail(true)}
                    onMouseLeave={() => setIsHoveredEmail(false)}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    variants={itemVariants}
                    style={{
                      backdropFilter: 'blur(8px)'
                    }}
                  >
                    <div className="flex items-center">
                      <motion.div 
                        className={`flex-shrink-0 w-6 h-6 rounded-xl mr-4 flex items-center justify-center transition-all duration-300 ${
                          enrichmentType.email 
                            ? 'bg-gradient-to-r from-green-400 to-green-600 shadow-lg shadow-green-400/40' 
                            : isDark 
                              ? 'border-2 border-gray-600' 
                              : 'border-2 border-gray-300'
                        }`}
                        animate={enrichmentType.email ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ duration: 0.3 }}
                      >
                        {enrichmentType.email && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", damping: 15, stiffness: 400 }}
                          >
                            <CheckCircle className="h-4 w-4 text-white" />
                          </motion.div>
                        )}
                      </motion.div>
                      
                      <motion.div
                        animate={isHoveredEmail ? { x: 5 } : { x: 0 }}
                        className="flex items-center flex-1"
                      >
                        <motion.div
                          animate={enrichmentType.email ? { rotate: [0, 10, -10, 0] } : {}}
                          transition={{ duration: 0.5 }}
                        >
                          <Mail className={`h-6 w-6 mr-4 transition-colors duration-300 ${
                            enrichmentType.email 
                              ? 'text-green-500' 
                              : isDark ? 'text-gray-500' : 'text-gray-400'
                          }`} />
                        </motion.div>
                        <div>
                          <span className={`font-semibold text-base transition-colors duration-300 ${
                            enrichmentType.email 
                              ? isDark ? 'text-green-300' : 'text-green-700'
                              : isDark ? 'text-gray-200' : 'text-gray-700'
                          }`}>
                            📧 {t('enrichment.modal.email.label')}
                          </span>
                          <p className={`text-sm mt-1 transition-colors duration-300 ${
                            enrichmentType.email 
                              ? isDark ? 'text-green-400' : 'text-green-600'
                              : isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {t('enrichment.modal.email.description')}
                          </p>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>

                  {/* Phone Option */}
                  <motion.div 
                    className={`cursor-pointer border rounded-2xl p-6 transition-all duration-300 ${
                      enrichmentType.phone 
                        ? isDark
                          ? 'border-blue-500/50 bg-blue-500/10 shadow-lg shadow-blue-500/20' 
                          : 'border-blue-400/60 bg-blue-50/80 shadow-lg shadow-blue-400/20'
                        : isDark
                          ? 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600/80 hover:bg-gray-800/50' 
                          : 'border-gray-200/60 bg-white/60 hover:border-gray-300/80 hover:bg-gray-50/80'
                    }`}
                    onClick={() => handleCheckboxChange('phone')}
                    onMouseEnter={() => setIsHoveredPhone(true)}
                    onMouseLeave={() => setIsHoveredPhone(false)}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    variants={itemVariants}
                    style={{
                      backdropFilter: 'blur(8px)'
                    }}
                  >
                    <div className="flex items-center">
                      <motion.div 
                        className={`flex-shrink-0 w-6 h-6 rounded-xl mr-4 flex items-center justify-center transition-all duration-300 ${
                          enrichmentType.phone 
                            ? 'bg-gradient-to-r from-blue-400 to-blue-600 shadow-lg shadow-blue-400/40' 
                            : isDark 
                              ? 'border-2 border-gray-600' 
                              : 'border-2 border-gray-300'
                        }`}
                        animate={enrichmentType.phone ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ duration: 0.3 }}
                      >
                        {enrichmentType.phone && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", damping: 15, stiffness: 400 }}
                          >
                            <CheckCircle className="h-4 w-4 text-white" />
                          </motion.div>
                        )}
                      </motion.div>
                      
                      <motion.div
                        animate={isHoveredPhone ? { x: 5 } : { x: 0 }}
                        className="flex items-center flex-1"
                      >
                        <motion.div
                          animate={enrichmentType.phone ? { rotate: [0, 10, -10, 0] } : {}}
                          transition={{ duration: 0.5 }}
                        >
                          <Phone className={`h-6 w-6 mr-4 transition-colors duration-300 ${
                            enrichmentType.phone 
                              ? 'text-blue-500' 
                              : isDark ? 'text-gray-500' : 'text-gray-400'
                          }`} />
                        </motion.div>
                        <div>
                          <span className={`font-semibold text-base transition-colors duration-300 ${
                            enrichmentType.phone 
                              ? isDark ? 'text-blue-300' : 'text-blue-700'
                              : isDark ? 'text-gray-200' : 'text-gray-700'
                          }`}>
                            📱 {t('enrichment.modal.phone.label')}
                          </span>
                          <p className={`text-sm mt-1 transition-colors duration-300 ${
                            enrichmentType.phone 
                              ? isDark ? 'text-blue-400' : 'text-blue-600'
                              : isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {t('enrichment.modal.phone.description')}
                          </p>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>

                  {/* Both Selected Celebration */}
                  <AnimatePresence>
                    {enrichmentType.email && enrichmentType.phone && (
                      <motion.div 
                        className={`p-5 border rounded-2xl backdrop-blur-sm ${
                          isDark 
                            ? 'bg-purple-500/10 border-purple-500/30' 
                            : 'bg-purple-50/80 border-purple-200/60'
                        }`}
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -20 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        style={{
                          boxShadow: '0 8px 32px rgba(147, 51, 234, 0.15)'
                        }}
                      >
                        <div className="flex items-center">
                          <motion.div
                            animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <Sparkles className="h-5 w-5 text-purple-500 mr-3" />
                          </motion.div>
                          <span className={`text-sm font-semibold ${
                            isDark ? 'text-purple-300' : 'text-purple-700'
                          }`}>
                            🎉 {t('enrichment.modal.both')} - Maximum enrichment!
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Warning if nothing selected */}
              <AnimatePresence>
                {!hasSelection && (
                  <motion.div 
                    className={`mb-6 p-4 border rounded-2xl backdrop-blur-sm ${
                      isDark 
                        ? 'bg-red-500/10 border-red-500/30' 
                        : 'bg-red-50/80 border-red-200/60'
                    }`}
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                    transition={{ type: "spring", damping: 20, stiffness: 300 }}
                  >
                    <div className="flex items-center">
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                      >
                        <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
                      </motion.div>
                      <span className={`text-sm font-medium ${
                        isDark ? 'text-red-400' : 'text-red-700'
                      }`}>
                        {t('enrichment.modal.selectAtLeastOne')}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <motion.div 
              className={`px-8 py-6 border-t backdrop-blur-sm ${
                isDark ? 'border-gray-700/50 bg-gray-800/20' : 'border-gray-200/50 bg-gray-50/40'
              }`}
              variants={itemVariants}
            >
              <div className="flex justify-end space-x-4">
                <motion.button
                  type="button"
                  onClick={handleClose}
                  className={`px-6 py-3 text-sm font-medium border rounded-xl transition-all duration-300 ${
                    isDark 
                      ? 'text-gray-300 bg-gray-800/60 border-gray-600/50 hover:bg-gray-700/80 hover:border-gray-500/70' 
                      : 'text-gray-700 bg-white/80 border-gray-300/70 hover:bg-gray-50/90 hover:border-gray-400/80'
                  }`}
                  whileHover={{ scale: 1.05, y: -1 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    backdropFilter: 'blur(8px)'
                  }}
                >
                  {t('enrichment.modal.cancel')}
                </motion.button>
                
                <motion.button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!hasSelection}
                  onMouseEnter={() => setIsSubmitHovered(true)}
                  onMouseLeave={() => setIsSubmitHovered(false)}
                  className={`px-8 py-3 text-sm font-semibold rounded-xl transition-all duration-300 relative overflow-hidden ${
                    hasSelection
                      ? 'text-white shadow-lg'
                      : isDark 
                        ? 'text-gray-500 bg-gray-800/40 cursor-not-allowed' 
                        : 'text-gray-400 bg-gray-200/60 cursor-not-allowed'
                  }`}
                  style={{
                    background: hasSelection 
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : undefined,
                    boxShadow: hasSelection 
                      ? '0 10px 30px rgba(102, 126, 234, 0.4)' 
                      : undefined,
                    backdropFilter: 'blur(8px)'
                  }}
                  whileHover={hasSelection ? { scale: 1.05, y: -2 } : {}}
                  whileTap={hasSelection ? { scale: 0.95 } : {}}
                  animate={hasSelection ? {
                    boxShadow: [
                      '0 10px 30px rgba(102, 126, 234, 0.4)',
                      '0 15px 40px rgba(102, 126, 234, 0.6)', 
                      '0 20px 50px rgba(102, 126, 234, 0.8)',
                      '0 15px 40px rgba(102, 126, 234, 0.6)',
                      '0 10px 30px rgba(102, 126, 234, 0.4)'
                    ]
                  } : {}}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  {hasSelection && (
                    <motion.div
                      className="absolute inset-0"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)'
                      }}
                      animate={isSubmitHovered ? { x: ['-100%', '100%'] } : {}}
                      transition={{ duration: 0.6, ease: "easeInOut" }}
                    />
                  )}
                  <span className="relative flex items-center">
                    {t('enrichment.modal.startEnrichment')}
                    <motion.div
                      animate={hasSelection ? { x: [0, 5, 0] } : {}}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="ml-2"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </motion.div>
                  </span>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EnrichmentConfirmModal; 