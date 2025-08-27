window.network = {
  isOnline() {
    return navigator.onLine;
  },

  async syncQueueIfOnline() {
    if (this.isOnline()) {
      const result = await window.electronAPI.syncQueue();
      if (result.success) {
        console.log(`[network] Synced ${result.synced} records`);
      } else {
        console.warn('[network] Sync error:', result.error);
      }
    }
  },

  updateConnectionIndicator() {
    const dot = document.getElementById('connection-dot');
    const label = document.getElementById('connection-label');
    const online = navigator.onLine;

    dot.style.color = online ? 'green' : 'red';
    label.textContent = online ? 'Online' : 'Offline';

     if (online) {
      this.syncQueueIfOnline();
    }
  },

  startConnectionMonitoring() {
    this.updateConnectionIndicator();

    window.addEventListener('online', () => this.updateConnectionIndicator());
    window.addEventListener('offline', () => this.updateConnectionIndicator());
  }
};
