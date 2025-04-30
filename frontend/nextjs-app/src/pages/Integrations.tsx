import React, { useState } from 'react';
import { 
  CheckCircle, XCircle, ExternalLink, Link as LinkIcon, 
  RefreshCw, PlusCircle, Trash2, ArrowRight
} from 'lucide-react';

// Mock data for integrations
const integrationsMockData = [
  {
    id: 'hubspot',
    name: 'HubSpot',
    icon: '🟠',
    description: 'Push enriched contacts to HubSpot CRM',
    status: 'connected',
    lastSync: '2 hours ago',
    connectedBy: 'john.doe@company.com',
    connectedAt: '2025-04-15',
  },
  {
    id: 'lemlist',
    name: 'Lemlist',
    icon: '🔵',
    description: 'Sync contacts to your Lemlist campaigns',
    status: 'connected',
    lastSync: '1 day ago',
    connectedBy: 'john.doe@company.com',
    connectedAt: '2025-04-10',
  },
  {
    id: 'smartlead',
    name: 'Smartlead',
    icon: '🟢',
    description: 'Push contacts to Smartlead sequences',
    status: 'disconnected',
    lastSync: 'Never',
    connectedBy: '',
    connectedAt: '',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    icon: '⚡',
    description: 'Connect to 5,000+ apps through Zapier',
    status: 'connected',
    lastSync: '3 days ago',
    connectedBy: 'sarah.smith@company.com',
    connectedAt: '2025-03-22',
  },
  {
    id: 'make',
    name: 'Make (Integromat)',
    icon: '🔄',
    description: 'Build complex automated workflows',
    status: 'disconnected',
    lastSync: 'Never',
    connectedBy: '',
    connectedAt: '',
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: '📝',
    description: 'Save contact lists to Notion databases',
    status: 'disconnected',
    lastSync: 'Never',
    connectedBy: '',
    connectedAt: '',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    icon: '☁️',
    description: 'Sync with Salesforce CRM',
    status: 'disconnected',
    lastSync: 'Never',
    connectedBy: '',
    connectedAt: '',
  },
  {
    id: 'webhook',
    name: 'Webhook',
    icon: '🔗',
    description: 'Send data to custom webhook endpoints',
    status: 'connected',
    lastSync: '12 hours ago',
    connectedBy: 'john.doe@company.com',
    connectedAt: '2025-04-01',
  },
];

const IntegrationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [showMapping, setShowMapping] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState('');
  
  const filteredIntegrations = activeTab === 'all' 
    ? integrationsMockData 
    : activeTab === 'connected'
      ? integrationsMockData.filter(int => int.status === 'connected')
      : integrationsMockData.filter(int => int.status === 'disconnected');
  
  const handleConnect = (id: string) => {
    // In a real app, would open OAuth flow or connection modal
    console.log(`Connecting to ${id}`);
  };
  
  const handleDisconnect = (id: string) => {
    // In a real app, would show confirmation and disconnect
    console.log(`Disconnecting from ${id}`);
  };
  
  const handleShowMapping = (id: string) => {
    setSelectedIntegration(id);
    setShowMapping(true);
  };
  
  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Integrations</h1>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('all')}
            className={`${
              activeTab === 'all'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            All Integrations
          </button>
          <button
            onClick={() => setActiveTab('connected')}
            className={`${
              activeTab === 'connected'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Connected
          </button>
          <button
            onClick={() => setActiveTab('disconnected')}
            className={`${
              activeTab === 'disconnected'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Available
          </button>
        </nav>
      </div>
      
      {showMapping ? (
        // Field Mapping UI
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                Field Mapping: {integrationsMockData.find(i => i.id === selectedIntegration)?.name}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                Configure how your contact fields map to the destination fields.
              </p>
            </div>
            <button 
              onClick={() => setShowMapping(false)}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
          
          <div className="px-4 py-5 sm:p-6">
            <div className="space-y-4">
              {/* Mapping rows */}
              <div className="grid grid-cols-5 gap-4 py-2 font-medium text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                <div className="col-span-2">Captely Field</div>
                <div className="col-span-2">Destination Field</div>
                <div className="col-span-1">Required</div>
              </div>
              
              <div className="grid grid-cols-5 gap-4 py-2 items-center border-b border-gray-100 dark:border-gray-700">
                <div className="col-span-2 text-gray-800 dark:text-gray-200">First Name</div>
                <div className="col-span-2">
                  <select className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm">
                    <option value="first_name">First Name</option>
                    <option value="firstname">FirstName</option>
                    <option value="given_name">Given Name</option>
                  </select>
                </div>
                <div className="col-span-1 text-green-500 dark:text-green-400 flex items-center">
                  <CheckCircle className="h-5 w-5" />
                </div>
              </div>
              
              <div className="grid grid-cols-5 gap-4 py-2 items-center border-b border-gray-100 dark:border-gray-700">
                <div className="col-span-2 text-gray-800 dark:text-gray-200">Last Name</div>
                <div className="col-span-2">
                  <select className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm">
                    <option value="last_name">Last Name</option>
                    <option value="lastname">LastName</option>
                    <option value="surname">Surname</option>
                  </select>
                </div>
                <div className="col-span-1 text-green-500 dark:text-green-400 flex items-center">
                  <CheckCircle className="h-5 w-5" />
                </div>
              </div>
              
              <div className="grid grid-cols-5 gap-4 py-2 items-center border-b border-gray-100 dark:border-gray-700">
                <div className="col-span-2 text-gray-800 dark:text-gray-200">Email</div>
                <div className="col-span-2">
                  <select className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm">
                    <option value="email">Email</option>
                    <option value="email_address">Email Address</option>
                    <option value="work_email">Work Email</option>
                  </select>
                </div>
                <div className="col-span-1 text-green-500 dark:text-green-400 flex items-center">
                  <CheckCircle className="h-5 w-5" />
                </div>
              </div>
              
              <div className="grid grid-cols-5 gap-4 py-2 items-center border-b border-gray-100 dark:border-gray-700">
                <div className="col-span-2 text-gray-800 dark:text-gray-200">Phone</div>
                <div className="col-span-2">
                  <select className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm">
                    <option value="phone">Phone</option>
                    <option value="phone_number">Phone Number</option>
                    <option value="work_phone">Work Phone</option>
                  </select>
                </div>
                <div className="col-span-1 text-gray-400 flex items-center">
                  <XCircle className="h-5 w-5" />
                </div>
              </div>
              
              <div className="grid grid-cols-5 gap-4 py-2 items-center border-b border-gray-100 dark:border-gray-700">
                <div className="col-span-2 text-gray-800 dark:text-gray-200">Company</div>
                <div className="col-span-2">
                  <select className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm">
                    <option value="company">Company</option>
                    <option value="company_name">Company Name</option>
                    <option value="organization">Organization</option>
                  </select>
                </div>
                <div className="col-span-1 text-gray-400 flex items-center">
                  <XCircle className="h-5 w-5" />
                </div>
              </div>
              
              <div className="grid grid-cols-5 gap-4 py-2 items-center border-b border-gray-100 dark:border-gray-700">
                <div className="col-span-2 text-gray-800 dark:text-gray-200">Title</div>
                <div className="col-span-2">
                  <select className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm">
                    <option value="title">Title</option>
                    <option value="job_title">Job Title</option>
                    <option value="position">Position</option>
                  </select>
                </div>
                <div className="col-span-1 text-gray-400 flex items-center">
                  <XCircle className="h-5 w-5" />
                </div>
              </div>
              
              <div className="grid grid-cols-5 gap-4 py-2 items-center border-b border-gray-100 dark:border-gray-700">
                <div className="col-span-2 text-gray-800 dark:text-gray-200">LinkedIn URL</div>
                <div className="col-span-2">
                  <select className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm">
                    <option value="linkedin_url">LinkedIn URL</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="linkedin_profile">LinkedIn Profile</option>
                  </select>
                </div>
                <div className="col-span-1 text-gray-400 flex items-center">
                  <XCircle className="h-5 w-5" />
                </div>
              </div>
              
              <div className="grid grid-cols-5 gap-4 py-2 items-center">
                <div className="col-span-2 text-gray-800 dark:text-gray-200">Email Status</div>
                <div className="col-span-2">
                  <select className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm">
                    <option value="email_status">Email Status</option>
                    <option value="email_valid">Email Valid</option>
                    <option value="email_quality">Email Quality</option>
                  </select>
                </div>
                <div className="col-span-1 text-gray-400 flex items-center">
                  <XCircle className="h-5 w-5" />
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowMapping(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
              >
                Save Mapping
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Integrations grid
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredIntegrations.map((integration) => (
            <div
              key={integration.id}
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg flex flex-col"
            >
              <div className="px-4 py-5 sm:p-6 flex-1">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700 text-3xl">
                    {integration.icon}
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {integration.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {integration.description}
                    </p>
                  </div>
                </div>
                
                {integration.status === 'connected' && (
                  <div className="mt-4">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Connected
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Last sync: {integration.lastSync}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Connected by: {integration.connectedBy}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="px-4 py-4 sm:px-6 bg-gray-50 dark:bg-gray-700">
                {integration.status === 'connected' ? (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleShowMapping(integration.id)}
                      className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <LinkIcon className="h-4 w-4 mr-2" />
                      Field Mapping
                    </button>
                    <button
                      onClick={() => handleDisconnect(integration.id)}
                      className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-red-300 dark:border-red-700 shadow-sm text-sm font-medium rounded-md text-red-700 dark:text-red-300 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(integration.id)}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Connect
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* API Documentation */}
      <div className="mt-8 bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            API Integration
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Use our RESTful API to integrate Captely with custom applications.
          </p>
        </div>
        
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h4 className="text-base font-medium text-gray-900 dark:text-white mb-2">
                API Documentation
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Comprehensive documentation for the Captely API, including authentication, endpoints, and example requests.
              </p>
              <a 
                href="#"
                className="inline-flex items-center text-sm font-medium text-teal-600 hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300"
              >
                View API Documentation
                <ExternalLink className="ml-1 h-4 w-4" />
              </a>
            </div>
            
            <div>
              <h4 className="text-base font-medium text-gray-900 dark:text-white mb-2">
                Webhooks
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Configure webhooks to receive real-time notifications when batches are processed or contacts are updated.
              </p>
              <a 
                href="#"
                className="inline-flex items-center text-sm font-medium text-teal-600 hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300"
              >
                Configure Webhooks
                <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </div>
          </div>
          
          <div className="mt-6 bg-gray-50 dark:bg-gray-700 rounded-md p-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Your API Key
            </h4>
            <div className="flex items-center">
              <div className="flex-1 bg-white dark:bg-gray-600 rounded-md px-3 py-2 text-sm font-mono text-gray-700 dark:text-gray-300 truncate">
                sk_live_••••••••••••••••••••••••••••••
              </div>
              <button className="ml-2 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              This key grants full access to your account. Never share it publicly or include it in client-side code.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;