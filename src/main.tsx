import { startApp } from './appMain';

// נקודת הכניסה: התוכנה הרגילה, או מסך המקרן (‎?view=projector) – צפייה בלבד.
if (new URLSearchParams(location.search).get('view') === 'projector') {
  void import('./projectorMain');
} else {
  startApp();
}
