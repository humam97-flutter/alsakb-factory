import type { NextConfig } from "next";

// مخططات DXF الكبيرة تنرسل كأشكال، فنرفع حد الطلب
const config: NextConfig = { experimental: { serverActions: { bodySizeLimit: "4mb" } } };

export default config;
