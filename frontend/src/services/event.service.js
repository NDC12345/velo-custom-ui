import api from './api';

/**
 * Event Service - Get server events & alerts
 */
class EventService {
  /**
   * Query server events
   * @param {Object} options - Query options
   * @param {string} options.startTime - Start time for event range
   * @param {string} options.endTime - End time for event range
   * @param {number} options.maxRows - Maximum number of events to return
   * @returns {Promise<Array>} List of events
   */
  async getServerEvents(options = {}) {
    try {
      const response = await api.post('/api/server/events', {
        start_time: options.startTime || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end_time: options.endTime || new Date().toISOString(),
        max_rows: options.maxRows || 100,
      });
      
      return response.data?.data?.events || [];
    } catch (error) {
      console.error('Failed to fetch server events:', error);
      throw error;
    }
  }

  /**
   * Get active alerts from server monitoring
   * @returns {Promise<Array>} List of active alerts
   */
  async getActiveAlerts() {
    try {
      const response = await api.get('/api/server/monitoring');
      const monitoring = response.data?.data || {};
      
      // Extract alerts from monitoring data
      const alerts = [];
      
      // Check for various alert conditions
      if (monitoring.cpu_percent > 80) {
        alerts.push({
          id: `cpu_${Date.now()}`,
          severity: 'high',
          type: 'system',
          title: 'High CPU Usage',
          description: `CPU usage at ${monitoring.cpu_percent.toFixed(1)}%`,
          timestamp: new Date().toISOString(),
          icon: 'mdi-chip',
        });
      }
      
      if (monitoring.memory_percent > 80) {
        alerts.push({
          id: `mem_${Date.now()}`,
          severity: 'high',
          type: 'system',
          title: 'High Memory Usage',
          description: `Memory usage at ${monitoring.memory_percent.toFixed(1)}%`,
          timestamp: new Date().toISOString(),
          icon: 'mdi-memory',
        });
      }
      
      // Get events that might be alerts
      const events = await this.getServerEvents({ maxRows: 50 });
      
      // Convert recent events to alerts
      events.forEach((event, index) => {
        const severity = this.determineSeverity(event);
        if (severity !== 'low') {
          alerts.push({
            id: `event_${index}`,
            severity,
            type: event.type || 'security',
            title: event.title || 'System Event',
            description: event.description || event.message || 'Event detected',
            timestamp: event.timestamp || new Date().toISOString(),
            icon: this.getEventIcon(event.type),
          });
        }
      });
      
      return alerts;
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      throw error;
    }
  }

  /**
   * Determine alert severity from event data
   * @private
   */
  determineSeverity(event) {
    const message = (event.message || event.description || '').toLowerCase();
    
    if (message.includes('critical') || message.includes('malware') || message.includes('breach')) {
      return 'critical';
    }
    if (message.includes('error') || message.includes('failed') || message.includes('suspicious')) {
      return 'high';
    }
    if (message.includes('warning') || message.includes('unusual')) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Get icon for event type
   * @private
   */
  getEventIcon(type) {
    const icons = {
      security: 'mdi-shield-alert',
      system: 'mdi-cog-alert',
      network: 'mdi-network-off',
      file: 'mdi-file-alert',
      process: 'mdi-application-alert',
      user: 'mdi-account-alert',
    };
    
    return icons[type] || 'mdi-alert';
  }
}

export default new EventService();
