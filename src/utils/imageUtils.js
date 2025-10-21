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

  // Enhanced cache busting with better error handling
  let targetUrl = url;
  if (cacheBust) {
    try {
      // Validate URL first
      if (!url || typeof url !== 'string' || url.trim() === '') {
        throw new Error('Invalid or empty URL');
      }
      
      // ✅ هنا بنضيف حماية قبل ما نستخدم new URL
      let urlObj;
      if (url.startsWith('http')) {
        urlObj = new URL(url.trim());
      } else {
        // لو الرابط نسبي، نحوله لكامل
        urlObj = new URL(url.trim(), window.location.origin);
      }
      
      const params = new URLSearchParams(urlObj.search);
      
      // Clean existing cache busting parameters to avoid duplication
      ['_t', '_r', '_f', '_v', 't', 'r'].forEach(p => params.delete(p));
      
      // Add cache busting parameters
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      params.set('_t', timestamp.toString());
      params.set('_r', random);
      
      if (forceRefresh) params.set('_f', '1');
      
      urlObj.search = params.toString();
      
      // Use proxy for development, direct URL for production
      if (urlObj.hostname.includes('my-bus.storage-te.com')) {
        if (process.env.NODE_ENV === 'development') {
          // Use Vite proxy for development to avoid CORS
          targetUrl = `/__mbus__${urlObj.pathname}${urlObj.search}`;
        } else {
          // Use direct URL for production
          targetUrl = urlObj.toString();
        }
      } else {
        targetUrl = urlObj.toString();
      }
    } catch (error) {
      console.warn('Failed to add cache busting safely:', error);
      const separator = url.includes('?') ? '&' : '?';
      targetUrl = `${url}${separator}t=${Date.now()}&r=${Math.random().toString(36).substring(7)}`;
    }
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Loading image (attempt ${attempt}/${retries}): ${targetUrl.substring(0, 50)}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(targetUrl, {
        mode: 'no-cors', // Use no-cors to avoid CORS issues
        credentials: 'omit',
        cache: 'no-cache',
        signal: controller.signal,
        headers: {
          'Accept': 'image/*,*/*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      clearTimeout(timeoutId);

      // For no-cors mode, we can't check response.ok, so we proceed
      if (response.type === 'opaque') {
        console.warn('Opaque response received (no-cors mode), image may not be accessible');
        return null;
      }

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
      
      // Try alternative method using Image element for CORS issues
      if (attempt === retries) {
        try {
          console.log(`Trying alternative loading method for: ${targetUrl.substring(0, 50)}...`);
          return await loadImageWithCanvas(targetUrl);
        } catch (altError) {
          console.error(`Alternative loading also failed:`, altError);
          return null;
        }
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  return null;
};

/**
 * Alternative image loading using Image element and Canvas
 * @param {string} url - Image URL
 * @returns {Promise<string|null>} Data URL or null
 */
const loadImageWithCanvas = async (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx.drawImage(img, 0, 0);
        
        const dataUrl = canvas.toDataURL('image/png');
        console.log(`✅ Canvas method successful for: ${url.substring(0, 50)}...`);
        resolve(dataUrl);
      } catch (error) {
        console.error(`Canvas method failed:`, error);
        reject(error);
      }
    };
    
    img.onerror = () => {
      console.error(`Image element failed to load: ${url}`);
      reject(new Error('Image element failed to load'));
    };
    
    // Set timeout
    setTimeout(() => {
      reject(new Error('Image loading timeout'));
    }, 10000);
    
    img.src = url;
  });
};

/**
 * Preload multiple images with better error handling and performance optimization
 * @param {string[]} urls - Array of image URLs
 * @param {Object} options - Loading options
 * @returns {Promise<Map<string, string|null>>} Map of URL to data URL
 */
export const preloadImages = async (urls, options = {}) => {
  const results = new Map();
  
  // Filter out invalid URLs and duplicates
  const validUrls = [...new Set(urls.filter(url => url && typeof url === 'string' && url.trim()))];
  
  if (validUrls.length === 0) {
    console.warn('No valid URLs provided for preloading');
    return results;
  }
  
  // Process images in smaller batches to avoid overwhelming the server
  const batchSize = options.batchSize || 2; // Reduced batch size for Vercel
  const batches = [];
  
  for (let i = 0; i < validUrls.length; i += batchSize) {
    batches.push(validUrls.slice(i, i + batchSize));
  }

  console.log(`🔄 Preloading ${validUrls.length} images in ${batches.length} batches...`);

  for (const batch of batches) {
    const batchPromises = batch.map(async (url) => {
      try {
        const dataUrl = await loadImageAsDataUrl(url, {
          ...options,
          timeout: 20000, // Longer timeout for batch processing
          retries: 2 // Fewer retries for batch processing
        });
        results.set(url, dataUrl);
        
        if (dataUrl) {
          console.log(`✅ Preloaded: ${url.substring(0, 50)}...`);
        } else {
          console.warn(`❌ Failed to preload: ${url.substring(0, 50)}...`);
        }
      } catch (error) {
        console.error(`❌ Error preloading ${url}:`, error);
        results.set(url, null);
      }
    });

    await Promise.allSettled(batchPromises);
    
    // Longer delay between batches to avoid overwhelming the server
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const successCount = Array.from(results.values()).filter(Boolean).length;
  console.log(`🔄 Preloading completed: ${successCount}/${validUrls.length} images loaded successfully`);
  
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
    // ✅ حماية من الروابط النسبية
    let urlObj;
    if (trimmedUrl.startsWith('http')) {
      urlObj = new URL(trimmedUrl);
    } else {
      // لو الرابط نسبي، نحوله لكامل
      urlObj = new URL(trimmedUrl, window.location.origin);
    }
    
    // Check if it's a valid image URL
    const validProtocols = ['http:', 'https:'];
    if (!validProtocols.includes(urlObj.protocol)) {
      console.warn('Invalid protocol for image URL:', trimmedUrl);
      return null;
    }

    // Use proxy for development, direct URL for production
    if (urlObj.hostname.includes('my-bus.storage-te.com')) {
      if (process.env.NODE_ENV === 'development') {
        // Use Vite proxy for development to avoid CORS
        return `/__mbus__${urlObj.pathname}${urlObj.search}`;
      } else {
        // Use direct URL for production
        return urlObj.toString();
      }
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
          // Add aggressive cache busting with URL protection
          let url;
          if (originalSrc.startsWith('http')) {
            url = new URL(originalSrc);
          } else {
            // لو الرابط نسبي، نحوله لكامل
            url = new URL(originalSrc, window.location.origin);
          }
          
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
    console.warn('⚠️ Smart refresh failed for: Invalid URL');
    return null;
  }

  // Clean URL to avoid duplicate parameters
  const cleanUrl = url.split('?')[0];
  
  // Check if we have a cached version that's still fresh
  if (useCache && window.imageCache) {
    const cached = window.imageCache.get(cleanUrl);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes
      console.log('Using cached image:', cleanUrl.substring(0, 50));
      return cached.dataUrl;
    }
  }

  // Initialize cache if not exists
  if (!window.imageCache) {
    window.imageCache = new Map();
  }

  // Try to load with enhanced cache busting
  const dataUrl = await loadImageAsDataUrl(cleanUrl, {
    timeout,
    retries,
    cacheBust: true,
    forceRefresh: true
  });

  if (dataUrl) {
    // Cache the result
    window.imageCache.set(cleanUrl, {
      dataUrl,
      timestamp: Date.now()
    });
  } else {
    console.warn(`⚠️ Smart refresh failed for: ${cleanUrl}`);
  }

  return dataUrl;
};

/**
 * Auto-refresh images periodically with performance optimization
 * @param {Object} options - Auto-refresh options
 * @returns {Function} Stop function
 */
export const startAutoRefresh = (options = {}) => {
  const {
    interval = 120000, // 2 minutes (increased for better performance)
    selector = 'img',
    maxRetries = 3,
    maxImages = 10 // Limit number of images to refresh
  } = options;

  console.log('🔄 Starting optimized auto-refresh for images...');
  
  let retryCount = 0;
  const intervalId = setInterval(async () => {
    try {
      // Only refresh if page is visible to save resources
      if (document.hidden) {
        console.log('⏸️ Page hidden, skipping auto-refresh');
        return;
      }
      
      const success = await forceRefreshAllImages({ 
        selector,
        maxImages // Limit images to refresh
      });
      
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

/**
 * Memory-efficient image cleanup
 * @param {Object} options - Cleanup options
 */
export const cleanupImageCache = (options = {}) => {
  const {
    maxAge = 300000, // 5 minutes
    maxSize = 50 // Maximum number of cached images
  } = options;

  if (!window.imageCache) return;

  const now = Date.now();
  const entries = Array.from(window.imageCache.entries());
  
  // Remove old entries
  const validEntries = entries.filter(([url, data]) => {
    return now - data.timestamp < maxAge;
  });

  // Keep only the most recent entries if cache is too large
  const sortedEntries = validEntries
    .sort((a, b) => b[1].timestamp - a[1].timestamp)
    .slice(0, maxSize);

  // Clear and repopulate cache
  window.imageCache.clear();
  sortedEntries.forEach(([url, data]) => {
    window.imageCache.set(url, data);
  });

  console.log(`🧹 Cache cleanup: ${entries.length - sortedEntries.length} old entries removed`);
};

/**
 * Performance monitoring for image operations
 * @param {string} operation - Operation name
 * @param {Function} fn - Function to monitor
 * @returns {Promise<any>} Function result
 */
export const monitorImagePerformance = async (operation, fn) => {
  const startTime = performance.now();
  const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
  
  try {
    const result = await fn();
    const endTime = performance.now();
    const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
    
    console.log(`📊 ${operation} completed in ${(endTime - startTime).toFixed(2)}ms, memory: ${((endMemory - startMemory) / 1024 / 1024).toFixed(2)}MB`);
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    console.error(`❌ ${operation} failed after ${(endTime - startTime).toFixed(2)}ms:`, error);
    throw error;
  }
};
