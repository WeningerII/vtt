/**
 * Accessible Image Component with proper alt text and loading states
 */

import React, { useState } from 'react';
import { generateAltText } from '../utils/accessibility';

interface AccessibleImageProps {
  src: string;
  type: 'map' | 'token' | 'avatar' | 'icon' | 'generated';
  context?: {
    name?: string;
    description?: string;
    index?: number;
    total?: number;
  };
  className?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  onError?: () => void;
}

export const AccessibleImage: React.FC<AccessibleImageProps> = ({
  src,
  type,
  context,
  className = '',
  width,
  height,
  loading = 'lazy',
  onLoad,
  onError
}) => {
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [imageSrc, setImageSrc] = useState(src);

  const altText = generateAltText(type, context);

  const handleLoad = () => {
    setImageState('loaded');
    onLoad?.();
  };

  const handleError = () => {
    setImageState('error');
    // Set fallback image based on type
    const fallbackSrc = getFallbackImage(type);
    if (fallbackSrc && imageSrc !== fallbackSrc) {
      setImageSrc(fallbackSrc);
      setImageState('loading');
    } else {
      onError?.();
    }
  };

  const getFallbackImage = (imageType: string): string | null => {
    const fallbacks = {
      map: '/images/fallback-map.svg',
      token: '/images/fallback-token.svg',
      avatar: '/images/fallback-avatar.svg',
      icon: '/images/fallback-icon.svg',
      generated: '/images/fallback-generated.svg'
    };
    return fallbacks[imageType as keyof typeof fallbacks] || null;
  };

  if (imageState === 'error' && imageSrc === getFallbackImage(type)) {
    return (
      <div 
        className={`image-error ${className}`}
        role="img"
        aria-label={`Failed to load ${altText.toLowerCase()}`}
        style={{ width, height }}
      >
        <span className="sr-only">{altText} (failed to load)</span>
        <div className="error-placeholder">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
          </svg>
          <span>Image unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`accessible-image-container ${className}`}>
      {imageState === 'loading' && (
        <div 
          className="image-loading"
          role="img"
          aria-label={`Loading ${altText.toLowerCase()}`}
          style={{ width, height }}
        >
          <div className="loading-spinner" />
          <span className="sr-only">Loading {altText}</span>
        </div>
      )}
      
      <img
        src={imageSrc}
        alt={altText}
        width={width}
        height={height}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        className={imageState === 'loaded' ? 'loaded' : 'loading'}
        style={{
          display: imageState === 'loaded' ? 'block' : 'none'
        }}
      />
    </div>
  );
};

export default AccessibleImage;
