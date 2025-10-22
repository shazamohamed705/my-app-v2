// Vercel serverless function to proxy images and handle CORS
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

v  // Debug logging
  console.log('Request query:', req.query);
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);

  const { url } = req.query;

  if (!url) {
    console.error('No URL parameter provided');
    console.error('Available query params:', Object.keys(req.query));
    console.error('Full request URL:', req.url);
    console.error('Request headers:', req.headers);
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Decode the URL
    let decodedUrl;
    try {
      // Handle both encoded and unencoded URLs
      if (url.includes('%')) {
        decodedUrl = decodeURIComponent(url);
      } else {
        decodedUrl = url;
      }
    } catch (decodeError) {
      console.error('URL decode error:', decodeError);
      console.error('Original URL:', url);
      return res.status(400).json({ error: 'Invalid URL encoding' });
    }
    
    console.log('Original URL:', url);
    console.log('Decoded URL:', decodedUrl);
    
    // Validate that the URL is from the allowed domain
    const allowedDomains = ['my-bus.storage-te.com'];
    let urlObj;
    
    try {
      urlObj = new URL(decodedUrl);
    } catch (urlError) {
      console.error('Invalid URL:', urlError);
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    
    if (!allowedDomains.includes(urlObj.hostname)) {
      console.error('Domain not allowed:', urlObj.hostname);
      return res.status(403).json({ error: 'Domain not allowed' });
    }

    console.log('Fetching image from:', decodedUrl);

    // Fetch the image with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)',
        'Accept': 'image/*',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log('Fetch response status:', response.status);

    if (!response.ok) {
      console.error('Failed to fetch image:', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: `Failed to fetch image: ${response.statusText}` 
      });
    }

    // Get the content type
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    console.log('Content type:', contentType);
    
    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    // Stream the image data
    const buffer = await response.arrayBuffer();
    console.log('Image buffer size:', buffer.byteLength);
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('Proxy error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    if (error.name === 'AbortError') {
      return res.status(408).json({ error: 'Request timeout' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}
