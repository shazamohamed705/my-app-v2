/**
 * Vercel-specific optimizations for better performance
 * Handles environment-specific configurations and optimizations
 */

/**
 * Check if running on Vercel
 * @returns {boolean} True if running on Vercel
 */
export const isVercel = () => {
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
    cacheBust: true
  };

  if (isVercel()) {
    return {
      ...baseConfig,
      timeout: 20000, // Longer timeout for Vercel
      retries: 5, // More retries for Vercel
      batchSize: 2, // Smaller batches for Vercel
      delay: 300 // Longer delay between batches
    };
  }

  return {
    ...baseConfig,
    batchSize: 3,
    delay: 100
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

  console.log('Initialized optimizations for:', isVercel() ? 'Vercel' : 'Development');
  return config;
};
