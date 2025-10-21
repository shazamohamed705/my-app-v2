/**
 * Performance utilities for better Vercel deployment
 * Handles caching, debouncing, and optimization
 */

/**
 * Debounce function to limit function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Execute immediately
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait, immediate = false) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func(...args);
  };
};

/**
 * Throttle function to limit function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Simple cache implementation
 * @param {number} maxSize - Maximum cache size
 * @returns {Object} Cache object
 */
export const createCache = (maxSize = 100) => {
  const cache = new Map();
  
  return {
    get: (key) => cache.get(key),
    set: (key, value) => {
      if (cache.size >= maxSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      cache.set(key, value);
    },
    clear: () => cache.clear(),
    size: () => cache.size
  };
};

/**
 * Performance monitoring utility
 * @param {string} name - Operation name
 * @param {Function} operation - Operation to monitor
 * @returns {Promise} Operation result with timing
 */
export const monitorPerformance = async (name, operation) => {
  const start = performance.now();
  try {
    const result = await operation();
    const end = performance.now();
    console.log(`${name} completed in ${(end - start).toFixed(2)}ms`);
    return result;
  } catch (error) {
    const end = performance.now();
    console.error(`${name} failed after ${(end - start).toFixed(2)}ms:`, error);
    throw error;
  }
};

/**
 * Batch processing utility
 * @param {Array} items - Items to process
 * @param {Function} processor - Processing function
 * @param {number} batchSize - Batch size
 * @param {number} delay - Delay between batches
 * @returns {Promise<Array>} Processed items
 */
export const processBatch = async (items, processor, batchSize = 5, delay = 100) => {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(item => processor(item))
    );
    
    results.push(...batchResults.map(result => 
      result.status === 'fulfilled' ? result.value : null
    ));
    
    // Delay between batches
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return results;
};

/**
 * Memory usage monitoring
 * @returns {Object} Memory usage information
 */
export const getMemoryUsage = () => {
  if (performance.memory) {
    return {
      used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
      total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
    };
  }
  return null;
};

/**
 * Optimized image loading with memory management
 * @param {Array} imageUrls - Array of image URLs
 * @param {Object} options - Loading options
 * @returns {Promise<Map>} Map of URL to data URL
 */
export const optimizedImageLoader = async (imageUrls, options = {}) => {
  const {
    batchSize = 3,
    delay = 200,
    maxMemory = 50 // MB
  } = options;
  
  const results = new Map();
  const cache = createCache(20);
  
  // Check memory usage
  const memoryUsage = getMemoryUsage();
  if (memoryUsage && memoryUsage.used > maxMemory) {
    console.warn('High memory usage detected, clearing cache');
    cache.clear();
  }
  
  // Process images in batches
  const batches = [];
  for (let i = 0; i < imageUrls.length; i += batchSize) {
    batches.push(imageUrls.slice(i, i + batchSize));
  }
  
  for (const batch of batches) {
    const batchPromises = batch.map(async (url) => {
      // Check cache first
      const cached = cache.get(url);
      if (cached) {
        results.set(url, cached);
        return;
      }
      
      try {
        const response = await fetch(url, {
          mode: 'cors',
          cache: 'no-cache',
          headers: { 'Accept': 'image/*' }
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          
          cache.set(url, dataUrl);
          results.set(url, dataUrl);
        }
      } catch (error) {
        console.warn(`Failed to load image: ${url}`, error);
        results.set(url, null);
      }
    });
    
    await Promise.allSettled(batchPromises);
    
    // Delay between batches
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return results;
};
