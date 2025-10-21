/**
 * Enhanced image utilities for better Vercel compatibility
 * Handles CORS, caching, and error recovery for image loading
 */

/**
 * Enhanced image loading with CORS support and fallback mechanisms
 * @param {string} url - Image URL to load
 * @param {Object} options - Loading options
 * @returns {Promise<string|null>} Data URL or null if failed
 */
export const loadImageAsDataUrl = async (url, options = {}) => {
  const {
    timeout = 10000,
    retries = 3,
    cacheBust = true
  } = options;

  if (!url || typeof url !== 'string') {
    console.warn('Invalid URL provided to loadImageAsDataUrl:', url);
    return null;
  }

  // Add cache busting for production
  let targetUrl = url;
  if (cacheBust && process.env.NODE_ENV === 'production') {
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      params.set('_t', Date.now().toString());
      urlObj.search = params.toString();
      targetUrl = urlObj.toString();
    } catch (error) {
      console.warn('Failed to add cache busting:', error);
    }
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Loading image (attempt ${attempt}/${retries}): ${targetUrl.substring(0, 50)}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(targetUrl, {
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-cache',
        signal: controller.signal,
        headers: {
          'Accept': 'image/*',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Empty image blob received');
      }

      // Convert to data URL
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read image blob'));
        reader.readAsDataURL(blob);
      });

      console.log(`Successfully loaded image: ${targetUrl.substring(0, 50)}...`);
      return dataUrl;

    } catch (error) {
      console.warn(`Image load attempt ${attempt} failed:`, error.message);
      
      if (attempt === retries) {
        console.error(`Failed to load image after ${retries} attempts:`, targetUrl);
        return null;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  return null;
};

/**
 * Preload multiple images with better error handling
 * @param {string[]} urls - Array of image URLs
 * @param {Object} options - Loading options
 * @returns {Promise<Map<string, string|null>>} Map of URL to data URL
 */
export const preloadImages = async (urls, options = {}) => {
  const results = new Map();
  
  // Process images in batches to avoid overwhelming the server
  const batchSize = options.batchSize || 3;
  const batches = [];
  
  for (let i = 0; i < urls.length; i += batchSize) {
    batches.push(urls.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    const batchPromises = batch.map(async (url) => {
      const dataUrl = await loadImageAsDataUrl(url, options);
      results.set(url, dataUrl);
    });

    await Promise.allSettled(batchPromises);
    
    // Small delay between batches
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
};

/**
 * Enhanced image URL validation and normalization
 * @param {string} url - Image URL to validate
 * @returns {string|null} Normalized URL or null if invalid
 */
export const normalizeImageUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return null;
  }

  try {
    const urlObj = new URL(trimmedUrl);
    
    // Check if it's a valid image URL
    const validProtocols = ['http:', 'https:'];
    if (!validProtocols.includes(urlObj.protocol)) {
      console.warn('Invalid protocol for image URL:', trimmedUrl);
      return null;
    }

    // Add cache busting for production
    if (process.env.NODE_ENV === 'production') {
      const params = new URLSearchParams(urlObj.search);
      params.set('_t', Date.now().toString());
      urlObj.search = params.toString();
    }

    return urlObj.toString();
  } catch (error) {
    console.warn('Invalid URL format:', trimmedUrl, error);
    return null;
  }
};

/**
 * Check if an image URL is already a data URL
 * @param {string} url - URL to check
 * @returns {boolean} True if it's a data URL
 */
export const isDataUrl = (url) => {
  return typeof url === 'string' && url.startsWith('data:');
};

/**
 * Enhanced image error handling with fallback
 * @param {HTMLImageElement} img - Image element
 * @param {string} fallbackSrc - Fallback image source
 */
export const handleImageError = (img, fallbackSrc = null) => {
  img.onerror = () => {
    console.warn('Image failed to load:', img.src);
    
    if (fallbackSrc && img.src !== fallbackSrc) {
      console.log('Trying fallback image:', fallbackSrc);
      img.src = fallbackSrc;
    } else {
      // Hide broken images
      img.style.display = 'none';
    }
  };
};
