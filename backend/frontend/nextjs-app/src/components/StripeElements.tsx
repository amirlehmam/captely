import React, { useState, useEffect } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
  PaymentElement
} from '@stripe/react-stripe-js';
import { CreditCard, Lock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface PaymentMethodSetupProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const PaymentMethodSetupForm: React.FC<PaymentMethodSetupProps> = ({ onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string>('');

  useEffect(() => {
    // Create setup intent when component mounts
    const createSetupIntent = async () => {
      try {
        const response = await apiService.createPaymentMethodSetupIntent();
        setClientSecret(response.client_secret);
      } catch (error) {
        console.error('Error creating setup intent:', error);
        toast.error('Failed to initialize payment setup');
      }
    };

    createSetupIntent();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/billing?setup=success`,
        },
        redirect: 'if_required'
      });

      if (error) {
        toast.error(error.message || 'Payment setup failed');
      } else {
        toast.success('Payment method added successfully!');
        onSuccess();
      }
    } catch (error) {
      console.error('Setup error:', error);
      toast.error('Payment setup failed');
    } finally {
      setLoading(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: theme === 'dark' ? '#ffffff' : '#424770',
        '::placeholder': {
          color: theme === 'dark' ? '#aab7c4' : '#aab7c4',
        },
        backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
      },
      invalid: {
        color: '#9e2146',
      },
    },
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center space-x-3 mb-4">
        <Lock className={`w-5 h-5 ${theme === 'dark' ? 'text-emerald-400' : 'text-teal-600'}`} />
        <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          🔒 Add Payment Method
        </h3>
      </div>

      <div className={`p-4 border rounded-lg ${
        theme === 'dark' 
          ? 'border-gray-600 bg-gray-700' 
          : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="mb-4">
          <label className={`block text-sm font-medium mb-2 ${
            theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
          }`}>
            💳 Card Information
          </label>
          <div className={`p-3 border rounded-md ${
            theme === 'dark' 
              ? 'border-gray-600 bg-gray-800' 
              : 'border-gray-300 bg-white'
          }`}>
            <CardElement options={cardElementOptions} />
          </div>
        </div>

        <div className={`flex items-center space-x-2 text-sm ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
        }`}>
          <Lock className="w-4 h-4" />
          <span>Your payment information is encrypted and secure</span>
        </div>
      </div>

      <div className="flex space-x-4">
        <button
          type="submit"
          disabled={!stripe || !clientSecret || loading}
          className={`flex-1 flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 ${
            theme === 'dark'
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-teal-600 hover:bg-teal-700 text-white'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              💳 Add Payment Method
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            theme === 'dark'
              ? 'bg-gray-600 hover:bg-gray-700 text-white'
              : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
          }`}
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

interface StripePaymentMethodSetupProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const StripePaymentMethodSetup: React.FC<StripePaymentMethodSetupProps> = ({ onSuccess, onCancel }) => {
  const { theme } = useTheme();

  const elementsOptions: StripeElementsOptions = {
    appearance: {
      theme: theme === 'dark' ? 'night' : 'stripe',
      variables: {
        colorPrimary: theme === 'dark' ? '#10b981' : '#0f766e',
        colorBackground: theme === 'dark' ? '#1f2937' : '#ffffff',
        colorText: theme === 'dark' ? '#ffffff' : '#1f2937',
        colorDanger: '#dc2626',
        borderRadius: '8px',
      },
    },
  };

  return (
    <div className={`p-6 rounded-xl border ${
      theme === 'dark' 
        ? 'bg-gray-800 border-gray-700' 
        : 'bg-white border-gray-200'
    }`}>
      <Elements stripe={stripePromise} options={elementsOptions}>
        <PaymentMethodSetupForm onSuccess={onSuccess} onCancel={onCancel} />
      </Elements>
    </div>
  );
};

interface CheckoutSessionProps {
  packageId: string;
  billingCycle: 'monthly' | 'annual';
  onSuccess: () => void;
  onCancel: () => void;
}

const CheckoutSession: React.FC<CheckoutSessionProps> = ({ 
  packageId, 
  billingCycle, 
  onSuccess, 
  onCancel 
}) => {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const response = await apiService.createCheckoutSession(packageId, billingCycle);
      window.location.href = response.checkout_url;
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout process');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Starting checkout...
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5 mr-2" />
            💳 Continue to Checkout
          </>
        )}
      </button>
      <button
        onClick={onCancel}
        className="w-full px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-all duration-200"
      >
        Cancel
      </button>
    </div>
  );
};

export { StripePaymentMethodSetup, CheckoutSession };
export default StripePaymentMethodSetup; 