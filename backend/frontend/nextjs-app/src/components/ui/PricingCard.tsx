import React from 'react';
import { motion } from 'framer-motion';
import { Check, Star } from 'lucide-react';

interface PricingCardProps {
  name: string;
  price: number;
  period: 'monthly' | 'yearly';
  credits: number;
  features: string[];
  isPopular?: boolean;
  isCurrent?: boolean;
  onSelect?: () => void;
  loading?: boolean;
}

const PricingCard: React.FC<PricingCardProps> = ({
  name,
  price,
  period,
  credits,
  features,
  isPopular = false,
  isCurrent = false,
  onSelect,
  loading = false
}) => {
  return (
    <motion.div
      className={`
        relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl
        ${isPopular ? 'ring-2 ring-teal-500' : 'border border-gray-200 dark:border-gray-700'}
        overflow-hidden
      `}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      {isPopular && (
        <div className="absolute top-0 right-0">
          <div className="bg-gradient-to-r from-teal-500 to-blue-600 text-white text-sm font-semibold px-4 py-1 rounded-bl-lg flex items-center">
            <Star className="w-4 h-4 mr-1" />
            Most Popular
          </div>
        </div>
      )}

      {isCurrent && (
        <div className="absolute top-0 left-0">
          <div className="bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 text-sm font-semibold px-4 py-1 rounded-br-lg">
            Current Plan
          </div>
        </div>
      )}

      <div className="p-8">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{name}</h3>
        
        <div className="mb-6">
          <span className="text-4xl font-bold text-gray-900 dark:text-white">${price}</span>
          <span className="text-gray-500 dark:text-gray-400 ml-2">/{period}</span>
        </div>

        <div className="mb-6">
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            {credits.toLocaleString()} credits/month
          </p>
        </div>

        <ul className="space-y-3 mb-8">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <Check className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">{feature}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={onSelect}
          disabled={loading || isCurrent}
          className={`
            w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200
            ${isCurrent 
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
              : isPopular
                ? 'bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl'
                : 'bg-gray-800 dark:bg-gray-200 hover:bg-gray-900 dark:hover:bg-gray-100 text-white dark:text-gray-800'
            }
            ${loading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {loading ? 'Processing...' : isCurrent ? 'Current Plan' : 'Select Plan'}
        </button>
      </div>
    </motion.div>
  );
};

export default PricingCard; 