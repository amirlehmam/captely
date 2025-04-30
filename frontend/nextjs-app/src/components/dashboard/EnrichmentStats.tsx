import React from 'react';
import { Users, Mail, Phone, Clock, TrendingUp } from 'lucide-react';

// Mock data
const stats = [
  {
    name: 'Total Contacts',
    value: '15,249',
    change: '+12.5%',
    trend: 'up',
    icon: <Users className="h-5 w-5 text-blue-500" />,
  },
  {
    name: 'Email Hit Rate',
    value: '87%',
    change: '+3.2%',
    trend: 'up',
    icon: <Mail className="h-5 w-5 text-green-500" />,
  },
  {
    name: 'Phone Hit Rate',
    value: '64%',
    change: '+5.1%',
    trend: 'up',
    icon: <Phone className="h-5 w-5 text-purple-500" />,
  },
  {
    name: 'Avg. Enrichment Time',
    value: '1.2s',
    change: '-0.3s',
    trend: 'down',
    icon: <Clock className="h-5 w-5 text-orange-500" />,
  },
];

const EnrichmentStats: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div 
          key={stat.name}
          className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg transition-all hover:shadow-md"
        >
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 rounded-full bg-gray-50 dark:bg-gray-700">
                {stat.icon}
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {stat.name}
                  </dt>
                  <dd>
                    <div className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {stat.value}
                      </div>
                      <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                        stat.trend === 'up' 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        <TrendingUp className={`self-center flex-shrink-0 h-4 w-4 ${
                          stat.trend === 'up' ? '' : 'transform rotate-180'
                        }`} />
                        <span className="ml-1">{stat.change}</span>
                      </div>
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default EnrichmentStats;