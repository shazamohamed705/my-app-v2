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
    cacheBust = true,
    forceRefresh = false
  } = options;

  if (!url || typeof url !== 'string') {
    console.warn('Invalid URL provided to loadImageAsDataUrl:', url);
    return null;
  }

  // Enhanced cache busting with multiple strategies
  let targetUrl = url;
  if (cacheBust) {
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      
      // Multiple cache busting strategies
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      
      // Strategy 1: Timestamp + random
      params.set('_t', timestamp.toString());
      params.set('_r', random);
      
      // Strategy 2: Force refresh parameter
      if (forceRefresh) {
        params.set('_f', '1');
      }
      
      // Strategy 3: Version parameter for better caching
      params.set('_v', '2');
      
      urlObj.search = params.toString();
      
      // Use appropriate proxy based on environment
      if (urlObj.hostname.includes('my-bus.storage-te.com')) {
        if (process.env.NODE_ENV === 'production') {
          targetUrl = `/api/proxy${urlObj.pathname}${urlObj.search}`;
        } else {
          targetUrl = `/__mbus__${urlObj.pathname}${urlObj.search}`;
        }
      } else {
        targetUrl = urlObj.toString();
      }
    } catch (error) {
      console.warn('Failed to add cache busting:', error);
      // Fallback to original URL with basic cache busting
      targetUrl = `${url}?t=${Date.now()}&r=${Math.random().toString(36).substring(7)}`;
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

/**
 * Force refresh all images on the page
 * @param {Object} options - Refresh options
 * @returns {Promise<boolean>} Success status
 */
export const forceRefreshAllImages = async (options = {}) => {
  const {
    selector = 'img',
    timeout = 5000,
    retries = 2
  } = options;

  console.log('🔄 Starting force refresh of all images...');
  
  const images = document.querySelectorAll(selector);
  const refreshPromises = [];
  
  images.forEach((img, index) => {
    if (img.src && !img.src.startsWith('data:')) {
      const originalSrc = img.src;
      const refreshPromise = new Promise(async (resolve) => {
        try {
          // Add aggressive cache busting
          const url = new URL(originalSrc);
          const params = new URLSearchParams(url.search);
          params.set('_refresh', Date.now().toString());
          params.set('_force', '1');
          params.set('_attempt', index.toString());
          url.search = params.toString();
          
          // Set up timeout
          const timeoutId = setTimeout(() => {
            console.warn(`Image refresh timeout for: ${originalSrc}`);
            resolve(false);
          }, timeout);
          
          // Create new image to test loading
          const testImg = new Image();
          testImg.crossOrigin = 'anonymous';
          
          testImg.onload = () => {
            clearTimeout(timeoutId);
            img.src = url.toString();
            console.log(`✅ Image refreshed successfully: ${originalSrc.substring(0, 50)}...`);
            resolve(true);
          };
          
          testImg.onerror = () => {
            clearTimeout(timeoutId);
            console.warn(`❌ Failed to refresh image: ${originalSrc}`);
            resolve(false);
          };
          
          testImg.src = url.toString();
          
        } catch (error) {
          console.warn(`Error refreshing image ${originalSrc}:`, error);
          resolve(false);
        }
      });
      
      refreshPromises.push(refreshPromise);
    }
  });
  
  const results = await Promise.allSettled(refreshPromises);
  const successCount = results.filter(result => 
    result.status === 'fulfilled' && result.value === true
  ).length;
  
  console.log(`🔄 Image refresh completed: ${successCount}/${images.length} images refreshed successfully`);
  return successCount > 0;
};

/**
 * Smart image refresh with intelligent caching
 * @param {string} url - Image URL to refresh
 * @param {Object} options - Refresh options
 * @returns {Promise<string|null>} New data URL or null
 */
export const smartRefreshImage = async (url, options = {}) => {
  const {
    timeout = 10000,
    retries = 3,
    useCache = true
  } = options;

  if (!url || typeof url !== 'string') {
    return null;
  }

  // Check if we have a cached version that's still fresh
  if (useCache && window.imageCache) {
    const cached = window.imageCache.get(url);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes
      console.log('Using cached image:', url.substring(0, 50));
      return cached.dataUrl;
    }
  }

  // Initialize cache if not exists
  if (!window.imageCache) {
    window.imageCache = new Map();
  }

  // Try to load with enhanced cache busting
  const dataUrl = await loadImageAsDataUrl(url, {
    timeout,
    retries,
    cacheBust: true,
    forceRefresh: true
  });

  if (dataUrl) {
    // Cache the result
    window.imageCache.set(url, {
      dataUrl,
      timestamp: Date.now()
    });
  }

  return dataUrl;
};

/**
 * Auto-refresh images periodically
 * @param {Object} options - Auto-refresh options
 * @returns {Function} Stop function
 */
export const startAutoRefresh = (options = {}) => {
  const {
    interval = 60000, // 1 minute
    selector = 'img',
    maxRetries = 3
  } = options;

  console.log('🔄 Starting auto-refresh for images...');
  
  let retryCount = 0;
  const intervalId = setInterval(async () => {
    try {
      const success = await forceRefreshAllImages({ selector });
      if (success) {
        retryCount = 0; // Reset on success
      } else {
        retryCount++;
        if (retryCount >= maxRetries) {
          console.warn('Max retries reached for auto-refresh, stopping...');
          clearInterval(intervalId);
        }
      }
    } catch (error) {
      console.error('Auto-refresh error:', error);
      retryCount++;
    }
  }, interval);

  // Return stop function
  return () => {
    console.log('🛑 Stopping auto-refresh...');
    clearInterval(intervalId);
  };
};
