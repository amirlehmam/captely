import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-6xl font-extrabold text-gray-900 dark:text-white">404</h1>
        <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">Page not found</p>
        <p className="mt-4 text-base text-gray-500 dark:text-gray-400">
          Sorry, we couldn't find the page you're looking for.
        </p>
        <div className="mt-10 flex justify-center space-x-4">
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
          >
            <Home className="h-4 w-4 mr-2" />
            Go back home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;