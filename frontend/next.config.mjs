/**
 * Обычная сборка (`npm run build`): Node/SSR-совместимый бандл для `next start` / Docker.
 * Статический экспорт для GitHub Pages: `npm run build:static` (NEXT_STATIC_EXPORT=1, NEXT_PUBLIC_BASE_PATH=/devor).
 */
const isStaticExport = process.env.NEXT_STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isStaticExport ? { output: "export" } : {}),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  trailingSlash: isStaticExport,
  images: { unoptimized: isStaticExport },
};

export default nextConfig;
