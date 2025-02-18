import { trackEvent } from './lib/events';

let trackedScrollEvent = false;

function trackScrollEvent() {
  if (!trackedScrollEvent) {
    trackEvent('scroll', {
      page_url: window.location.href,
    });

    trackedScrollEvent = true;
    window.removeEventListener('scroll', trackScrollEvent);
  }
}

window.addEventListener('scroll', trackScrollEvent);
