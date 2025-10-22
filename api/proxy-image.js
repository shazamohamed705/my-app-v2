// Vercel serverless function to proxy images and handle CORS
export default async function handler(req, res) {
  // ✅ السماح لكل الطلبات
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { url } = req.query;

  // ✅ تحقق واضح مع سجل الأخطاء
  if (!url || typeof url !== "string" || url.trim() === "") {
    console.error("❌ Missing or invalid ?url parameter:", url);
    return res.status(400).json({ error: "Missing or invalid ?url parameter" });
  }

  try {
    const decodedUrl = decodeURIComponent(url);
    console.log("🔗 Decoded URL:", decodedUrl);

    // ✅ السماح فقط للدومين الأصلي
    const allowedDomains = ["my-bus.storage-te.com"];
    const parsed = new URL(decodedUrl);

    if (!allowedDomains.includes(parsed.hostname)) {
      console.error("🚫 Blocked domain:", parsed.hostname);
      return res.status(403).json({ error: "Domain not allowed" });
    }

    // ✅ اجلب الصورة
    const response = await fetch(decodedUrl, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*" },
    });

    if (!response.ok) {
      console.error("❌ Failed to fetch image:", response.status, response.statusText);
      return res.status(response.status).json({ error: `Failed to fetch image: ${response.statusText}` });
    }

    // ✅ نوع الصورة
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).send(buffer);
  } catch (error) {
    console.error("🔥 Proxy error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}