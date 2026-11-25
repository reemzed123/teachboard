import type { DetailedHTMLProps, HTMLAttributes } from 'react';

// מאפשר לכתוב <math-field> ב-JSX (רכיב של MathLive)
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        'math-virtual-keyboard-policy'?: string;
        'smart-fence'?: string;
      };
    }
  }
}
