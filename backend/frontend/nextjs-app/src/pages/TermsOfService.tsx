import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, Shield, Users, Globe, AlertTriangle, Building2, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';

const TermsOfService: React.FC = () => {
  const { theme } = useTheme();

  const sections = [
    {
      title: "1. Acceptance of Terms",
      icon: <FileText className="h-5 w-5" />,
      content: `By accessing and using Captely's contact enrichment and CRM services, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.

These terms apply to all users, including businesses, organizations, and individuals who access or use our services in any manner.`
    },
    {
      title: "2. Description of Services",
      icon: <Users className="h-5 w-5" />,
      content: `Captely provides B2B contact enrichment services including:

• Email discovery and verification
• Phone number lookup and validation  
• Contact data verification and enhancement
• CRM integration and data synchronization
• API access for developers
• Chrome extension for LinkedIn Sales Navigator

Our services help businesses find and verify professional contact information for legitimate business purposes.`
    },
    {
      title: "3. User Obligations and Compliance",
      icon: <Shield className="h-5 w-5" />,
      content: `You agree to:

• Use our services only for legitimate business purposes
• Comply with all applicable data protection laws (GDPR, CCPA, etc.)
• Not use our services for spam, harassment, or illegal activities
• Obtain proper consent when required for data processing
• Respect opt-out requests and maintain suppression lists
• Not attempt to reverse engineer or abuse our systems
• Provide accurate information during registration
• Maintain the security of your account credentials`
    },
    {
      title: "4. Data Protection and Privacy",
      icon: <Globe className="h-5 w-5" />,
      content: `We take data protection seriously and comply with international privacy laws including GDPR, CCPA, and other applicable regulations.

• You retain ownership of your data
• We process contact information as a data processor on your behalf
• We implement appropriate security measures
• We do not sell personal data to third parties
• We provide data export and deletion capabilities
• Our Privacy Policy details our data handling practices`
    },
    {
      title: "5. Payment Terms and Billing",
      icon: <CreditCard className="h-5 w-5" />,
      content: `Credit Consumption:
• Email enrichment: 1 credit per valid email found
• Phone enrichment: 10 credits per valid phone number found
• No credits charged for unsuccessful lookups

Billing:
• Monthly or annual billing cycles available
• Automatic renewal unless cancelled
• Refunds may be provided at our discretion for unused credits
• All payments processed securely through Stripe
• Prices subject to change with 30 days notice`
    },
    {
      title: "6. Prohibited Uses",
      icon: <AlertTriangle className="h-5 w-5" />,
      content: `You may not use our services to:

• Send unsolicited emails or spam
• Harass, stalk, or intimidate individuals
• Violate any applicable laws or regulations
• Infringe on intellectual property rights
• Attempt unauthorized access to our systems
• Resell or redistribute our data without permission
• Create fake or misleading profiles
• Engage in any form of data scraping abuse
• Use automated systems to overwhelm our infrastructure`
    },
    {
      title: "7. Service Availability and Limitations",
      icon: <Globe className="h-5 w-5" />,
      content: `Service Level:
• We strive for high availability but do not guarantee uninterrupted service
• Planned maintenance will be announced in advance when possible
• Emergency maintenance may occur without notice

Data Accuracy:
• Our data accuracy depends on third-party sources and may vary
• We do not guarantee 100% accuracy of enriched data
• Success rates typically range from 60-90% depending on data quality
• We continuously work to improve data quality and coverage`
    },
    {
      title: "8. Intellectual Property",
      icon: <Building2 className="h-5 w-5" />,
      content: `All content, trademarks, logos, and technology used in our services remain our property or that of our licensors.

• You are granted a limited license to use our services as described
• You may not copy, modify, or distribute our proprietary technology
• Any feedback or suggestions you provide may be used by us
• Captely and related marks are trademarks of Captely SAS
• Third-party data is subject to provider terms and conditions`
    },
    {
      title: "9. Limitation of Liability",
      icon: <AlertTriangle className="h-5 w-5" />,
      content: `Limitation of Damages:
• Our liability is limited to the amount paid by you in the 12 months preceding any claim
• We are not liable for indirect, incidental, or consequential damages
• This includes lost profits, business interruption, or data loss

Service Warranty:
• Our services are provided "as is" without warranties of any kind
• We disclaim all warranties, express or implied
• We do not guarantee specific results or success rates
• Some jurisdictions do not allow limitation of warranties`
    },
    {
      title: "10. Account Termination",
      icon: <Users className="h-5 w-5" />,
      content: `Either party may terminate this agreement with 30 days written notice.

Immediate Termination:
• We may immediately terminate accounts that violate these terms
• Accounts used for illegal activities will be terminated
• Multiple complaints may result in account suspension

Upon Termination:
• You lose access to services but retain ownership of your data
• Data can be exported within 30 days of termination
• Unused credits may be refunded at our discretion
• All outstanding payments become immediately due`
    },
    {
      title: "11. Governing Law and Disputes",
      icon: <Globe className="h-5 w-5" />,
      content: `These terms are governed by the laws of France without regard to conflict of law principles.

Dispute Resolution:
• Disputes will be resolved through binding arbitration in Paris, France
• Arbitration will be conducted under ICC rules
• Class action lawsuits are waived
• Small claims court remains available for qualifying disputes

Severability:
• If any provision is found unenforceable, the remainder of these terms will remain in effect
• Unenforceable provisions will be modified to be enforceable while preserving intent`
    },
    {
      title: "12. Contact Information and Support",
      icon: <Building2 className="h-5 w-5" />,
      content: `For questions about these terms or our services:

Legal Inquiries:
Email: legal@captely.com

Business Address:
Captely SAS
10 Rue de la Paix
75002 Paris, France

Customer Support:
Email: support@captely.com
Response time: Within 24 hours for business inquiries

We are committed to addressing your concerns promptly and professionally.`
    }
  ];

  return (
    <div className={`min-h-screen transition-all duration-300 ${
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      {/* Header */}
      <div className={`border-b transition-all duration-300 ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-4">
            <Link
              to="/signup"
              className={`flex items-center space-x-2 text-sm font-medium transition-colors ${
                theme === 'dark' 
                  ? 'text-gray-400 hover:text-gray-200' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Signup</span>
            </Link>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <div className="flex items-center space-x-3">
              <FileText className={`h-8 w-8 ${
                theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
              }`} />
              <div>
                <h1 className={`text-3xl font-bold ${
                  theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  Terms of Service
                </h1>
                <p className={`mt-2 text-lg ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  Last updated: January 2025
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`rounded-xl p-6 mb-8 border ${
            theme === 'dark' 
              ? 'bg-blue-900/20 border-blue-700/50' 
              : 'bg-blue-50 border-blue-200'
          }`}
        >
          <div className="flex items-start space-x-3">
            <FileText className={`h-6 w-6 mt-1 ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`} />
            <div>
              <h2 className={`text-lg font-semibold mb-2 ${
                theme === 'dark' ? 'text-blue-300' : 'text-blue-900'
              }`}>
                Important Notice
              </h2>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-blue-200' : 'text-blue-800'
              }`}>
                These Terms of Service govern your use of Captely's contact enrichment and CRM services. 
                By using our services, you agree to these terms and our Privacy Policy. Please read them carefully.
              </p>
            </div>
          </div>
        </motion.div>

        <div className="space-y-8">
          {sections.map((section, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              className={`rounded-xl p-6 border transition-all duration-300 ${
                theme === 'dark' 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg ${
                  theme === 'dark' 
                    ? 'bg-emerald-900/30 text-emerald-400' 
                    : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {section.icon}
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-semibold mb-3 ${
                    theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                  }`}>
                    {section.title}
                  </h3>
                  <div className={`text-sm leading-relaxed whitespace-pre-line ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {section.content}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className={`mt-12 p-6 rounded-xl border ${
            theme === 'dark' 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}
        >
          <p className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}>
            These terms may be updated from time to time. We will notify users of material changes 
            via email or through our service. Continued use of our services after changes constitutes 
            acceptance of the updated terms.
          </p>
          <div className="mt-4 flex items-center space-x-4">
            <Link
              to="/privacy-policy"
              className={`text-sm font-medium transition-colors ${
                theme === 'dark' 
                  ? 'text-emerald-400 hover:text-emerald-300' 
                  : 'text-emerald-600 hover:text-emerald-700'
              }`}
            >
              View Privacy Policy
            </Link>
            <span className={`text-sm ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`}>•</span>
            <a
              href="mailto:legal@captely.com"
              className={`text-sm font-medium transition-colors ${
                theme === 'dark' 
                  ? 'text-emerald-400 hover:text-emerald-300' 
                  : 'text-emerald-600 hover:text-emerald-700'
              }`}
            >
              Contact Legal Team
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default TermsOfService; 