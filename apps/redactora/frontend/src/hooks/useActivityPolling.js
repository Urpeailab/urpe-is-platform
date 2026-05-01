import { useState, useEffect } from 'react';
import { BACKEND_URL } from '../utils/constants';

// Polling Hook - Replaces WebSocket for better production stability
export const useActivityPolling = (userId) => {
  const [activities, setActivities] = useState([]);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchActivities = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${BACKEND_URL}/api/dashboard/recent-activity?limit=10`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setActivities(data.activities || data || []);
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Error fetching activities:', error);
        setIsConnected(false);
      }
    };

    fetchActivities();
    const interval = setInterval(fetchActivities, 15000);

    return () => clearInterval(interval);
  }, [userId]);

  return { activities, isConnected };
};

export default useActivityPolling;
