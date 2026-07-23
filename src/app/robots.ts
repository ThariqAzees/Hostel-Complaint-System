import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ech-hostel-complaint-app.purplebeach-66ccd89a.centralindia.azurecontainerapps.io";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login"],
        disallow: [
          "/student/",
          "/rc/",
          "/admin/",
          "/api/",
          "/change-password/",
          "/lan/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
