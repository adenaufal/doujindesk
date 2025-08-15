import { useEffect, useState } from 'react';

/**
 * FontLoader component to handle font loading with fallbacks
 * Detects if Google Fonts is available and falls back to local fonts if needed
 */
export const FontLoader = () => {
  const [fontStatus, setFontStatus] = useState<'loading' | 'loaded' | 'fallback'>('loading');

  useEffect(() => {
    const checkFontLoading = async () => {
      try {
        // Check if Google Fonts is accessible
        await fetch('https://fonts.googleapis.com/css2?family=Figtree:wght@400&display=swap', {
          method: 'HEAD',
          mode: 'no-cors'
        });
        
        // Wait for font to load
        if (document.fonts) {
          await document.fonts.ready;
          
          // Check if Figtree font is actually loaded
          const figtreeLoaded = document.fonts.check('16px Figtree');
          
          if (figtreeLoaded) {
            setFontStatus('loaded');
          } else {
            setFontStatus('fallback');
          }
        } else {
          // Fallback for older browsers
          setTimeout(() => {
            setFontStatus('loaded');
          }, 2000);
        }
      } catch (error) {
        console.warn('Google Fonts not accessible, using local fallback:', error);
        setFontStatus('fallback');
      }
    };

    checkFontLoading();
  }, []);

  // Add a class to body based on font status for debugging
  useEffect(() => {
    document.body.setAttribute('data-font-status', fontStatus);
  }, [fontStatus]);

  return null; // This component doesn't render anything
};

export default FontLoader;