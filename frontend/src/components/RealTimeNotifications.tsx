import { useState, useEffect } from 'react';
import { X, Users, Edit, Plus, Trash2 } from 'lucide-react';
import { DataUpdateEvent } from '@/services/sharedDataService';

interface NotificationItem {
  id: string;
  type: 'company' | 'opportunity' | 'note' | 'system';
  action: 'add' | 'update' | 'delete';
  message: string;
  userId: string;
  timestamp: string;
  isVisible: boolean;
}

export const RealTimeNotifications = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    // Listen for custom events from shared data service
    const handleDataUpdate = (event: CustomEvent) => {
      const updateEvent = event.detail as DataUpdateEvent;
      
      const currentUser = JSON.parse(localStorage.getItem('gcc_user') || '{}');
      
      // Don't show notification for own actions
      if (updateEvent.userId === currentUser.username) {
        return;
      }

      const notification: NotificationItem = {
        id: Date.now().toString(),
        type: updateEvent.type,
        action: updateEvent.action,
        message: generateNotificationMessage(updateEvent),
        userId: updateEvent.userId,
        timestamp: updateEvent.timestamp,
        isVisible: true
      };

      setNotifications(prev => [notification, ...prev.slice(0, 4)]); // Keep max 5 notifications

      // Auto-hide after 5 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
      }, 5000);
    };

    // Listen for custom events
    window.addEventListener('dataUpdate', handleDataUpdate as EventListener);

    return () => {
      window.removeEventListener('dataUpdate', handleDataUpdate as EventListener);
    };
  }, []);

  const generateNotificationMessage = (event: DataUpdateEvent): string => {
    const actionText = {
      add: 'added',
      update: 'updated',
      delete: 'deleted'
    };

    const typeText = {
      company: 'a company',
      opportunity: 'an opportunity',
      note: 'a note',
      system: 'data'
    };

    const icon = {
      company: '🏢',
      opportunity: '🎯',
      note: '📝',
      system: '🔄'
    };

    return `${icon[event.type]} ${event.userId} ${actionText[event.action]} ${typeText[event.type]}`;
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 flex items-start gap-3 animate-in slide-in-from-right-2 duration-300"
          style={{
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <div className="flex-shrink-0">
            {getNotificationIcon(notification.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {notification.message}
              </p>
              <button
                onClick={() => dismissNotification(notification.id)}
                className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(notification.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

const getNotificationIcon = (type: string) => {
  const icons = {
    company: <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">🏢</div>,
    opportunity: <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">🎯</div>,
    note: <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">📝</div>,
    system: <div className="w-8 h-8 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center">🔄</div>
  };
  
  return icons[type as keyof typeof icons] || icons.system;
};
