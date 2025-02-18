import { post } from './http';

const API_EVENTS_PATH = '/api/events'

export function trackEvent(type, data) {
  const payload = {
    type,
    data,
  };

  post(API_EVENTS_PATH, payload);
}
