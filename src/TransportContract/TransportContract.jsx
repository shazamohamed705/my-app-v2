import { useEffect, useMemo, useState } from "react"; 
// Add useRef for PDF capture container
import { useRef } from "react";
import { useParams } from "react-router-dom";
 import "../styles/TransportContract.css"; import logo from "../assets/logo.png";
import html2pdf from "html2pdf.js";
 const TransportContract = () => {
  const { id } = useParams(); 

  const [trip, setTrip] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [driver, setDriver] = useState(null);
  const [passengers, setPassengers] = useState([]);
  const [secondParty, setSecondParty] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const contractRef = useRef(null);
  const isSharingRef = useRef(false);
  const shareBtnRef = useRef(null);
  const autoOpenedRef = useRef(false);
  // Removed client-side translation to avoid CORS; rely on API-provided English fields

  // Unified company fields from pdfData or vehicle - optimized with fallback values
  const company = useMemo(() => {
    if (!vehicle) {
      return {
      owner_name: "",
      owner_name_en: "",
      company_phone: "",
      company_address: "",
      company_address_en: "",
      company_tax_number: "",
      company_commercial_number: "",
      logo_src: null,
    };
    }
    
    // Use nullish coalescing for better performance
    return {
      owner_name: vehicle.owner_name ?? "",
      owner_name_en: vehicle.owner_name_en ?? "",
      company_phone: vehicle.company_phone ?? "",
      company_address: vehicle.company_address ?? "",
      company_address_en: vehicle.company_address_en ?? "",
      company_tax_number: vehicle.company_tax_number ?? "",
      company_commercial_number: vehicle.company_commercial_number ?? "",
      logo_src: vehicle.logo_photo ?? null,
    };
  }, [vehicle]);

  // Optimized character-by-character transliteration with Arabic numbers support (memoized for performance)
  const transliterateArabic = useMemo(() => {
    // Pre-compiled regex patterns for better performance
    const wordPatterns = [
      [/المؤسسة|المؤسسه/g, 'AL-MUASSASA'],
      [/جوال/g, 'JAWAL'],
      [/العنوان/g, 'AL-UNWAN'],
      [/الرقم/g, 'AL-RAQM'],
      [/الضريبي/g, 'AL-DHARIBI'],
      [/أمر/g, 'AMR'],
      [/تشغيل/g, 'TASHGHEEL'],
      [/عقد/g, 'AQD'],
      [/نقل/g, 'NAQL'],
      [/الطرق/g, 'AL-TURUQ'],
      [/البرية/g, 'AL-BARRIYA'],
      [/المدينة/g, 'AL-MADINA'],
      [/المنورة/g, 'AL-MUNAWWARA'],
      [/الرياض/g, 'AL-RIYADH'],
      [/جدة/g, 'JEDDAH'],
      [/مكة/g, 'MAKKAH'],
      [/الدمام/g, 'AL-DAMMAM'],
      [/الخبر/g, 'AL-KHOBAR'],
      [/الظهران/g, 'AL-DHAHRAN'],
      [/الطائف/g, 'AL-TAIF'],
      [/بريدة/g, 'BURAYDAH'],
      [/تبوك/g, 'TABUK'],
      [/حائل/g, 'HAIL'],
      [/أبها/g, 'ABHA'],
      [/نجران/g, 'NAJRAN'],
      [/جازان/g, 'JAZAN'],
      [/الباحة/g, 'AL-BAHA'],
      [/عرعر/g, 'ARAR'],
      [/سكاكا/g, 'SAKAKA']
    ];

    // Arabic to English character mapping as Map for O(1) lookup
    const charMap = new Map([
      ['ا', 'A'], ['أ', 'A'], ['إ', 'I'], ['آ', 'AA'],
      ['ب', 'B'], ['ت', 'T'], ['ث', 'TH'], ['ج', 'J'],
      ['ح', 'H'], ['خ', 'KH'], ['د', 'D'], ['ذ', 'DH'],
      ['ر', 'R'], ['ز', 'Z'], ['س', 'S'], ['ش', 'SH'],
      ['ص', 'S'], ['ض', 'D'], ['ط', 'T'], ['ظ', 'Z'],
      ['ع', 'A'], ['غ', 'GH'], ['ف', 'F'], ['ق', 'Q'],
      ['ك', 'K'], ['ل', 'L'], ['م', 'M'], ['ن', 'N'],
      ['ه', 'H'], ['و', 'W'], ['ي', 'Y'], ['ى', 'A'],
      ['ة', 'H'], ['ء', 'A'], ['ؤ', 'W'], ['ئ', 'Y']
    ]);

    // Arabic to English numbers mapping
    const numberMap = new Map([
      ['٠', '0'], ['١', '1'], ['٢', '2'], ['٣', '3'], ['٤', '4'],
      ['٥', '5'], ['٦', '6'], ['٧', '7'], ['٨', '8'], ['٩', '9']
    ]);

    return (arabicText) => {
      if (!arabicText || typeof arabicText !== 'string') return "";
      
      // Apply word patterns first (most efficient)
      let result = arabicText;
      for (const [pattern, replacement] of wordPatterns) {
        result = result.replace(pattern, replacement);
      }
      
      // Character-by-character transliteration for remaining text
      return result.split('').map(char => {
        // Check for Arabic numbers first
        if (numberMap.has(char)) {
          return numberMap.get(char);
        }
        // Then check for Arabic letters
        if (charMap.has(char)) {
          return charMap.get(char);
        }
        // Keep non-Arabic characters as is
        return char;
      }).join('');
    };
  }, []);

  useEffect(() => {
    if (!id) return;

    // Preload Arabic fonts on component mount
    loadArabicFonts();

    // Reset all states efficiently
    const resetStates = () => {
      setTrip(null); 
      setVehicle(null);
      setDriver(null);
      setPassengers([]);
      setPdfData(null);
      setSecondParty(null);
    };

    resetStates();

    // Optimized fetch with better error handling
    const fetchData = async () => {
      try {
        const response = await fetch(`https://my-bus.storage-te.com/api/trips/${id}/pdf`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const result = await response.json();
        if (result.success && result.data) {
          const { trip, vehicle, driver, passengers, second_party, pdf_data } = result.data;
          
          setTrip(trip);
          setVehicle(vehicle);
          setDriver(trip?.driver || driver || null);
          setPassengers(trip?.passengers || passengers || []);
          setSecondParty(second_party || trip?.second_party || pdf_data?.second_party || null);
          setPdfData(pdf_data);
        }
      } catch (error) {
        console.error('Error fetching trip data:', error);
      }
    };

    fetchData();
  }, [id]);

  // Open or download PDF مباشرة عند اكتمال البيانات
  useEffect(() => {
    const ready = Boolean(trip && vehicle);
    if (!ready || autoOpenedRef.current) return;

    autoOpenedRef.current = true;
    setIsGenerating(true);

    const controller = new AbortController();
    (async () => {
      try {
        const blob = await generatePdfBlob();
        const url = URL.createObjectURL(blob);

        const params = new URLSearchParams(window.location.search);
        const shouldDownload = params.has("download") || params.has("dl");
        const filename = `contract-${trip?.id || "trip"}.pdf`;

        if (shouldDownload) {
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          // محاولة إغلاق التبويب إذا كان نافذة مستقلة
          try { window.close(); } catch {}
        } else {
          // فتح الملف داخل نفس التبويب بدل إظهار صفحة React
          window.location.replace(url);
          // لا نقوم بـ revokeObjectURL مباشرة لأن الصفحة ستنتقل إلى الـ blob
        }
      } catch (e) {
        console.error("Auto PDF open failed", e);
        setIsGenerating(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [trip, vehicle, passengers.length, pdfData]);

  // Memoized computed values for better performance
  const firstPassenger = useMemo(() => passengers?.[0] ?? null, [passengers]);
  const assistantDriver = useMemo(() => trip?.trip_drivers?.[0] ?? null, [trip?.trip_drivers]);

  // Swap locations: show destination as Start and departure as Finish
  const startLocation = useMemo(() => trip?.departure_location, [trip?.departure_location]);
  const finishLocation = useMemo(() => trip?.destination_location, [trip?.destination_location]);

  // Optimized URL proxy mapping with memoization for better performance
  const toProxyUrl = useMemo(() => {
    const proxyHost = 'my-bus.storage-te.com';
    const proxyPrefix = '/__mbus__';
    
    return (url) => {
    if (!url) return null;
      
    try {
      const u = new URL(url, window.location.origin);
        if (u.hostname.includes(proxyHost)) {
          return `${proxyPrefix}${u.pathname}${u.search}`;
      }
      return url;
    } catch {
      return url;
    }
  };
  }, []);

  // Optimized safe image source - returns null if no image from API
  const safeImgSrc = useMemo(() => {
    return (url, fallback) => {
      // Early return for falsy values - no fallback images
      if (!url) return null;
      
      // Check if string is not empty after trimming
      const trimmedUrl = String(url).trim();
      if (!trimmedUrl) return null;
      
      return toProxyUrl(trimmedUrl);
    };
  }, [toProxyUrl]);

  // Function to ensure Arabic fonts are loaded before PDF generation
  const loadArabicFonts = async () => {
    try {
      // Check if document.fonts is available
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      
      // Wait for fonts to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.warn('Font loading failed, proceeding with PDF generation:', error);
    }
  };

  if (!trip || isGenerating) return <p>⏳ جاري إنشاء PDF...</p>;

  // Generate a PDF Blob from the whole contract using html2pdf.js
  const generatePdfBlob = async () => {
    const element = contractRef.current;
    if (!element) {
      console.error("Contract container not found");
      throw new Error("Contract container not found");
    }

    console.log("Starting PDF generation...");
    console.log("Element found:", element);
    console.log("Element content:", element.innerHTML.substring(0, 200));

    // Ensure Arabic fonts are loaded before PDF generation
    await loadArabicFonts();

    // Lock layout for PDF to match on-screen design
    element.classList.add('pdf-mode');

    // قياس الارتفاعين لتحديد إن كنا سنتجاوز صفحتين
    const approximateIsTooTallForTwoPages = () => {
      const pxPerMm = 3.78; // تقريب بصري شائع
      const a4HeightMm = 297;
      const usableHeightMm = a4HeightMm * 2 - 10; // طرح هامش تقريبي
      const usableHeightPx = usableHeightMm * pxPerMm;
      const totalHeight = element.scrollHeight;
      return totalHeight > usableHeightPx;
    };

    // Helper: fetch image and convert to data URL
    const toDataUrl = async (src) => {
      try {
        const target = toProxyUrl(src) || src;
        const response = await fetch(target, { mode: 'cors', credentials: 'omit', cache: 'no-cache' });
        if (!response.ok) throw new Error('img fetch failed');
        const blob = await response.blob();
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    };

    // Inline all images as data URLs to avoid CORS/render issues in html2canvas
    const imgs = Array.from(element.querySelectorAll('img'));
    const originalSrcs = new Map();
    await Promise.all(
      imgs.map(async (img) => {
        // Wait load/error to stabilize dimensions first
        if (!img.complete) {
          await new Promise((r) => {
            img.onload = r; img.onerror = r;
          });
        }
        const src = img.getAttribute('src');
        if (!src) return;
        const dataUrl = await toDataUrl(src);
        if (dataUrl) {
          originalSrcs.set(img, src);
          img.setAttribute('src', dataUrl);
        }
      })
    );

    // Ensure web fonts are loaded for crisp text before snapshot
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch {}
    }

    const options = {
      margin: [2, 2, 2, 2],
      filename: `contract-${trip?.id || "trip"}.pdf`,
      image: { type: "jpeg", quality: 0.92 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        imageTimeout: 10000,
        removeContainer: true
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    };

    // محاولة ضغط إضافية لو ما زال يتجاوز صفحتين
    if (approximateIsTooTallForTwoPages()) {
      element.style.zoom = '0.95';
    }
    if (approximateIsTooTallForTwoPages()) {
      element.style.zoom = '0.9';
    }
    try {
      console.log("Creating PDF worker...");
    const worker = html2pdf().set(options).from(element).toPdf();
      
      console.log("Getting PDF...");
    const pdf = await worker.get("pdf");
      
      console.log("Creating blob...");
    const blob = pdf.output("blob");
      
      console.log("PDF created successfully, blob size:", blob.size);

    // Restore original src values
    originalSrcs.forEach((src, img) => {
      img.setAttribute('src', src);
    });

    // Unlock layout
    element.style.zoom = '';
    element.classList.remove('pdf-mode');

    return blob;
    } catch (error) {
      console.error("PDF generation failed:", error);
      
      // Restore original src values even on error
      originalSrcs.forEach((src, img) => {
        img.setAttribute('src', src);
      });

      // Unlock layout
      element.style.zoom = '';
      element.classList.remove('pdf-mode');
      
      throw error;
    }
  };

  // Share the generated PDF via Web Share API when available; fallback otherwise
  const handleSharePdf = async () => {
    try {
      if (isSharingRef.current) {
        return;
      }
      isSharingRef.current = true;
      // Show loading message
      const btn = shareBtnRef.current;
      const originalText = btn?.textContent;
      if (btn) {
        btn.textContent = "جاري إنشاء PDF...";
        btn.disabled = true;
      }

      const blob = await generatePdfBlob();
      const filename = `contract-${trip?.id || "trip"}.pdf`;
      const file = new File([blob], filename, { type: "application/pdf" });

      const canShareFiles = typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] });
      if (canShareFiles && navigator.share) {
        await navigator.share({ files: [file], title: filename, text: `عقد الرحلة رقم ${trip?.id || ""}` });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const message = `تم إنشاء ملف PDF للعقد (${filename}). قم بإرفاقه يدويًا في واتساب.`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to generate/share PDF:", error);
      alert("تعذر إنشاء أو مشاركة ملف PDF. تأكد من تحميل جميع الصور أولاً.");
    } finally {
      // Restore button
      const btn = shareBtnRef.current;
      if (btn) {
        btn.textContent = "إرسال إلى واتساب (PDF)";
        btn.disabled = false;
      }
      isSharingRef.current = false;
    }
  };
 
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-start", margin: "8px 0" }}>
        <button
          type="button"
          onClick={handleSharePdf}
          ref={shareBtnRef}
          style={{
            backgroundColor: "#25D366",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 12px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          إرسال إلى واتساب (PDF)
        </button>
      </div>
      <div ref={contractRef}>
      {/* الصفحة الأولى */}
      <div className="contract-outer arabic-text">
        <div className="contract-inner">
          <div className="contract-body">

            {/* الهيدر */}
            <div className="header">
             
              <div className="logo-box">
                <div className="logo-text">
                  <div>{company.owner_name || "  المؤسسه  /----- "}</div>
                  <div>{`جوال / ${company.company_phone && company.company_phone.trim() !== "" ? company.company_phone : "----"}`}</div>
                  <div>{company.company_address || " العنوان /----- "}</div>
                  <div>
                    الرقم الضريبي
                 
                    <span className="tax-brackets">(</span>
                    <span className="tax-number-container nowrap-ellips ltr-number">{company.company_tax_number && company.company_tax_number.trim() !== "" ? company.company_tax_number : "--"}</span>
                    <span className="tax-brackets">)</span>
                  </div>
                </div>
              </div>
               <div className="center-title">
                 {safeImgSrc(pdfData?.logo) && <img src={safeImgSrc(pdfData?.logo)} crossOrigin="anonymous" alt="Logo" className="title-logo" />}
                 <div className="main-title">أمر تشغيل</div>
                 <div className="sub-title">{pdfData?.title || "عقد نقل على الطرق البرية"}</div>
               </div>
              <div className="company-info">
                <div>{company.owner_name_en || transliterateArabic(company.owner_name) || "Default: Obour Creations Transport Est"}</div>
                <div>{` ${company.company_phone && company.company_phone.trim() !== "" ? company.company_phone : "-----/ Mobile"}`}</div>
                <div>{company.company_address_en || transliterateArabic(company.company_address) || "-----/ Address"}</div>
                <div>
                  <span className="tax-brackets">(</span>
                  <span className="tax-number-container nowrap-ellips ltr-number">{company.company_tax_number && company.company_tax_number.trim() !== "" ? company.company_tax_number : "--"}</span>
                  <span className="tax-brackets">)</span>    VAT NO {" "}
                </div>
              </div>
            </div>

            <div className="meta-row">

 <p>
  التاريخ /{" "}
  <span className="red-text">
    {trip?.departure_time
      ? new Date(trip.departure_time).toLocaleDateString("ar-EG")
      : ":  فر"}
  </span>
</p>

  <p>رقم الرحلة / <span className="red-text">{trip.id}</span></p>
  <p>رقم العقد / <span className="red-text">8955601</span></p>
</div>
 <div className="contract-row">
                <p>
                {pdfData?.contract_message || "افتراضي: تم إبرام هذا العقد بين المتعاقدين بناء على المادة (٣٩) التاسعة والثلاثون من الأنظمة المنظمة لنشاط النقل المتخصص وتأجير و توجيه الحافلات وبناء على الفقرة (١) من المادة (٢٩)  تنص على ان يجب على الناقل إبرام عقد نقل مع الاطراف المحددين في المادة (٤٠) قبل تنفيذ عمليات النقل على الطرق البرية و بما ال يخالف أحكام هذه اللائحة و وفقا الآلية التي تحددها هيئة النقل و بناء على ما سبق تم إبرام عقد النقل بين الأطراف الآتية"}
                </p>
             </div>
{/* جدول الطرف الأول */}
<table className="my-table first-party">
  <colgroup>
    <col style={{ width: "30%" }} />
    <col style={{ width: "40%" }} />
    <col style={{ width: "15%" }} />
    <col style={{ width: "15%" }} />
  </colgroup>
  <tbody>
    <tr>
      <th rowSpan="3" style={{ color: "#3399ff" }}>الطرف الأول</th>
      <td>{firstPassenger?.name || "----"}</td>
      <th rowSpan="3" style={{ color: "#3399ff" }}>أرقام التواصل</th>
      <td>{ "----"}</td>
    </tr>
    <tr>
      <td>{`رقم الهوية / ${firstPassenger?.national_id || "----"}`}</td>
      <td>{`الجنسية / ${firstPassenger?.nationality || "----"}`}</td>
    </tr>
    <tr>
      <td>العنوان / -----  </td>
      <td>---</td>
    </tr>
  </tbody>
</table>


{/* جدول الطرف الثاني */}
<table className="my-table first-party">
  <colgroup>
    <col style={{ width: "30%" }} />
    <col style={{ width: "40%" }} />
    <col style={{ width: "15%" }} />
    <col style={{ width: "15%" }} />
  </colgroup>
  <tbody>
    <tr>
      <th rowSpan="3" style={{ color: "#3399ff" }}>الطرف الثاني</th>
      <td>{secondParty?.name || "-----"}</td>
      <th rowSpan="3" style={{ color: "#3399ff" }}>أرقام التواصل</th>
      <td>{secondParty?.phone || "-----"}</td>
    </tr>
    <tr>
      <td>{`رقم الهوية / ${secondParty?.national_id || "-----"}`}</td>
      <td>{`الجنسية / ${secondParty?.nationality || "-----"}`}</td>
    </tr>
    <tr>
      <td>{`العنوان / ${secondParty?.address || "-----"}`}</td>
      <td>-----</td>
    </tr>
  </tbody>
</table>

          
           {/* الشروط */}
           <div className="conditions">
             <p>
             {pdfData?.acceptance_message || "افتراضي: اتفق الطرفان على أن ينفذ الطرف الأول عملية النقل للطرف الثاني مع مرافقيه و ذويهم من الموقع المحدد مسبقا من الطرف الثاني و توصيلهم إلى الجهة المحددة بالعقد ."}
             </p>
           
           </div>
  {/* بيانات السيارة */}
        <table className="car-trips" style={{ borderCollapse: "collapse", width: "100%" }}>
  <colgroup>
    <col style={{ width: "25%" }} />
    <col style={{ width: "25%" }} />
    <col style={{ width: "25%" }} />
    <col style={{ width: "25%" }} />
  </colgroup>
  <thead>
    <tr>
      <th className="dashed-right">النقل من /</th>
      <th className="dashed-right">
        <span className="badge-start">Start</span>
        <span style={{ marginInlineStart: 8 }}>{startLocation}</span>
      </th>
      <th className="dashed-right label-ar">وصولاً إلى /</th>
      <th>
        <span className="badge-finish">Finish</span>
        <span style={{ marginInlineStart: 8 }}>{finishLocation}</span>
      </th>
    </tr>
  </thead>
</table>

           {/* الشروط */}
           <div className="conditions">
             <p>
               {pdfData?.cancellation_message || "افتراضي: في حالة الغاء التعاقد لأي سبب شخصي أو أسباب أخرى تتعلق في الحجوزات او الأنظمة تكون سياسة الإلغاء و الاستبدال"}
             </p>
             <p>
             {pdfData?.website_booking_message || "افتراضي: و في حالة طلب الطرف الثاني الحجز من خلال الموقع الإلكتروني للمؤسسة يعتبر هذا الحجز و موافقه على الشروط و الأحكام بالموقع الإلكتروني هو موافقة على هذا العقد لتنفيذ عملية النقل المتفق عليها مع الطرف الأول بواسطة حافلات المؤسسة المرخصة و المتوافقة مع الاشتراطات المقدرة من هيئة النقل ."}
             </p>
           </div>
        
          </div>
         {/* قسم تنبيه السائق بدون البوكس الأزرق */}
         <div className="wrapper-box">
           <div className="driver-notice-box">
             {/* النصوص */}
             <div className="content-box">
               <span style={{ color: "red", fontWeight: "bold" }}>تنبيه للسائق:</span>
               <span className="arabic" style={{ color: "red", fontWeight: "bold", marginRight: "5px" }}>
                 {pdfData?.warnings_messages?.ar || "افتراضي: برجاء الإلتزام بتعليمات الهيئة العامة للنقل و تعليمات المؤسسة، أي مخالفة تعرض السائق للمساءلة."}
               </span>
               ,
               <hr />
               <p className="english bold">
                 {pdfData?.warnings_messages?.en || "Default: Please comply with the regulations of the Public Transport Authority and the company's guidelines. Any violation will lead to accountability. Our goal: Respectfully serving passengers and reflecting a positive image of the Kingdom. Thank you for your cooperation. Ebdaat Al-Obour Transport (default)"}
               </p>
               <hr />
               <p className="urdu">
                 {pdfData?.warnings_messages?.or || "----"}
               </p>
             </div>
           </div>
           <div className="image-box">
             {safeImgSrc(vehicle?.stamp_photo) && <img src={safeImgSrc(vehicle?.stamp_photo)} crossOrigin="anonymous" alt="صورة" />}
           </div>
         </div>
        </div>
      </div>

      {/* الصفحة الثانية */}
      <div className="contract-outer arabic-text">
        <div className="contract-inner">
          <div className="contract-body">
            {/* الهيدر مكرر */}
            <div className="header">
              <div className="logo-box">
                <div className="logo-text">
                  <div>{company.owner_name || " المؤسسه / -----"}</div>
                  <div>{company.company_phone ? `جوال / ${company.company_phone}` : "الجوال / -----"}</div>
                  <div>{company.company_address || " العنوان / -----"}</div>
                  <div></div>
                  <div>
                    {company.company_tax_number ? (
                      <>
                        الرقم الضريبي ( <span className="tax-number-container nowrap-ellips ltr-number">{company.company_tax_number}</span> )
                      </>
                    ) : (
                      ": الرقم الضريبي ( ----- )"
                    )}
                  </div>
                </div>
              </div>
              <div className="center-title">
                {safeImgSrc(pdfData?.logo) && <img src={safeImgSrc(pdfData?.logo)} alt="Logo" className="title-logo" />}
                <div className="main1-title" style={{ fontSize: "32px", fontWeight: "bold", color: "red" }}>كشف الركاب</div>
              </div>
              <div className="company-info">
                <div>{company.owner_name_en || transliterateArabic(company.owner_name) || "-----/company"}</div>
                <div>{company.company_phone ? `MOBILE/ ${company.company_phone}` : "-------/ Mobile"}</div>
                <div>{company.company_address_en || transliterateArabic(company.company_address) || " ---------/ Address"}</div>
                <div></div>
                <div>
                  {company.company_tax_number ? (
                    <>
                      VAT NO: ( <span className="tax-number-container nowrap-ellips ltr-number">{company.company_tax_number}</span> )
                    </>
                  ) : (
                    "(-----) VAT NO "
                  )}
                </div>
              </div>
            </div>

            <table className="VEHICLE-table">
              <thead>
                <tr>
                  <th style={{ backgroundColor: "#fafa04", color: "#040404ff" }}>VEHICLE PLATE#</th>
                  <th style={{ backgroundColor: "#fafa04", color: "#141313ff" }}>VEHICLE MODEL#</th>
                  <th style={{ backgroundColor: "#fafa04", color: "#040404ff" }}>IQAMA#</th>
                  <th style={{ backgroundColor: "#fafa04", color: "#0b0b0bff" }}>MOBILE#</th>
                  <th style={{ backgroundColor: "#fafa04", color: "#060606ff" }}>DRIVER NAME</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th style={{ backgroundColor: "#c1d8e5", color: "#060606ff" }}>لوحة المركبة</th>
                  <th style={{ backgroundColor: "#c1d8e5", color: "#060606ff" }}>موديل المركبة</th>
                  <th style={{ backgroundColor: "#c1d8e5", color: "#060606ff" }}>رقم الاقامة</th>
                  <th style={{ backgroundColor: "#c1d8e5", color: "#060606ff" }}>رقم التواصل</th>
                  <th style={{ backgroundColor: "#c1d8e5", color: "#060606ff" }}>اسم سائق الرحلة</th>
                </tr>
                <tr>
                  <td>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <tbody>
                        <tr>
                          {vehicle?.plate_number?.split("/").map((part, idx) => (
                            <td key={idx} style={{ textAlign: "center", borderRight: "1px solid #000" }}>{part}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </td>
                  <td>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <tbody>
                        <tr>
                          <td style={{ borderRight: "1px solid #000", textAlign: "center" }}>{vehicle?.vehicle_model}</td>
                          <td style={{ textAlign: "center" }}>{vehicle.manufacturing_year}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                  <td>{driver?.driver_profile?.national_id}</td>
                  <td>{driver?.phone || trip?.driver?.phone || "-----"}</td>
                  <td>{driver?.name || trip?.driver?.name || "-----"}</td>
                </tr>
                <tr>
                  <th style={{ backgroundColor: "#c1d8e5", color: "#000" }}>لوحة المركبة</th>
                  <th style={{ backgroundColor: "#c1d8e5", color: "#000" }}>موديل المركبة</th>
                  <th style={{ backgroundColor: "#c1d8e5", color: "#000" }}>رقم الاقامة</th>
                  <th style={{ backgroundColor: "#c1d8e5", color: "#000" }}>رقم التواصل</th>
                  <th style={{ backgroundColor: "#c1d8e5", color: "#000" }}> اسم سائق الرحلة المساعد </th>
                </tr>
                <tr>
                  <td>-----</td>
                  <td>-----</td>
                  <td>{assistantDriver?.driver_national_id || "-----"}</td>
                  <td>{assistantDriver?.driver_phone || "-----"}</td>
                  <td>{assistantDriver?.driver_name || "-----"}</td>
                </tr>
              </tbody>
            </table>

            <table className="trip-table" style={{ borderCollapse: "collapse", width: "100%", border: "2px solid #000" }}>
              <thead>
                <tr>
                  <th style={{ backgroundColor: "#fafa04", color: "#000", padding: "8px", border: "1px solid #000" }} colSpan="3">FLIGHT PATH#</th>
                  <th style={{ backgroundColor: "#fafa04", color: "#000", padding: "8px", border: "1px solid #000" }}>Date</th>
                </tr>
                <tr>
                  <th style={{ backgroundColor: "#e4f6f8", color: "black", padding: "8px", border: "1px solid #000" }} colSpan="3">مسار الرحلة</th>
                  <th style={{ backgroundColor: "#e4f6f8", color: "black", padding: "8px", border: "1px solid #000" }}>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ textAlign: "center", fontWeight: "bold", color: "green", padding: "10px", border: "1px solid #000" }}>
                    <span>{startLocation}</span>{" "}
                    <span style={{ backgroundColor: "#e4f6f8", color: "#155724", fontSize: "11px", fontWeight: "bold", padding: "3px 10px", borderRadius: "999px", marginLeft: "6px", border: "1px solid #155724" }}>Start</span>
                  </td>
                  <td style={{ textAlign: "center", fontWeight: "bold", background: "black", color: "white", padding: "10px", border: "1px solid #000", width: "80px" }}>TO</td>
                  <td style={{ textAlign: "center", fontWeight: "bold", color: "red", padding: "10px", border: "1px solid #000" }}>
                    <span>{finishLocation}</span>{" "}
                    <span style={{ backgroundColor: "#f8d7da", color: "#721c24", fontSize: "11px", fontWeight: "bold", padding: "3px 10px", borderRadius: "999px", marginLeft: "6px", border: "1px solid #721c24" }}>Finish</span>
                  </td>
                  <td style={{ textAlign: "center", fontWeight: "bold", color: "red", fontSize: "16px", border: "1px solid #000", padding: "10px" }}>
                    {trip?.departure_time && new Date(trip.departure_time).toLocaleDateString("ar-EG")}
                  </td>
                </tr>
              </tbody>
            </table>

            <table className="passenger-table" style={{ borderCollapse: "collapse", direction: "ltr" }}>
              <thead>
                <tr>
                  <th>SR.NO</th>
                  <th>PASSENGER NAME #</th>
                  <th>PASSENGR IDENTY #</th>
                  <th>NATIONALITY</th>
                </tr>
                <tr>
                  <th>الرقم</th>
                  <th>اسم الراكب</th>
                  <th>رقم الهوية</th>
                  <th>الجنسية</th>
                </tr>
              </thead>
              <tbody>
                {passengers.map((p, i) => (
                  <tr key={p.id}>
                    <td>{i + 1}</td>
                    <td>{p.name}</td>
                    <td>{p.national_id}</td>
                    <td>{p.nationality}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="header-image duo">
              {safeImgSrc(driver?.driver_profile?.pdf_image || trip?.driver?.driver_profile?.pdf_image) && <img src={safeImgSrc(driver?.driver_profile?.pdf_image || trip?.driver?.driver_profile?.pdf_image)} crossOrigin="anonymous" alt="Driver PDF" />}
              {safeImgSrc(vehicle?.stamp_photo) && <img src={safeImgSrc(vehicle?.stamp_photo)} crossOrigin="anonymous" alt="Stamp" />}
            </div>
            <div style={{ backgroundColor: "#ffeb3b", color: "red", fontWeight: "bold", fontSize: "16px", textAlign: "center", padding: "10px", borderBottom: "3px solid red" }}>
              {pdfData?.footer_message || " ----"}
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
};

export default TransportContract;