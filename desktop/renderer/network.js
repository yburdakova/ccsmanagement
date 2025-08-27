window.network = {
  isOnline() {
    return navigator.onLine;
  },

  updateConnectionIndicator() {
    const dot = document.getElementById('connection-dot');
    const label = document.getElementById('connection-label');
    const online = navigator.onLine;

    dot.style.color = online ? 'green' : 'red';
    label.textContent = online ? 'Online' : 'Offline';
  },

  startConnectionMonitoring() {
    // первичная проверка
    this.updateConnectionIndicator();

    // автообновление при смене состояния
    window.addEventListener('online', () => this.updateConnectionIndicator());
    window.addEventListener('offline', () => this.updateConnectionIndicator());
  }
};
