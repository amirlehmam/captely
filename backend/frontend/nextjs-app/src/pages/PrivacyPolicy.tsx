import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  const { theme } = useTheme();

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

  return (
    <div className={`min-h-screen transition-all duration-300 ${
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      <div className={`${isMobile ? 'mobile-container' : 'max-w-4xl mx-auto'} ${isMobile ? 'px-4 py-6' : 'px-4 py-8'}`}>
        <div className={`flex items-center space-x-4 ${isMobile ? 'mb-6' : 'mb-8'}`}>
          <Link
            to="/signup"
            className={`flex items-center space-x-2 ${isMobile ? 'text-xs' : 'text-sm'} font-medium transition-colors ${
              theme === 'dark' 
                ? 'text-gray-400 hover:text-gray-200' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <ArrowLeft className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
            <span>Back to Signup</span>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl ${isMobile ? 'p-6' : 'p-8'} border ${
            theme === 'dark' 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}
        >
          <div className={`flex items-center space-x-3 ${isMobile ? 'mb-4' : 'mb-6'}`}>
            <Shield className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} ${
              theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
            }`} />
            <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold ${
              theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
            }`}>
              Privacy Policy
            </h1>
          </div>

          <div className={`prose ${isMobile ? 'prose-sm' : 'max-w-none'} ${
            theme === 'dark' ? 'prose-invert' : ''
          }`}>
            <p className={`${isMobile ? 'text-base' : 'text-lg'} text-gray-600 dark:text-gray-300 ${isMobile ? 'mb-6' : 'mb-8'}`}>
              Last updated: January 2025
            </p>

            <h2 className={isMobile ? 'text-lg' : ''}>1. Information We Collect</h2>
            <p className={isMobile ? 'text-sm' : ''}>
              Captely collects information necessary to provide our contact enrichment services:
            </p>
            <ul className={isMobile ? 'text-sm' : ''}>
              <li><strong>Account Information:</strong> Name, email address, company information, payment details</li>
              <li><strong>Contact Data:</strong> Names, email addresses, phone numbers, company information you upload for enrichment</li>
              <li><strong>Usage Data:</strong> How you interact with our services, API calls, search queries</li>
              <li><strong>Technical Data:</strong> IP addresses, browser information, device identifiers</li>
            </ul>

            <h2 className={isMobile ? 'text-lg' : ''}>2. How We Use Your Information</h2>
            <p className={isMobile ? 'text-sm' : ''}>We use your information to:</p>
            <ul className={isMobile ? 'text-sm' : ''}>
              <li>Provide contact enrichment and verification services</li>
              <li>Process payments and manage your account</li>
              <li>Improve our services and develop new features</li>
              <li>Communicate with you about your account and our services</li>
              <li>Comply with legal obligations and prevent fraud</li>
            </ul>

            <h2 className={isMobile ? 'text-lg' : ''}>3. Data Sharing and Third Parties</h2>
            <p className={isMobile ? 'text-sm' : ''}>
              We work with trusted partners to provide our services. We may share data with:
            </p>
            <ul className={isMobile ? 'text-sm' : ''}>
              <li><strong>Data Providers:</strong> To enrich contact information (Apollo, Hunter.io, etc.)</li>
              <li><strong>Payment Processors:</strong> To process billing and payments securely</li>
              <li><strong>Cloud Services:</strong> For hosting and data storage (with appropriate safeguards)</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
            </ul>
            <p className={isMobile ? 'text-sm' : ''}><strong>We do not sell your personal data to third parties.</strong></p>

            <h2 className={isMobile ? 'text-lg' : ''}>4. Data Security</h2>
            <p className={isMobile ? 'text-sm' : ''}>
              We implement industry-standard security measures including:
            </p>
            <ul className={isMobile ? 'text-sm' : ''}>
              <li>Encryption of data in transit and at rest</li>
              <li>Regular security audits and monitoring</li>
              <li>Access controls and employee training</li>
              <li>Secure data centers and infrastructure</li>
            </ul>

            <h2 className={isMobile ? 'text-lg' : ''}>5. Your Rights</h2>
            <p className={isMobile ? 'text-sm' : ''}>Depending on your location, you may have the right to:</p>
            <ul className={isMobile ? 'text-sm' : ''}>
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Correct inaccurate information</li>
              <li><strong>Erasure:</strong> Request deletion of your data</li>
              <li><strong>Portability:</strong> Export your data in a structured format</li>
              <li><strong>Objection:</strong> Object to certain processing activities</li>
            </ul>

            <h2 className={isMobile ? 'text-lg' : ''}>6. Data Retention</h2>
            <p className={isMobile ? 'text-sm' : ''}>
              We retain your data only as long as necessary:
            </p>
            <ul className={isMobile ? 'text-sm' : ''}>
              <li>Account data: Until account deletion plus 30 days</li>
              <li>Contact data: As long as needed for service provision</li>
              <li>Usage logs: Up to 2 years for security and improvement purposes</li>
              <li>Billing records: As required by law (typically 7 years)</li>
            </ul>

            <h2 className={isMobile ? 'text-lg' : ''}>7. International Transfers</h2>
            <p className={isMobile ? 'text-sm' : ''}>
              Your data may be transferred to countries outside your residence. We ensure adequate 
              protection through:
            </p>
            <ul className={isMobile ? 'text-sm' : ''}>
              <li>EU-US Data Privacy Framework compliance</li>
              <li>Standard Contractual Clauses (SCCs)</li>
              <li>Adequacy decisions by relevant authorities</li>
            </ul>

            <h2 className={isMobile ? 'text-lg' : ''}>8. Cookies and Tracking</h2>
            <p className={isMobile ? 'text-sm' : ''}>
              We use cookies and similar technologies for:
            </p>
            <ul className={isMobile ? 'text-sm' : ''}>
              <li>Essential site functionality and security</li>
              <li>Analytics to improve our services</li>
              <li>Marketing and personalization (with consent)</li>
            </ul>
            <p className={isMobile ? 'text-sm' : ''}>You can manage cookie preferences in your browser settings.</p>

            <h2 className={isMobile ? 'text-lg' : ''}>9. Children's Privacy</h2>
            <p className={isMobile ? 'text-sm' : ''}>
              Our services are not intended for children under 16. We do not knowingly collect 
              personal information from children.
            </p>

            <h2 className={isMobile ? 'text-lg' : ''}>10. Changes to This Policy</h2>
            <p className={isMobile ? 'text-sm' : ''}>
              We may update this privacy policy to reflect changes in our practices or for legal reasons. 
              We will notify you of material changes via email or through our service.
            </p>

            <h2 className={isMobile ? 'text-lg' : ''}>11. Contact Us</h2>
            <p className={isMobile ? 'text-sm' : ''}>
              For privacy-related questions or to exercise your rights, contact us at:
            </p>
            <ul className={isMobile ? 'text-sm' : ''}>
              <li><strong>Email:</strong> privacy@captely.com</li>
              <li><strong>Data Protection Officer:</strong> dpo@captely.com</li>
              <li><strong>Address:</strong> Captely SAS, 10 Rue de la Paix, 75002 Paris, France</li>
            </ul>

            <div className={`${isMobile ? 'mt-6' : 'mt-8'} ${isMobile ? 'p-3' : 'p-4'} rounded-lg border ${
              theme === 'dark' 
                ? 'bg-blue-900/20 border-blue-700/50' 
                : 'bg-blue-50 border-blue-200'
            }`}>
              <p className={`${isMobile ? 'text-xs' : 'text-sm'} ${
                theme === 'dark' ? 'text-blue-200' : 'text-blue-800'
              }`}>
                <strong>Your privacy matters to us.</strong> This policy explains how we handle your data 
                transparently and securely. If you have questions, please don't hesitate to contact our 
                privacy team.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PrivacyPolicy; 