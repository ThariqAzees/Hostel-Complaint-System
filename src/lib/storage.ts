import { BlobServiceClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";
import fs from "fs";
import path from "path";

// Allowed MIME types and max size limit (5 MB)
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || "complaints";

/**
 * Returns an instance of BlobServiceClient if Azure credentials exist in env.
 * Supports both Connection String and Managed Identity (DefaultAzureCredential).
 */
function getBlobServiceClient(): BlobServiceClient | null {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (connectionString) {
    return BlobServiceClient.fromConnectionString(connectionString);
  }

  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  if (accountName) {
    const blobUrl = `https://${accountName}.blob.core.windows.net`;
    return new BlobServiceClient(blobUrl, new DefaultAzureCredential());
  }

  return null;
}

/**
 * Uploads a complaint image buffer to Azure Blob Storage (or local disk in development).
 * In NODE_ENV=production, throws an error if Azure Blob Storage is not configured.
 * Returns the access URL string to be saved in the database.
 */
export async function uploadComplaintImage(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  // Server-side validation
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error("Image file size exceeds 5MB limit.");
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error("Unsupported image format. Allowed formats: JPEG, PNG, WebP.");
  }

  const blobServiceClient = getBlobServiceClient();

  if (blobServiceClient) {
    // === Azure Blob Storage Upload ===
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    await containerClient.createIfNotExists();

    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: mimeType,
      },
    });

    return blockBlobClient.url;
  } else {
    // Fail immediately in production if Azure Blob Storage is missing
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Azure Blob Storage is not configured in production. Please set AZURE_STORAGE_ACCOUNT_NAME or AZURE_STORAGE_CONNECTION_STRING."
      );
    }

    // === Local Disk Fallback (Development Only) ===
    const uploadDir = path.join(process.cwd(), "public", "uploads", "complaints");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, fileName);
    await fs.promises.writeFile(filePath, buffer);
    return `/uploads/complaints/${fileName}`;
  }
}

/**
 * Downloads a complaint image from Azure Blob Storage or local disk.
 * Used by the authenticated image proxy route to stream images securely.
 */
export async function downloadComplaintImage(
  imageUrl: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!imageUrl) return null;

  try {
    const blobServiceClient = getBlobServiceClient();

    if (blobServiceClient && imageUrl.includes(".blob.core.windows.net")) {
      const urlObj = new URL(imageUrl);
      const pathnameParts = urlObj.pathname.split("/").filter(Boolean);
      if (pathnameParts.length >= 2) {
        const containerName = pathnameParts[0];
        const blobName = pathnameParts.slice(1).join("/");
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        if (await blockBlobClient.exists()) {
          const downloadResponse = await blockBlobClient.downloadToBuffer();
          const props = await blockBlobClient.getProperties();
          const mimeType = props.contentType || "image/jpeg";
          return { buffer: downloadResponse, mimeType };
        }
      }
    } else if (imageUrl.startsWith("/uploads/complaints/")) {
      const fileName = path.basename(imageUrl);
      const filePath = path.join(process.cwd(), "public", "uploads", "complaints", fileName);
      if (fs.existsSync(filePath)) {
        const buffer = await fs.promises.readFile(filePath);
        const ext = path.extname(fileName).toLowerCase();
        let mimeType = "image/jpeg";
        if (ext === ".png") mimeType = "image/png";
        if (ext === ".webp") mimeType = "image/webp";
        return { buffer, mimeType };
      }
    }
  } catch (err) {
    console.error("Error downloading complaint image:", err);
  }

  return null;
}

/**
 * Deletes a complaint image from Azure Blob Storage or local disk.
 * Used primarily as a compensating transaction if database creation fails after blob upload.
 */
export async function deleteComplaintImage(imageUrl: string): Promise<void> {
  if (!imageUrl) return;

  try {
    const blobServiceClient = getBlobServiceClient();

    if (blobServiceClient && imageUrl.includes(".blob.core.windows.net")) {
      const urlObj = new URL(imageUrl);
      const pathnameParts = urlObj.pathname.split("/").filter(Boolean);
      if (pathnameParts.length >= 2) {
        const containerName = pathnameParts[0];
        const blobName = pathnameParts.slice(1).join("/");
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.deleteIfExists();
      }
    } else if (imageUrl.startsWith("/uploads/complaints/")) {
      const fileName = path.basename(imageUrl);
      const filePath = path.join(process.cwd(), "public", "uploads", "complaints", fileName);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    }
  } catch (err) {
    console.error("Compensating cleanup error in deleteComplaintImage:", err);
  }
}
