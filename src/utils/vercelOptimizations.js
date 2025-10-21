/**
 * Vercel-specific optimizations for better performance
 * Handles environment-specific configurations and optimizations
 */

/**
 * Check if running on Vercel
 * @returns {boolean} True if running on Vercel
 */
export const isVercel = () => {
  // Safe check for process.env in browser environment
  if (typeof process === 'undefined' || !process.env) {
    // Check for Vercel-specific environment indicators
    return window.location.hostname.includes('vercel.app') || 
           window.location.hostname.includes('vercel.com') ||
           window.location.hostname.includes('now.sh');
  }
  
  return process.env.VERCEL === '1' || 
         process.env.NODE_ENV === 'production';
};

/**
 * Get optimized image loading configuration for current environment
 * @returns {Object} Configuration object
 */
export const getImageConfig = () => {
  const baseConfig = {
    timeout: 15000,
    retries: 3,
    cacheBust: true,
    forceRefresh: false
  };

  if (isVercel()) {
    return {
      ...baseConfig,
      timeout: 30000, // Longer timeout for Vercel
      retries: 3, // Reduced retries for better performance
      batchSize: 1, // Single image processing for Vercel
      delay: 1000, // Longer delay between images
      forceRefresh: true, // Force refresh on Vercel
      autoRefresh: true, // Enable auto-refresh
      refreshInterval: 180000, // 3 minutes
      maxConcurrent: 2, // Limit concurrent requests
      memoryLimit: 50 // MB memory limit
    };
  }

  return {
    ...baseConfig,
    batchSize: 2,
    delay: 300,
    autoRefresh: true,
    refreshInterval: 240000, // 4 minutes for development
    maxConcurrent: 3,
    memoryLimit: 100
  };
};

/**
 * Get optimized PDF generation configuration
 * @returns {Object} PDF configuration
 */
export const getPdfConfig = () => {
  const baseConfig = {
    margin: [2, 2, 2, 2],
    image: { type: "jpeg", quality: 0.92 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: "#ffffff",
      removeContainer: true
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"] }
  };

  if (isVercel()) {
    return {
      ...baseConfig,
      html2canvas: {
        ...baseConfig.html2canvas,
        imageTimeout: 20000, // Longer timeout for Vercel
        foreignObjectRendering: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1920,
        windowHeight: 1080
      }
    };
  }

  return {
    ...baseConfig,
    html2canvas: {
      ...baseConfig.html2canvas,
      imageTimeout: 15000
    }
  };
};

/**
 * Get environment-specific API configuration
 * @returns {Object} API configuration
 */
export const getApiConfig = () => {
  if (isVercel()) {
    return {
      baseUrl: 'https://my-bus.storage-te.com',
      timeout: 30000,
      retries: 3,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    };
  }

  return {
    baseUrl: 'https://my-bus.storage-te.com',
    timeout: 15000,
    retries: 2,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };
};

/**
 * Optimize image URLs for current environment
 * @param {string} url - Original image URL
 * @returns {string|null} Optimized URL or null
 */
export const optimizeImageUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const urlObj = new URL(url.trim());
    
    // Add environment-specific optimizations
    if (isVercel()) {
      // Add cache busting for Vercel
      const params = new URLSearchParams(urlObj.search);
      params.set('_t', Date.now().toString());
      params.set('_v', '1'); // Version parameter
      urlObj.search = params.toString();
    }

    return urlObj.toString();
  } catch (error) {
    console.warn('Invalid URL for optimization:', url, error);
    return null;
  }
};

/**
 * Get performance monitoring configuration
 * @returns {Object} Performance configuration
 */
export const getPerformanceConfig = () => {
  if (isVercel()) {
    return {
      enableMonitoring: true,
      logLevel: 'warn', // Reduce logging on Vercel
      maxMemoryUsage: 100, // MB
      batchSize: 2,
      delay: 300
    };
  }

  return {
    enableMonitoring: true,
    logLevel: 'info',
    maxMemoryUsage: 50, // MB
    batchSize: 3,
    delay: 100
  };
};

/**
 * Get error handling configuration
 * @returns {Object} Error handling configuration
 */
export const getErrorConfig = () => {
  if (isVercel()) {
    return {
      maxRetries: 5,
      retryDelay: 1000,
      fallbackEnabled: true,
      logErrors: true
    };
  }

  return {
    maxRetries: 3,
    retryDelay: 500,
    fallbackEnabled: true,
    logErrors: true
  };
};

/**
 * Initialize environment-specific optimizations
 * @returns {Object} Optimization configuration
 */
export const initializeOptimizations = () => {
  const config = {
    image: getImageConfig(),
    pdf: getPdfConfig(),
    api: getApiConfig(),
    performance: getPerformanceConfig(),
    error: getErrorConfig()
  };

  // Add memory management for Vercel
  if (isVercel()) {
    config.memory = {
      maxCacheSize: 20, // Maximum cached images
      cleanupInterval: 300000, // 5 minutes
      gcThreshold: 0.8 // Garbage collection threshold
    };
  }

  console.log('Initialized optimizations for:', isVercel() ? 'Vercel' : 'Development');
  return config;
};

/**
 * Get resource usage statistics
 * @returns {Object} Resource usage stats
 */
export const getResourceStats = () => {
  if (typeof performance === 'undefined' || !performance.memory) {
    return { available: false };
  }

  const memory = performance.memory;
  return {
    available: true,
    used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
    total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
    limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
    usage: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
  };
};

/**
 * Check if system resources are sufficient for operation
 * @param {string} operation - Operation name
 * @returns {boolean} True if resources are sufficient
 */
export const checkResourceAvailability = (operation = 'image-processing') => {
  const stats = getResourceStats();
  
  if (!stats.available) {
    return true; // Assume available if we can't check
  }

  const thresholds = {
    'image-processing': 80,
    'pdf-generation': 70,
    'batch-processing': 60
  };

  const threshold = thresholds[operation] || 80;
  return stats.usage < threshold;
};
