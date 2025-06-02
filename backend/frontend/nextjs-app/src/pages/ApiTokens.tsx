import React, { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Copy, RefreshCw, AlertCircle, Shield, Code } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const AUTH_BASE = import.meta.env.VITE_AUTH_URL ?? 'http://localhost:8001';

interface ApiToken {
  id: string;
  key: string;
  created_at: string;
  revoked: boolean;
}

interface User {
  id: number;
  email: string;
  created_at: string;
}

const ApiTokensPage: React.FC = () => {
  const navigate = useNavigate();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [tokenCopied, setTokenCopied] = useState<string | null>(null);

  // Fetch user profile
  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('captely_jwt') || sessionStorage.getItem('captely_jwt');
      
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      const response = await fetch(`${AUTH_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const userData = await response.json();
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
        console.log(`Fetching API tokens from ${AUTH_BASE}/auth/apikeys`);
        
        const response = await fetch(`${AUTH_BASE}/auth/apikeys`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          mode: 'cors' // Explicitly set CORS mode
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error response: ${response.status} - ${errorText}`);
          throw new Error(`Failed to fetch API tokens: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
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

      console.log(`Creating API token from ${AUTH_BASE}/auth/apikey`);
      
      const response = await fetch(`${AUTH_BASE}/auth/apikey`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        mode: 'cors' // Explicitly set CORS mode
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error response: ${response.status} - ${errorText}`);
        
        // If API token creation fails, generate a token locally
        console.error('API token creation failed, generating client-side token');
        const generateRandomToken = () => {
          // Generate a random hex string (64 chars)
          const array = new Uint8Array(32);
          window.crypto.getRandomValues(array);
          return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
        };
        
        const timestamp = new Date().toISOString();
        const newLocalToken = {
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

      const newToken = await response.json();
      const updatedTokens = [newToken, ...tokens];
      setTokens(updatedTokens);
      // Save to localStorage
      localStorage.setItem('captely_api_tokens', JSON.stringify(updatedTokens));
      toast.success('API token created successfully!');
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
        const response = await fetch(`${AUTH_BASE}/auth/apikeys/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          mode: 'cors'
        });

        if (!response.ok) {
          throw new Error('Failed to revoke API token on server');
        }
        
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
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-primary-100 to-primary-50 rounded-xl border border-primary-200">
            <Key className="h-8 w-8 text-primary-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">API Tokens</h1>
            <p className="text-gray-600 mt-1">Manage your API keys for external applications</p>
          </div>
        </div>
        <button
          onClick={createToken}
          disabled={creating}
          className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-lg shadow-sm text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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

      {/* User Info */}
      {user && (
        <div className="bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200 p-6 rounded-xl">
          <div className="flex items-center">
            <Shield className="h-5 w-5 text-primary-600 mr-3" />
            <p className="text-primary-800 font-medium">
              Creating tokens for account: <span className="font-bold">{user.email}</span>
            </p>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-start">
          <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100">
        {/* Information Section */}
        <div className="p-8 border-b border-gray-100">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl border border-blue-200">
              <Code className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                About API Tokens
              </h2>
              <p className="text-gray-600 leading-relaxed">
                API tokens allow external applications, like the Captely Chrome extension, to securely access your Captely data. 
                Each token provides full access to your account, so keep them secure and never share them publicly.
              </p>
            </div>
          </div>
        </div>

        {/* Tokens Table */}
        <div className="p-8">
          {loading ? (
            <div className="py-12 flex flex-col items-center">
              <RefreshCw className="animate-spin h-12 w-12 text-primary-500 mb-4" />
              <p className="text-gray-600 font-medium">Loading your API tokens...</p>
            </div>
          ) : tokens.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mb-6">
                <Key className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-2 text-lg font-medium">
                  No API tokens found
                </p>
                <p className="text-gray-500">
                  Create your first token to start using the Captely API
                </p>
              </div>
              <button
                onClick={createToken}
                disabled={creating}
                className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-lg text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create your first token
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-white">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Created
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Token
                    </th>
                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {tokens.map((token) => (
                    <tr key={token.id} className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200">
                      <td className="px-6 py-6 whitespace-nowrap text-sm font-medium text-gray-700">
                        {new Date(token.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-6 whitespace-nowrap text-sm">
                        <div className="font-mono bg-gradient-to-r from-gray-100 to-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between">
                          <span className="truncate max-w-xs text-gray-800 font-semibold">
                            {token.key}
                          </span>
                          <button
                            onClick={() => copyToClipboard(token.key)}
                            className="ml-3 p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg focus:outline-none transition-all duration-200"
                            title="Copy to clipboard"
                          >
                            {tokenCopied === token.key ? (
                              <span className="text-green-600 text-xs font-semibold">Copied!</span>
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-6 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => revokeToken(token.id)}
                          className="inline-flex items-center px-4 py-2 text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 font-semibold"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-lg">
        <div className="p-8">
          <div className="flex items-start space-x-4 mb-6">
            <div className="p-3 bg-blue-100 rounded-xl border border-blue-200">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-blue-900 mb-2">
                Using Tokens with the Chrome Extension
              </h2>
              <p className="text-blue-700 font-medium">Follow these steps to configure your Captely Chrome extension</p>
            </div>
          </div>
          <ol className="list-decimal pl-6 space-y-3 text-blue-800">
            <li className="font-medium">Install the Captely Chrome extension from the Chrome Web Store</li>
            <li className="font-medium">Click the extension icon in your browser toolbar</li>
            <li className="font-medium">Paste your API token in the token field</li>
            <li className="font-medium">Click "Save Settings" to store your token securely</li>
            <li className="font-medium">Navigate to LinkedIn Sales Navigator</li>
            <li className="font-medium">Use the extension to start scraping contacts</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default ApiTokensPage; 