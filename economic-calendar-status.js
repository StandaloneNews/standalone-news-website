(() => {
  'use strict';
  const widget = document.getElementById('us-economic-widget');
  const host = widget?.closest('.economic-calendar-embed');
  const status = document.getElementById('economic-calendar-fallback');
  if (!widget || !host || !status) return;
  // Rendering is owned by the provider; never claim events are loaded without its component.
  customElements.whenDefined('tv-economic-calendar').then(() => {
    status.dataset.loaded = 'true';
  }).catch(() => {});
  // Fail to the official sources instead of leaving a blank card when blocked.
  window.addEventListener('load', () => {
    window.setTimeout(() => {
      if (!customElements.get('tv-economic-calendar')) {
        host.dataset.unavailable = 'true';
        status.replaceChildren();
        const p = document.createElement('p');
        p.textContent = 'The embedded calendar is temporarily unavailable. Use the official release calendars below to check event dates.';
        status.append(p);
      }
    }, 12000);
  }, { once:true });
})();
