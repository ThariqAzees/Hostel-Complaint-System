"use client";

import React, { useState, useRef } from "react";
import styles from "./new-complaint.module.css";
import { Image, X, Check, ShieldAlert, Send } from "lucide-react";
import { useRouter } from "next/navigation";

interface ComplaintFormProps {
  student: {
    name: string;
    registrationNumber: string | null;
    roomNumber: string | null;
  };
}

export default function ComplaintForm({ student }: ComplaintFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Electrical");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const categories = [
    "Electrical",
    "Plumbing",
    "Carpentry",
    "Wi-Fi",
    "Housekeeping",
    "Others",
  ];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    if (!file) return;

    // Validate type on client
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Unsupported format. Please select a JPEG, PNG, or WebP image.");
      return;
    }

    // Validate size on client (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("Image size exceeds 5MB limit.");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Client-side validations
    if (title.trim().length < 5) {
      setError("Title must be at least 5 characters long.");
      return;
    }
    if (description.trim().length < 15) {
      setError("Description must be at least 15 characters long.");
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("category", category);
      formData.append("description", description);
      if (imageFile) {
        formData.append("image", imageFile);
      }

      const response = await fetch("/api/student/complaints", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to submit complaint.");
        setIsLoading(false);
        return;
      }

      setSuccess(`Complaint submitted successfully! Code: ${data.complaintCode}`);
      
      // Prefetch dashboard
      router.prefetch("/student/dashboard");
      
      setTimeout(() => {
        router.push("/student/dashboard");
      }, 1500);
    } catch (err) {
      console.error(err);
      setError("A connection error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h1 className={styles.title}>Raise a New Complaint</h1>
        <p className={styles.subtitle}>
          Please describe the issue in detail. The residential counselor (RC) will be notified immediately.
        </p>
      </div>

      {/* Read-only student profile summary box */}
      <div className={styles.studentBox}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Student Name</span>
          <span className={styles.metaValue}>{student.name}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Registration Number</span>
          <span className={styles.metaValue}>{student.registrationNumber || "—"}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Room Number</span>
          <span className={styles.metaValue}>{student.roomNumber || "—"}</span>
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="title" className={styles.label}>
            Complaint Title
          </label>
          <input
            type="text"
            id="title"
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Bathroom light switch spark"
            required
            maxLength={100}
            disabled={isLoading}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="category" className={styles.label}>
            Category
          </label>
          <select
            id="category"
            className={styles.select}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={isLoading}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="description" className={styles.label}>
            Description / Location Details
          </label>
          <textarea
            id="description"
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue in detail (e.g. locations, symptoms, urgency)..."
            required
            maxLength={1000}
            disabled={isLoading}
          />
        </div>

        {/* Optional Image Upload */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Upload Photo (Optional)</label>
          {!imagePreview ? (
            <label className={styles.imageUploadZone}>
              <input
                type="file"
                ref={fileInputRef}
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handleImageChange}
                style={{ display: "none" }}
                disabled={isLoading}
              />
              <Image size={32} className={styles.uploadIcon} />
              <span className={styles.uploadTitle}>Choose an image to upload</span>
              <span className={styles.uploadSub}>JPEG, PNG, WebP up to 5MB</span>
            </label>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div className={styles.previewContainer}>
                <img
                  src={imagePreview}
                  alt="Complaint Preview"
                  className={styles.previewImage}
                />
                <button
                  type="button"
                  className={styles.btnRemoveImage}
                  onClick={handleRemoveImage}
                  disabled={isLoading}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className={styles.errorBox}>
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className={styles.successBox}>
            <Check size={18} style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnOutline}`}
            onClick={() => router.push("/student/dashboard")}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className={`${styles.loadingSpinner} spinner`} />
            ) : (
              <>
                <Send size={16} />
                <span>Submit Complaint</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
