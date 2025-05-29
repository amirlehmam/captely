import React from 'react';
import { Users, Mail, Phone, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { useDashboardStats, useUserProfile } from '../../hooks/useApi';

const EnrichmentStats: React.FC = () => {
  const { profile } = useUserProfile();
  const { stats, loading, error } = useDashboardStats(profile?.id || '');

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100 animate-pulse">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-3 rounded-xl bg-gray-100">
                  <div className="h-5 w-5 bg-gray-200 rounded"></div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <div className="h-4 bg-gray-100 rounded-lg mb-3"></div>
                  <div className="h-8 bg-gray-100 rounded-lg"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <span className="text-red-700">Failed to load stats: {error}</span>
        </div>
      </div>
    );
  }

  if (!stats || !stats.overview) {
    return null;
  }

  const statsData = [
    {
      name: 'Total Contacts',
      value: (stats.overview.total_contacts || 0).toLocaleString(),
      change: '+12.5%', // Could calculate from historical data
      trend: 'up' as const,
      icon: <Users className="h-6 w-6 text-blue-600" />,
      bgColor: 'from-blue-50 to-blue-100',
      borderColor: 'border-blue-200',
      iconBg: 'bg-blue-100',
    },
    {
      name: 'Email Hit Rate',
      value: `${Math.round(stats.overview.success_rate || 0)}%`,
      change: '+3.2%', // Could calculate from historical data
      trend: 'up' as const,
      icon: <Mail className="h-6 w-6 text-green-600" />,
      bgColor: 'from-green-50 to-green-100',
      borderColor: 'border-green-200',
      iconBg: 'bg-green-100',
    },
    {
      name: 'Phone Hit Rate',
      value: `${Math.round(((stats.overview.phones_found || 0) / (stats.overview.total_contacts || 1)) * 100)}%`,
      change: '+5.1%', // Could calculate from historical data
      trend: 'up' as const,
      icon: <Phone className="h-6 w-6 text-purple-600" />,
      bgColor: 'from-purple-50 to-purple-100',
      borderColor: 'border-purple-200',
      iconBg: 'bg-purple-100',
    },
    {
      name: 'Credits Remaining',
      value: (stats.overview.credits_remaining || 0).toLocaleString(),
      change: `-${stats.overview.credits_used || 0}`,
      trend: 'down' as const,
      icon: <Clock className="h-6 w-6 text-orange-600" />,
      bgColor: 'from-orange-50 to-orange-100',
      borderColor: 'border-orange-200',
      iconBg: 'bg-orange-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statsData.map((stat) => (
        <div 
          key={stat.name}
          className={`bg-gradient-to-br ${stat.bgColor} overflow-hidden shadow-lg rounded-xl border ${stat.borderColor} transition-all hover:shadow-xl hover:scale-105 duration-300`}
        >
          <div className="p-6">
            <div className="flex items-center">
              <div className={`flex-shrink-0 p-3 rounded-xl ${stat.iconBg} shadow-sm`}>
                {stat.icon}
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-semibold text-gray-600 uppercase tracking-wide truncate">
                    {stat.name}
                  </dt>
                  <dd>
                    <div className="flex items-baseline mt-2">
                      <div className="text-2xl font-bold text-gray-900">
                        {stat.value}
                      </div>
                      <div className={`ml-3 flex items-center text-sm font-semibold px-2 py-1 rounded-full ${
                        stat.trend === 'up' 
                          ? 'text-green-700 bg-green-100' 
                          : 'text-red-700 bg-red-100'
                      }`}>
                        <TrendingUp className={`self-center flex-shrink-0 h-3 w-3 ${
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