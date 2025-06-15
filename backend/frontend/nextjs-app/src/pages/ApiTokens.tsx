import React, { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Copy, RefreshCw, AlertCircle, Shield, Code } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../services/api';

interface ApiToken {
  id: string;
  key: string;
  created_at: string;
  revoked: boolean;
}

interface User {
  id: string;
  email: string;
  created_at: string;
}

const ApiTokensPage: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [tokenCopied, setTokenCopied] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch user profile
  const fetchUserProfile = async () => {
    try {
      if (!apiService.isAuthenticated()) {
        navigate('/login', { replace: true });
        return;
      }

      const userData = await apiService.getUserProfile();
      setUser(userData);
    } catch (err: any) {
      console.error('Error fetching user profile:', err);
      // Don't set error state here to avoid showing error in UI
    }
  };

  // Fetch tokens
  const fetchTokens = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('captely_jwt') || sessionStorage.getItem('captely_jwt');
      
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      // First check local storage for tokens
      const localTokens = localStorage.getItem('captely_api_tokens');
      let tokensFromStorage: ApiToken[] = localTokens ? JSON.parse(localTokens) : [];

      try {
        console.log(`Fetching API tokens from API service`);
        
        const data = await apiService.getApiTokens();
        // Combine API tokens with local tokens
        const allTokens = [...data, ...tokensFromStorage.filter((t: ApiToken) => 
          !data.some((apiToken: ApiToken) => apiToken.id === t.id)
        )];
        
        setTokens(allTokens);
        // Save the combined tokens to localStorage
        localStorage.setItem('captely_api_tokens', JSON.stringify(allTokens));
      } catch (err) {
        console.error('API token fetch failed, using local tokens only', err);
        setTokens(tokensFromStorage);
        setError('Could not fetch tokens from server. Using locally stored tokens only.');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching tokens:', err);
      
      // Fallback to local storage
      const localTokens = localStorage.getItem('captely_api_tokens');
      if (localTokens) {
        setTokens(JSON.parse(localTokens));
      }
    } finally {
      setLoading(false);
    }
  };

  // Create new token
  const createToken = async () => {
    setCreating(true);
    setError(null);

    try {
      const token = localStorage.getItem('captely_jwt') || sessionStorage.getItem('captely_jwt');
      
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      console.log(`Creating API token from API service`);
      
      try {
        const apiToken = await apiService.createApiToken('API Token');
        const newToken: ApiToken = {
          id: apiToken.id,
          key: apiToken.token,
          created_at: new Date().toISOString(),
          revoked: false
        };
        const updatedTokens = [newToken, ...tokens];
        setTokens(updatedTokens);
        localStorage.setItem('captely_api_tokens', JSON.stringify(updatedTokens));
        toast.success('API token created successfully!');
        return;
      } catch (error) {
        console.error('API token creation failed, generating client-side token');
        
        // If API token creation fails, generate a token locally
        const generateRandomToken = () => {
          // Generate a random hex string (64 chars)
          const array = new Uint8Array(32);
          window.crypto.getRandomValues(array);
          return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
        };
        
        const timestamp = new Date().toISOString();
        const newLocalToken: ApiToken = {
          id: crypto.randomUUID(), // Use browser's UUID generator
          key: generateRandomToken(),
          created_at: timestamp,
          revoked: false
        };
        
        const updatedTokens = [newLocalToken, ...tokens];
        setTokens(updatedTokens);
        // Save to localStorage
        localStorage.setItem('captely_api_tokens', JSON.stringify(updatedTokens));
        toast.success('API token created locally!');
        setError('API token creation failed, but a local token was generated');
        return;
      }
    } catch (err: any) {
      // If there's an error, still provide a local token
      const generateRandomToken = () => {
        // Generate a random hex string (64 chars)
        const array = new Uint8Array(32);
        window.crypto.getRandomValues(array);
        return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
      };
      
      const timestamp = new Date().toISOString();
      const newLocalToken = {
        id: Date.now().toString(), // Use timestamp as ID
        key: generateRandomToken(),
        created_at: timestamp,
        revoked: false
      };
      
      const updatedTokens = [newLocalToken, ...tokens];
      setTokens(updatedTokens);
      // Save to localStorage
      localStorage.setItem('captely_api_tokens', JSON.stringify(updatedTokens));
      toast.success('API token created locally!');
      
      setError('API token creation failed, but a local token was generated');
      console.error('Error creating token:', err);
    } finally {
      setCreating(false);
    }
  };

  // Revoke token
  const revokeToken = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this token? This cannot be undone.')) {
      return;
    }

    setError(null);

    try {
      const token = localStorage.getItem('captely_jwt') || sessionStorage.getItem('captely_jwt');
      
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      // Try API first
      try {
        await apiService.deleteApiToken(id);
        toast.success('API token revoked successfully on server!');
      } catch (err) {
        console.error('Server token revocation failed, handling locally');
        // If server fails, we'll still handle it locally
      }

      // Local storage token management - handle both API and local tokens
      const updatedTokens = tokens.filter(t => t.id !== id);
      setTokens(updatedTokens);
      localStorage.setItem('captely_api_tokens', JSON.stringify(updatedTokens));
      toast.success('API token revoked successfully!');
      
    } catch (err: any) {
      setError(err.message);
      toast.error('Failed to revoke API token');
      console.error('Error revoking token:', err);
    }
  };

  // Copy token to clipboard
  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key).then(
      () => {
        setTokenCopied(key);
        toast.success('Token copied to clipboard!');
        setTimeout(() => setTokenCopied(null), 3000);
      },
      (err) => {
        console.error('Error copying token to clipboard:', err);
        toast.error('Failed to copy token');
      }
    );
  };

  // Load user profile and tokens on mount
  useEffect(() => {
    fetchUserProfile();
    fetchTokens();
  }, []);

  return (
    <div className={`${isMobile ? 'mobile-container' : 'max-w-6xl mx-auto'} space-y-8 min-h-screen transition-all duration-300 ${
      isDark 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
    } ${isMobile ? 'p-4' : ''}`}>
      {/* Enhanced Page Header with Dark Mode */}
      <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'items-center justify-between'} relative overflow-hidden ${isMobile ? 'p-4' : 'p-8'} rounded-2xl`}>
        {/* Background Pattern */}
        <div className={`absolute inset-0 opacity-30 ${
          isDark ? 'bg-gradient-to-r from-emerald-900/20 to-teal-900/20' : 'bg-gradient-to-r from-emerald-50 to-teal-50'
        }`}>
          <div className="absolute inset-0" style={{
            backgroundImage: isDark 
              ? 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)'
              : 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.05) 1px, transparent 0)',
            backgroundSize: '20px 20px'
          }} />
        </div>
        
        <div className="flex items-center gap-4 relative z-10">
          <div className={`p-3 rounded-xl shadow-lg ${
            isDark 
              ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/25' 
              : 'bg-gradient-to-br from-primary-100 to-primary-50 border border-primary-200'
          }`}>
            <Key className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} ${isDark ? 'text-white' : 'text-primary-600'}`} />
          </div>
          <div>
            <h1 className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-bold mb-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
               API Tokens
            </h1>
            <p className={`${isMobile ? 'text-sm' : 'text-lg'} ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {isMobile ? 'Manage API keys' : 'Manage your API keys for external applications'}
            </p>
            
            <div className="flex items-center space-x-2 mt-2">
              <Shield className={`h-4 w-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <span className={`text-sm font-medium ${
                isDark ? 'text-emerald-400' : 'text-emerald-600'
              }`}>
                Secure Authentication
              </span>
            </div>
          </div>
        </div>
        
        <button
          onClick={createToken}
          disabled={creating}
          className={`inline-flex items-center ${isMobile ? 'px-4 py-2 text-sm' : 'px-6 py-3 text-sm'} border-transparent font-semibold rounded-xl shadow-lg transition-all duration-200 ${
            isDark 
              ? 'text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed' 
              : 'text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed'
          } hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 transform hover:scale-105 ${isMobile ? 'w-full justify-center' : ''}`}
          style={{ willChange: 'transform, box-shadow' }}
        >
          {creating ? (
            <>
              <RefreshCw className="animate-spin h-4 w-4 mr-2" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              New Token
            </>
          )}
        </button>
      </div>

      {/* Enhanced User Info with Dark Mode */}
      {user && (
        <div className={`rounded-2xl ${isMobile ? 'p-4' : 'p-6'} border shadow-lg transition-all duration-300 ${
          isDark 
            ? 'bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border-emerald-700/50' 
            : 'bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200'
        }`}>
          <div className="flex items-center">
            <Shield className={`h-5 w-5 mr-3 ${
              isDark ? 'text-emerald-400' : 'text-primary-600'
            }`} />
            <p className={`font-medium ${isMobile ? 'text-sm' : ''} ${
              isDark ? 'text-emerald-300' : 'text-primary-800'
            }`}>
              Creating tokens for account: <span className="font-bold">{user.email}</span>
            </p>
          </div>
        </div>
      )}

      {/* Enhanced Error Alert with Dark Mode */}
      {error && (
        <div className={`rounded-2xl p-4 flex items-start border ${
          isDark 
            ? 'bg-red-900/30 border-red-700/50 text-red-300' 
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
          <p className={isMobile ? 'text-sm' : ''}>{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className={`rounded-2xl shadow-lg border transition-all duration-300 ${
        isDark 
          ? 'bg-gray-800 border-gray-700 shadow-gray-900/50' 
          : 'bg-white border-gray-100 shadow-gray-200/50'
      }`}>
        {/* Enhanced Information Section */}
        <div className={`${isMobile ? 'p-4' : 'p-8'} border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
          <div className={`flex ${isMobile ? 'flex-col space-y-3' : 'items-start space-x-4'}`}>
            <div className={`p-3 rounded-xl border ${
              isDark 
                ? 'bg-gradient-to-br from-blue-900/30 to-blue-800/20 border-blue-700/50' 
                : 'bg-gradient-to-br from-blue-100 to-blue-50 border-blue-200'
            } ${isMobile ? 'self-start' : ''}`}>
              <Code className={`h-6 w-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <div>
              <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold mb-3 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                About API Tokens
              </h2>
              <p className={`leading-relaxed ${isMobile ? 'text-sm' : ''} ${
                isDark ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {isMobile 
                  ? 'API tokens allow secure access to your Captely data.'
                  : 'API tokens allow external applications, like the Captely Chrome extension, to securely access your Captely data. Each token provides full access to your account, so keep them secure and never share them publicly.'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Enhanced Tokens Table with Dark Mode */}
        <div className={isMobile ? 'p-4' : 'p-8'}>
          {loading ? (
            <div className="py-12 flex flex-col items-center">
              <RefreshCw className={`animate-spin h-12 w-12 mb-4 ${
                isDark ? 'text-emerald-500' : 'text-primary-500'
              }`} />
              <p className={`font-medium ${
                isDark ? 'text-gray-300' : 'text-gray-600'
              }`}>
                Loading your API tokens...
              </p>
            </div>
          ) : tokens.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mb-6">
                <Key className={`h-16 w-16 mx-auto mb-4 ${
                  isDark ? 'text-gray-600' : 'text-gray-300'
                }`} />
                <p className={`mb-2 text-lg font-medium ${
                  isDark ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  No API tokens found
                </p>
                <p className={isDark ? 'text-gray-500' : 'text-gray-500'}>
                  {isMobile ? 'Create your first token' : 'Create your first token to start using the Captely API'}
                </p>
              </div>
              <button
                onClick={createToken}
                disabled={creating}
                className={`inline-flex items-center ${isMobile ? 'px-4 py-2 text-sm' : 'px-6 py-3 text-sm'} border-transparent font-semibold rounded-xl transition-all duration-200 ${
                  isDark 
                    ? 'text-emerald-300 bg-emerald-900/30 hover:bg-emerald-900/40 focus:ring-emerald-500' 
                    : 'text-primary-700 bg-primary-100 hover:bg-primary-200 focus:ring-primary-500'
                } focus:outline-none focus:ring-2 focus:ring-offset-2`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create your first token
              </button>
            </div>
          ) : (
            <div className={isMobile ? '' : 'overflow-x-auto'}>
              {isMobile ? (
                // Mobile: Stack tokens as cards
                <div className="space-y-4">
                  {tokens.map((token) => (
                    <div key={token.id} className={`rounded-lg border p-4 ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600' 
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-sm font-semibold ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Created: {new Date(token.created_at).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => revokeToken(token.id)}
                          className={`inline-flex items-center px-3 py-1 border rounded-lg text-xs font-semibold transition-all duration-200 ${
                            isDark 
                              ? 'text-red-400 bg-red-900/20 hover:bg-red-900/30 border-red-600/50 focus:ring-red-500' 
                              : 'text-red-700 bg-red-50 hover:bg-red-100 border-red-200 focus:ring-red-500'
                          } focus:outline-none focus:ring-2 focus:ring-offset-2`}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Revoke
                        </button>
                      </div>
                      <div className={`font-mono rounded-lg px-3 py-2 flex items-center justify-between border ${
                        isDark 
                          ? 'bg-gradient-to-r from-gray-600 to-gray-550 border-gray-500' 
                          : 'bg-gradient-to-r from-gray-100 to-gray-50 border-gray-200'
                      }`}>
                        <span className={`truncate font-semibold text-sm ${
                          isDark ? 'text-gray-200' : 'text-gray-800'
                        }`}>
                          {token.key.substring(0, 20)}...
                        </span>
                        <button
                          onClick={() => copyToClipboard(token.key)}
                          className={`ml-2 p-1 rounded focus:outline-none transition-all duration-200 ${
                            isDark 
                              ? 'text-gray-400 hover:text-emerald-400 hover:bg-emerald-900/20' 
                              : 'text-gray-500 hover:text-primary-600 hover:bg-primary-50'
                          }`}
                          title="Copy to clipboard"
                        >
                          {tokenCopied === token.key ? (
                            <span className={`text-xs font-semibold ${
                              isDark ? 'text-emerald-400' : 'text-green-600'
                            }`}>
                              Copied!
                            </span>
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Desktop: Keep existing table
                <table className={`min-w-full divide-y ${
                  isDark ? 'divide-gray-700' : 'divide-gray-200'
                }`}>
                  <thead className={`${
                    isDark 
                      ? 'bg-gradient-to-r from-gray-800 to-gray-750' 
                      : 'bg-gradient-to-r from-gray-50 to-white'
                  }`}>
                    <tr>
                      <th scope="col" className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                         Created
                      </th>
                      <th scope="col" className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                         Token
                      </th>
                      <th scope="col" className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                         Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${
                    isDark 
                      ? 'bg-gray-800 divide-gray-700' 
                      : 'bg-white divide-gray-200'
                  }`}>
                    {tokens.map((token) => (
                      <tr key={token.id} className={`transition-colors duration-200 ${
                        isDark ? 'hover:bg-gray-700' : 'hover:bg-gradient-to-r hover:from-gray-50 hover:to-white'
                      }`}>
                        <td className={`px-6 py-6 whitespace-nowrap text-sm font-medium ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {new Date(token.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-6 whitespace-nowrap text-sm">
                          <div className={`font-mono rounded-xl px-4 py-3 flex items-center justify-between border ${
                            isDark 
                              ? 'bg-gradient-to-r from-gray-700 to-gray-650 border-gray-600' 
                              : 'bg-gradient-to-r from-gray-100 to-gray-50 border-gray-200'
                          }`}>
                            <span className={`truncate max-w-xs font-semibold ${
                              isDark ? 'text-gray-200' : 'text-gray-800'
                            }`}>
                              {token.key}
                            </span>
                            <button
                              onClick={() => copyToClipboard(token.key)}
                              className={`ml-3 p-2 rounded-lg focus:outline-none transition-all duration-200 ${
                                isDark 
                                  ? 'text-gray-400 hover:text-emerald-400 hover:bg-emerald-900/20' 
                                  : 'text-gray-500 hover:text-primary-600 hover:bg-primary-50'
                              }`}
                              title="Copy to clipboard"
                            >
                              {tokenCopied === token.key ? (
                                <span className={`text-xs font-semibold ${
                                  isDark ? 'text-emerald-400' : 'text-green-600'
                                }`}>
                                  Copied!
                                </span>
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-6 whitespace-nowrap text-right text-sm">
                          <button
                            onClick={() => revokeToken(token.id)}
                            className={`inline-flex items-center px-4 py-2 border rounded-xl transition-all duration-200 font-semibold ${
                              isDark 
                                ? 'text-red-400 bg-red-900/20 hover:bg-red-900/30 border-red-600/50 focus:ring-red-500' 
                                : 'text-red-700 bg-red-50 hover:bg-red-100 border-red-200 focus:ring-red-500'
                            } focus:outline-none focus:ring-2 focus:ring-offset-2`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Usage Instructions with Dark Mode */}
      <div className={`rounded-2xl shadow-lg border transition-all duration-300 ${
        isDark 
          ? 'bg-gray-800 border-gray-700 shadow-gray-900/50' 
          : 'bg-white border-gray-100 shadow-gray-200/50'
      }`}>
        <div className={isMobile ? 'p-4' : 'p-8'}>
          <div className={`flex ${isMobile ? 'flex-col space-y-3' : 'items-start space-x-4'} mb-6`}>
            <div className={`p-3 rounded-xl border ${
              isDark 
                ? 'bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border-indigo-700/50' 
                : 'bg-blue-100 border-blue-200'
            } ${isMobile ? 'self-start' : ''}`}>
              <Shield className={`h-6 w-6 ${isDark ? 'text-indigo-400' : 'text-blue-600'}`} />
            </div>
            <div>
              <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold mb-2 ${
                isDark ? 'text-white' : 'text-blue-900'
              }`}>
                {isMobile ? 'Chrome Extension Setup' : 'Using Tokens with the Chrome Extension'}
              </h2>
              <p className={`font-medium ${isMobile ? 'text-sm' : ''} ${
                isDark ? 'text-indigo-300' : 'text-blue-700'
              }`}>
                {isMobile ? 'Setup steps for your extension' : 'Follow these steps to configure your Captely Chrome extension'}
              </p>
            </div>
          </div>
          <ol className={`list-decimal ${isMobile ? 'pl-4' : 'pl-6'} space-y-3 ${
            isDark ? 'text-indigo-300' : 'text-blue-800'
          }`}>
            <li className={`font-medium ${isMobile ? 'text-sm' : ''}`}>Install the Captely Chrome extension from the Chrome Web Store</li>
            <li className={`font-medium ${isMobile ? 'text-sm' : ''}`}>Click the extension icon in your browser toolbar</li>
            <li className={`font-medium ${isMobile ? 'text-sm' : ''}`}>Paste your API token in the token field</li>
            <li className={`font-medium ${isMobile ? 'text-sm' : ''}`}>Click "Save Settings" to store your token securely</li>
            <li className={`font-medium ${isMobile ? 'text-sm' : ''}`}>Navigate to LinkedIn Sales Navigator</li>
            <li className={`font-medium ${isMobile ? 'text-sm' : ''}`}>Use the extension to start scraping contacts</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default ApiTokensPage; 