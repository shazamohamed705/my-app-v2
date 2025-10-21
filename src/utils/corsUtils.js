/**
 * CORS utilities for handling cross-origin image loading
 * Provides fallback mechanisms and error recovery
 */

/**
 * Check if we're in a CORS-restricted environment
 * @returns {boolean} True if CORS restrictions are likely
 */
export const isCorsRestricted = () => {
  // Check if we're on Vercel production
  if (typeof window !== 'undefined') {
    return window.location.hostname.includes('vercel.app') || 
           window.location.hostname.includes('vercel.com');
  }
  return false;
};

/**
 * Get the appropriate image URL based on environment
 * @param {string} originalUrl - Original image URL
 * @returns {string|null} Processed URL or null if invalid
 */
export const getCorsSafeImageUrl = (originalUrl) => {
  if (!originalUrl || typeof originalUrl !== 'string') {
    return null;
  }

  try {
    const urlObj = new URL(originalUrl);
    
    // Only process my-bus.storage-te.com URLs
    if (!urlObj.hostname.includes('my-bus.storage-te.com')) {
      return originalUrl;
    }

    // Use different strategies based on environment
    if (process.env.NODE_ENV === 'development') {
      // Use Vite proxy for development
      return `/__mbus__${urlObj.pathname}${urlObj.search}`;
    } else {
      // Use Vercel API proxy for production
      const proxyUrl = new URL('/api/proxy-image', window.location.origin);
      proxyUrl.searchParams.set('url', originalUrl);
      return proxyUrl.toString();
    }
  } catch (error) {
    console.warn('Error processing CORS-safe URL:', originalUrl, error);
    return originalUrl;
  }
};

/**
 * Enhanced image loading with CORS fallback
 * @param {string} url - Image URL
 * @param {Object} options - Loading options
 * @returns {Promise<string|null>} Data URL or null
 */
export const loadImageWithCorsFallback = async (url, options = {}) => {
  const {
    timeout = 15000,
    retries = 3,
    useProxy = true
  } = options;

  if (!url || typeof url !== 'string') {
    return null;
  }

  // Try direct loading first
  if (!useProxy) {
    try {
      return await loadImageDirect(url, { timeout, retries });
    } catch (error) {
      console.warn('Direct loading failed, trying proxy:', error);
    }
  }

  // Use proxy for CORS-restricted environments
  const corsSafeUrl = getCorsSafeImageUrl(url);
  if (corsSafeUrl && corsSafeUrl !== url) {
    try {
      return await loadImageDirect(corsSafeUrl, { timeout, retries });
    } catch (error) {
      console.warn('Proxy loading failed:', error);
    }
  }

  return null;
};

/**
 * Direct image loading without proxy
 * @param {string} url - Image URL
 * @param {Object} options - Loading options
 * @returns {Promise<string>} Data URL
 */
const loadImageDirect = async (url, options = {}) => {
  const { timeout = 15000, retries = 3 } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Loading image directly (attempt ${attempt}/${retries}): ${url.substring(0, 50)}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        mode: 'no-cors', // Use no-cors to avoid CORS issues
        credentials: 'omit',
        cache: 'no-cache',
        signal: controller.signal,
        headers: {
          'Accept': 'image/*,*/*',
          'Cache-Control': 'no-cache'
        }
      });

      clearTimeout(timeoutId);

      // For no-cors mode, we can't check response.ok
      if (response.type === 'opaque') {
        console.warn('Opaque response received (no-cors mode), image may not be accessible');
        throw new Error('Opaque response - CORS blocked');
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

      console.log(`✅ Image loaded successfully: ${url.substring(0, 50)}...`);
      return dataUrl;

    } catch (error) {
      console.warn(`Image load attempt ${attempt} failed:`, error.message);
      
      if (attempt === retries) {
        throw new Error(`Failed to load image after ${retries} attempts: ${error.message}`);
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  throw new Error('All retry attempts failed');
};

/**
 * Batch load images with CORS handling
 * @param {string[]} urls - Array of image URLs
 * @param {Object} options - Loading options
 * @returns {Promise<Map<string, string|null>>} Map of URL to data URL
 */
export const batchLoadImagesWithCors = async (urls, options = {}) => {
  const results = new Map();
  const validUrls = [...new Set(urls.filter(url => url && typeof url === 'string'))];
  
  if (validUrls.length === 0) {
    return results;
  }

  console.log(`🔄 Batch loading ${validUrls.length} images with CORS handling...`);

  // Process images in smaller batches to avoid overwhelming the server
  const batchSize = options.batchSize || 2;
  const batches = [];
  
  for (let i = 0; i < validUrls.length; i += batchSize) {
    batches.push(validUrls.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    const batchPromises = batch.map(async (url) => {
      try {
        const dataUrl = await loadImageWithCorsFallback(url, {
          ...options,
          timeout: 20000,
          retries: 2
        });
        results.set(url, dataUrl);
        
        if (dataUrl) {
          console.log(`✅ Batch loaded: ${url.substring(0, 50)}...`);
        } else {
          console.warn(`❌ Failed to batch load: ${url.substring(0, 50)}...`);
        }
      } catch (error) {
        console.error(`❌ Error batch loading ${url}:`, error);
        results.set(url, null);
      }
    });

    await Promise.allSettled(batchPromises);
    
    // Delay between batches
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const successCount = Array.from(results.values()).filter(Boolean).length;
  console.log(`🔄 Batch loading completed: ${successCount}/${validUrls.length} images loaded successfully`);
  
  return results;
};

/**
 * Check if an image URL needs CORS handling
 * @param {string} url - Image URL
 * @returns {boolean} True if CORS handling is needed
 */
export const needsCorsHandling = (url) => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('my-bus.storage-te.com') && 
           urlObj.origin !== window.location.origin;
  } catch (error) {
    return false;
  }
};

/**
 * Get CORS error message for user feedback
 * @param {Error} error - Error object
 * @returns {string} User-friendly error message
 */
export const getCorsErrorMessage = (error) => {
  if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
    return 'مشكلة في تحميل الصور بسبب قيود الأمان. جاري المحاولة مرة أخرى...';
  }
  
  if (error.message.includes('Failed to fetch')) {
    return 'فشل في تحميل الصور. تحقق من اتصال الإنترنت وحاول مرة أخرى.';
  }
  
  if (error.message.includes('timeout')) {
    return 'انتهت مهلة تحميل الصور. جاري المحاولة مرة أخرى...';
  }
  
  return 'حدث خطأ في تحميل الصور. جاري المحاولة مرة أخرى...';
};
