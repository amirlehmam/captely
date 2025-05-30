import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Mail, Phone, Clock, ChevronRight, Search,
  TrendingUp, BarChart3, RefreshCw, Upload, Bell,
  CheckCircle, XCircle, AlertTriangle, Zap, Star,
  Award, Target, Activity, DollarSign, CreditCard,
  Calendar, Filter, Download, Settings, LogOut,
  Sparkles, Heart, Sun, Cloud, CloudRain, Menu,
  X, Globe, Briefcase, FileText, ArrowUp, ArrowDown,
  PieChart, Layers, UserPlus, MessageSquare, Gift,
  Trophy, Flame, Coffee, Smile, ChevronUp, Database,
  ShoppingCart, Package, Rocket, Shield, Eye
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart as RePieChart, Pie, Cell, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ScatterChart, Scatter, ComposedChart
} from 'recharts';
import CountUp from 'react-countup';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// Mock user data
const userData = {
  name: 'Sarah Chen',
  email: 'sarah.chen@techstart.com',
  avatar: null,
  company: 'TechStart Inc.',
  plan: 'Professional',
  role: 'Sales Director'
};

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const staggerChildren = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const scaleIn = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.9, opacity: 0 }
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'New lead enriched', message: '25 new contacts added to your CRM', time: '5m ago', read: false, type: 'success' },
    { id: 2, title: 'Credit alert', message: 'You have used 80% of your monthly credits', time: '1h ago', read: false, type: 'warning' },
    { id: 3, title: 'Export complete', message: 'Your data export is ready for download', time: '2h ago', read: true, type: 'info' },
    { id: 4, title: 'New integration', message: 'Salesforce integration is now active', time: '1d ago', read: true, type: 'success' }
  ]);

  useEffect(() => {
    const token = localStorage.getItem('captely_jwt') || sessionStorage.getItem('captely_jwt');
    if (!token) {
      navigate('/login', { replace: true });
    }

    // Update time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Mouse tracking for parallax effects
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 10 - 5,
        y: (e.clientY / window.innerHeight) * 10 - 5
      });
    };
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      clearInterval(timeInterval);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [navigate]);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 5) return { text: 'Night owl?', emoji: '🦉' };
    if (hour < 12) return { text: 'Good morning', emoji: '☀️' };
    if (hour < 17) return { text: 'Good afternoon', emoji: '👋' };
    if (hour < 21) return { text: 'Good evening', emoji: '🌅' };
    return { text: 'Working late?', emoji: '🌙' };
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    toast.success('Dashboard refreshed!', {
      icon: <RefreshCw className="w-4 h-4" />
    });
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Mock data for charts
  const revenueData = [
    { month: 'Jan', revenue: 45000, leads: 320, conversion: 14.2 },
    { month: 'Feb', revenue: 52000, leads: 380, conversion: 15.8 },
    { month: 'Mar', revenue: 48000, leads: 350, conversion: 13.5 },
    { month: 'Apr', revenue: 61000, leads: 420, conversion: 16.9 },
    { month: 'May', revenue: 55000, leads: 390, conversion: 15.2 },
    { month: 'Jun', revenue: 67000, leads: 460, conversion: 17.8 },
    { month: 'Jul', revenue: 72000, leads: 510, conversion: 18.5 }
  ];

  const pieData = [
    { name: 'Email Found', value: 68, color: '#3B82F6' },
    { name: 'Phone Found', value: 45, color: '#10B981' },
    { name: 'LinkedIn', value: 82, color: '#6366F1' },
    { name: 'Company Data', value: 91, color: '#F59E0B' }
  ];

  const activityData = [
    { time: '00:00', enrichments: 120, api_calls: 450 },
    { time: '04:00', enrichments: 80, api_calls: 320 },
    { time: '08:00', enrichments: 280, api_calls: 890 },
    { time: '12:00', enrichments: 420, api_calls: 1250 },
    { time: '16:00', enrichments: 380, api_calls: 1100 },
    { time: '20:00', enrichments: 250, api_calls: 780 },
    { time: '23:59', enrichments: 150, api_calls: 520 }
  ];

  const teamMembers = [
    { name: 'Alex Thompson', role: 'Sales Rep', leads: 145, avatar: null, status: 'online', performance: '+12%' },
    { name: 'Emma Davis', role: 'SDR', leads: 132, avatar: null, status: 'online', performance: '+8%' },
    { name: 'Mike Johnson', role: 'Sales Rep', leads: 128, avatar: null, status: 'away', performance: '+15%' },
    { name: 'Lisa Wang', role: 'SDR', leads: 119, avatar: null, status: 'offline', performance: '-3%' }
  ];

  const navItems = [
    { icon: <BarChart3 />, label: 'Dashboard', active: true },
    { icon: <Users />, label: 'Contacts', path: '/contacts' },
    { icon: <Upload />, label: 'Import', path: '/import' },
    { icon: <FileText />, label: 'Reports', path: '/reports' },
    { icon: <CreditCard />, label: 'Billing', path: '/billing' },
    { icon: <Settings />, label: 'Settings', path: '/settings' }
  ];

  const recentActivities = [
    { icon: <CheckCircle className="w-5 h-5 text-green-500" />, title: 'Import completed', desc: '2,451 contacts enriched successfully', time: '2 minutes ago' },
    { icon: <UserPlus className="w-5 h-5 text-blue-500" />, title: 'New team member', desc: 'John Smith joined as Sales Rep', time: '15 minutes ago' },
    { icon: <TrendingUp className="w-5 h-5 text-purple-500" />, title: 'Milestone reached', desc: 'You\'ve enriched 10,000 contacts this month!', time: '1 hour ago' },
    { icon: <Mail className="w-5 h-5 text-orange-500" />, title: 'Campaign sent', desc: 'Q4 Outreach campaign sent to 850 contacts', time: '3 hours ago' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full blur-3xl opacity-30"
          animate={{
            x: mousePosition.x * 2,
            y: mousePosition.y * 2
          }}
          transition={{ type: 'spring', stiffness: 50 }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-teal-100 to-blue-100 rounded-full blur-3xl opacity-30"
          animate={{
            x: -mousePosition.x * 2,
            y: -mousePosition.y * 2
          }}
          transition={{ type: 'spring', stiffness: 50 }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-pink-100 to-yellow-100 rounded-full blur-3xl opacity-20"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 30 }}
              className="fixed left-0 top-0 h-full w-72 bg-white/90 backdrop-blur-xl shadow-2xl z-50 lg:hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center space-x-3">
                    <motion.div
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.5 }}
                      className="w-10 h-10 bg-gradient-to-br from-teal-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg"
                    >
                      <Zap className="w-6 h-6 text-white" />
                    </motion.div>
                    <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                      Captely
                    </span>
                  </div>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <nav className="space-y-2">
                  {navItems.map((item, index) => (
                    <motion.button
                      key={item.label}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => item.path && navigate(item.path)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                        item.active
                          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 shadow-sm'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      {item.icon}
                      <span className="font-medium">{item.label}</span>
                    </motion.button>
                  ))}
                </nav>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="lg:ml-0">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm"
        >
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Left side */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="hidden lg:flex items-center space-x-3">
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.5 }}
                    className="w-10 h-10 bg-gradient-to-br from-teal-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg"
                  >
                    <Zap className="w-6 h-6 text-white" />
                  </motion.div>
                  <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Captely
                  </span>
                </div>
              </div>

              {/* Center - Search */}
              <div className="flex-1 max-w-2xl mx-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search contacts, companies, or actions..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                  {searchQuery && (
                    <motion.button
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Right side */}
              <div className="flex items-center space-x-3">
                {/* Refresh button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleRefresh}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
                </motion.button>

                {/* Notifications */}
                <div className="relative">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative"
                  >
                    <Bell className="w-5 h-5 text-gray-600" />
                    {notifications.filter(n => !n.read).length > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"
                      />
                    )}
                  </motion.button>

                  <AnimatePresence>
                    {showNotifications && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
                      >
                        <div className="p-4 border-b border-gray-100">
                          <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {notifications.map((notif) => (
                            <div
                              key={notif.id}
                              className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${
                                !notif.read ? 'bg-blue-50/50' : ''
                              }`}
                            >
                              <div className="flex items-start space-x-3">
                                <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                                  notif.type === 'success' ? 'bg-green-500' :
                                  notif.type === 'warning' ? 'bg-yellow-500' :
                                  notif.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                                }`} />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                                  <p className="text-xs text-gray-600 mt-0.5">{notif.message}</p>
                                  <p className="text-xs text-gray-500 mt-1">{notif.time}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="p-3 bg-gray-50">
                          <button className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium">
                            View all notifications
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* User menu */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium shadow-md">
                    {userData.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="hidden lg:block text-left">
                    <p className="text-sm font-medium text-gray-900">{userData.name}</p>
                    <p className="text-xs text-gray-500">{userData.company}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </motion.button>
              </div>
            </div>
          </div>
        </motion.header>

        {/* Main content area */}
        <main className="px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
                  <span>{getGreeting().text}, {userData.name.split(' ')[0]}!</span>
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                  >
                    {getGreeting().emoji}
                  </motion.span>
                </h1>
                <p className="mt-2 text-gray-600">
                  Here's what's happening with your leads today
                </p>
              </div>
              <div className="hidden lg:flex items-center space-x-4">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100"
                >
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    {format(currentTime, 'EEEE, MMMM d')}
                  </span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100"
                >
                  <Clock className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">
                    {format(currentTime, 'HH:mm:ss')}
                  </span>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Quick actions */}
          <motion.div
            variants={staggerChildren}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          >
            {[
              { icon: <Upload />, label: 'Import Leads', color: 'from-blue-500 to-indigo-600', bgColor: 'from-blue-50 to-indigo-50', action: () => navigate('/import') },
              { icon: <UserPlus />, label: 'Add Contact', color: 'from-green-500 to-emerald-600', bgColor: 'from-green-50 to-emerald-50', action: () => {} },
              { icon: <Download />, label: 'Export Data', color: 'from-purple-500 to-pink-600', bgColor: 'from-purple-50 to-pink-50', action: () => {} },
              { icon: <MessageSquare />, label: 'Send Campaign', color: 'from-orange-500 to-red-600', bgColor: 'from-orange-50 to-red-50', action: () => {} }
            ].map((action, index) => (
              <motion.button
                key={action.label}
                variants={fadeInUp}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={action.action}
                className="relative overflow-hidden group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 p-6"
              >
                <div className="relative z-10">
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.5 }}
                    className={`w-12 h-12 bg-gradient-to-br ${action.color} rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300`}
                  >
                    {action.icon}
                  </motion.div>
                  <p className="text-sm font-medium text-gray-900">{action.label}</p>
                </div>
                <div className={`absolute inset-0 bg-gradient-to-br ${action.bgColor} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              </motion.button>
            ))}
          </motion.div>

          {/* KPI Cards */}
          <motion.div
            variants={staggerChildren}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          >
            {[
              {
                title: 'Total Leads',
                value: 12847,
                change: '+12.5%',
                trend: 'up',
                icon: <Users className="w-5 h-5" />,
                color: 'from-blue-500 to-indigo-600',
                bgColor: 'from-blue-50 to-indigo-50',
                sparkline: [20, 35, 31, 45, 38, 52, 41]
              },
              {
                title: 'Enrichment Rate',
                value: 94.2,
                suffix: '%',
                change: '+3.2%',
                trend: 'up',
                icon: <Target className="w-5 h-5" />,
                color: 'from-green-500 to-emerald-600',
                bgColor: 'from-green-50 to-emerald-50',
                sparkline: [88, 89, 91, 92, 90, 93, 94]
              },
              {
                title: 'Credits Used',
                value: 8420,
                total: 10000,
                change: '1,580 left',
                trend: 'neutral',
                icon: <CreditCard className="w-5 h-5" />,
                color: 'from-purple-500 to-pink-600',
                bgColor: 'from-purple-50 to-pink-50',
                sparkline: [6800, 7200, 7500, 7900, 8100, 8300, 8420]
              },
              {
                title: 'Revenue Impact',
                value: 458000,
                prefix: '$',
                change: '+28.4%',
                trend: 'up',
                icon: <DollarSign className="w-5 h-5" />,
                color: 'from-orange-500 to-red-600',
                bgColor: 'from-orange-50 to-red-50',
                sparkline: [350, 380, 400, 420, 430, 440, 458]
              }
            ].map((stat, index) => (
              <motion.div
                key={stat.title}
                variants={scaleIn}
                whileHover={{ y: -4 }}
                className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 relative overflow-hidden group"
              >
                {/* Background decoration */}
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.bgColor} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <motion.div
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.5 }}
                      className={`w-10 h-10 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center text-white shadow-lg`}
                    >
                      {stat.icon}
                    </motion.div>
                    <span className={`text-sm font-medium flex items-center space-x-1 ${
                      stat.trend === 'up' ? 'text-green-600' : 
                      stat.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {stat.trend === 'up' && <ArrowUp className="w-3 h-3" />}
                      {stat.trend === 'down' && <ArrowDown className="w-3 h-3" />}
                      <span>{stat.change}</span>
                    </span>
                  </div>
                  
                  <h3 className="text-sm font-medium text-gray-600 mb-2">{stat.title}</h3>
                  
                  <div className="flex items-baseline space-x-2">
                    <CountUp
                      end={stat.value}
                      duration={2}
                      separator=","
                      prefix={stat.prefix}
                      suffix={stat.suffix}
                      className="text-2xl font-bold text-gray-900"
                    />
                    {stat.total && (
                      <span className="text-sm text-gray-500">/ {stat.total.toLocaleString()}</span>
                    )}
                  </div>
                  
                  {stat.sparkline && (
                    <div className="mt-4 h-12">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stat.sparkline.map((v, i) => ({ value: v, index: i }))}>
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke={stat.trend === 'up' ? '#10B981' : '#EF4444'} 
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  
                  {stat.total && (
                    <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(stat.value / stat.total) * 100}%` }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className={`h-full bg-gradient-to-r ${stat.color}`}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Revenue Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="lg:col-span-2 bg-white rounded-2xl shadow-sm hover:shadow-xl transition-shadow duration-300 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Revenue & Lead Trends</h2>
                <div className="flex items-center space-x-2">
                  {['week', 'month', 'year'].map((period) => (
                    <button
                      key={period}
                      onClick={() => setSelectedPeriod(period)}
                      className={`px-3 py-1 text-sm font-medium rounded-lg transition-all duration-200 ${
                        selectedPeriod === period
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {period.charAt(0).toUpperCase() + period.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="month" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                      backdropFilter: 'blur(10px)'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3B82F6"
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    strokeWidth={3}
                    animationDuration={1000}
                  />
                  <Area
                    type="monotone"
                    dataKey="leads"
                    stroke="#10B981"
                    fillOpacity={1}
                    fill="url(#colorLeads)"
                    strokeWidth={3}
                    animationDuration={1200}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Enrichment Success Rate */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-shadow duration-300 p-6"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Enrichment Success</h2>
              
              <div className="relative">
                <ResponsiveContainer width="100%" height={250}>
                  <RePieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={1000}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                        backdropFilter: 'blur(10px)'
                      }}
                    />
                  </RePieChart>
                </ResponsiveContainer>
                
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-gray-900">89%</p>
                    <p className="text-sm text-gray-500">Success Rate</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3 mt-4">
                {pieData.map((item, index) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <motion.div
                        whileHover={{ scale: 1.2 }}
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-gray-600">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{item.value}%</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Activity Timeline & Team Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Real-time Activity */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-shadow duration-300 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Today's Activity</h2>
                <div className="flex items-center space-x-2">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-2 h-2 bg-green-500 rounded-full"
                  />
                  <span className="text-sm text-gray-600">Live</span>
                </div>
              </div>
              
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="time" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                      backdropFilter: 'blur(10px)'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="enrichments"
                    stroke="#3B82F6"
                    strokeWidth={3}
                    dot={{ fill: '#3B82F6', r: 4 }}
                    activeDot={{ r: 6 }}
                    animationDuration={1000}
                  />
                </LineChart>
              </ResponsiveContainer>
              
              <div className="mt-4 grid grid-cols-3 gap-4">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="text-center p-3 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100"
                >
                  <p className="text-2xl font-bold text-gray-900">1,680</p>
                  <p className="text-xs text-gray-600">Total Today</p>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="text-center p-3 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100"
                >
                  <p className="text-2xl font-bold text-green-600">+24%</p>
                  <p className="text-xs text-gray-600">vs Yesterday</p>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="text-center p-3 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100"
                >
                  <p className="text-2xl font-bold text-purple-600">142</p>
                  <p className="text-xs text-gray-600">Per Hour</p>
                </motion.div>
              </div>
            </motion.div>

            {/* Team Leaderboard */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-shadow duration-300 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Team Leaderboard</h2>
                <Trophy className="w-5 h-5 text-yellow-500" />
              </div>
              
              <div className="space-y-4">
                {teamMembers.map((member, index) => (
                  <motion.div
                    key={member.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + index * 0.1 }}
                    whileHover={{ x: 4 }}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium shadow-md"
                        >
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </motion.div>
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                            member.status === 'online' ? 'bg-green-500' :
                            member.status === 'away' ? 'bg-yellow-500' : 'bg-gray-400'
                          }`}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{member.name}</p>
                        <p className="text-xs text-gray-500">{member.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{member.leads} leads</p>
                        <p className={`text-xs font-medium ${
                          member.performance.startsWith('+') ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {member.performance}
                        </p>
                      </div>
                      {index === 0 && (
                        <motion.div
                          animate={{ rotate: [0, 360] }}
                          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                        >
                          <Trophy className="w-5 h-5 text-yellow-500" />
                        </motion.div>
                      )}
                      {index === 1 && <Trophy className="w-5 h-5 text-gray-400" />}
                      {index === 2 && <Trophy className="w-5 h-5 text-orange-600" />}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Recent Activity Feed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-shadow duration-300 p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
                View All
              </button>
            </div>
            
            <div className="space-y-4">
              {recentActivities.map((activity, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                  whileHover={{ x: 4 }}
                  className="flex items-start space-x-3 p-3 rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 cursor-pointer"
                >
                  <motion.div
                    whileHover={{ scale: 1.2, rotate: 360 }}
                    transition={{ duration: 0.3 }}
                    className="flex-shrink-0 mt-0.5"
                  >
                    {activity.icon}
                  </motion.div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{activity.desc}</p>
                    <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </main>
      </div>

      {/* Floating action button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1, type: 'spring' }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl shadow-xl flex items-center justify-center hover:shadow-2xl transition-all duration-300"
        onClick={() => navigate('/import')}
      >
        <Upload className="w-6 h-6" />
      </motion.button>

      {/* Happiness inducing element */}
      <AnimatePresence>
        {Math.random() > 0.7 && (
          <motion.div
            initial={{ opacity: 0, scale: 0, rotate: -180 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0, rotate: 180 }}
            className="fixed bottom-20 left-8 bg-gradient-to-br from-yellow-100 to-orange-100 p-4 rounded-2xl shadow-lg border border-yellow-200"
          >
            <div className="flex items-center space-x-3">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="w-6 h-6 text-yellow-600" />
              </motion.div>
              <div>
                <p className="text-sm font-medium text-gray-900">You're doing great!</p>
                <p className="text-xs text-gray-600">Keep up the amazing work 🎉</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard; 