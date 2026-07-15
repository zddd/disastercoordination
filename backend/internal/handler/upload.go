package handler

import (
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AllowedMimeTypes defines the whitelist of acceptable upload file types.
// Only common media formats are allowed to prevent executable/malicious file upload.
// Adding new types requires explicit review.
var AllowedMimeTypes = map[string]string{
	"image/jpeg":      ".jpg",
	"image/png":       ".png",
	"image/webp":      ".webp",
	"video/mp4":       ".mp4",
	"audio/mpeg":      ".mp3",
	"audio/wav":       ".wav",
}

const (
	// MaxFileSize is the maximum allowed size per single uploaded file (10MB).
	MaxFileSize = 10 * 1024 * 1024

	// MaxRequestBodySize is the maximum total upload request body size (50MB).
	MaxRequestBodySize = 50 * 1024 * 1024

	// UploadRateLimitPerMinute limits uploads per IP per minute to prevent abuse.
	UploadRateLimitPerMinute = 30
)

// uploadRateTracker tracks upload frequency per IP for rate limiting.
// In-memory only for MVP; full version should use Redis.
var (
	uploadRateMu    sync.Mutex
	uploadRateMap   = make(map[string]*uploadRateEntry)
)

type uploadRateEntry struct {
	count     int
	resetAt   int64
}

// UploadHandler handles file uploads with security hardening against abuse.
// Security measures:
//   1. File type whitelist (AllowedMimeTypes)
//   2. File size limits (MaxFileSize per file, MaxRequestBodySize total)
//   3. Path traversal prevention (reject .., /, \0 in filenames)
//   4. UUID renaming (original filename never stored)
//   5. Magic bytes validation (verify real type, not trust Content-Type)
//   6. IP-based rate limiting (prevent flood uploads)
type UploadHandler struct {
	uploadDir   string // Local fallback storage directory
	useMinIO    bool   // Whether MinIO is configured
	minioBucket string
}

// NewUploadHandler creates an UploadHandler.
// uploadDir is the local fallback directory when MinIO is unavailable.
func NewUploadHandler(uploadDir string) *UploadHandler {
	// Ensure upload directory exists
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		slog.Error("failed to create upload directory", "path", uploadDir, "error", err)
	}
	return &UploadHandler{uploadDir: uploadDir}
}

// Upload handles POST /api/v1/files/upload
// Accepts multipart/form-data with a "file" field.
func (h *UploadHandler) Upload(c *gin.Context) {
	clientIP := c.ClientIP()

	// Rate limiting check
	if !h.checkRateLimit(clientIP) {
		slog.Warn("upload rate limit exceeded", "client_ip", clientIP)
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "upload rate limit exceeded, try again later"})
		return
	}

	// Limit request body size
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, MaxRequestBodySize)

	// Get the uploaded file
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file field is required"})
		return
	}
	defer file.Close()

	// Security check 1: File size
	if header.Size > MaxFileSize {
		slog.Warn("upload file too large",
			"size", header.Size,
			"max", MaxFileSize,
			"client_ip", clientIP,
		)
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{
			"error":     "file too large",
			"max_size":  MaxFileSize,
			"your_size": header.Size,
		})
		return
	}

	// Security check 2: Filename safety — reject path traversal attempts
	originalName := header.Filename
	if containsPathTraversal(originalName) {
		slog.Warn("path traversal attempt in upload",
			"filename", originalName,
			"client_ip", clientIP,
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid filename"})
		return
	}

	// Read first 512 bytes for magic bytes validation
	buf := make([]byte, 512)
	n, err := file.Read(buf)
	if err != nil && err != io.EOF {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read file"})
		return
	}
	buf = buf[:n]

	// Security check 3: Detect real content type from magic bytes
	detectedType := http.DetectContentType(buf)
	ext, ok := AllowedMimeTypes[detectedType]
	if !ok {
		slog.Warn("upload file type not allowed",
			"detected_type", detectedType,
			"allowed_types", getAllowedTypes(),
			"client_ip", clientIP,
		)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":         "file type not allowed",
			"detected_type": detectedType,
		})
		return
	}

	// Security check 4: Also verify the declared Content-Type
	declaredType := header.Header.Get("Content-Type")
	if declaredType != "" && declaredType != detectedType && !isSubType(declaredType, detectedType) {
		slog.Warn("upload content-type mismatch",
			"declared", declaredType,
			"detected", detectedType,
			"client_ip", clientIP,
		)
		// Still accept if magic bytes are valid — Content-Type header can be wrong
	}

	// Generate UUID-based filename — never expose original filename
	safeFilename := uuid.New().String() + ext
	slog.Debug("upload file", "original", originalName, "safe", safeFilename, "type", detectedType, "size", header.Size)

	// Seek back to start for full read
	file.Seek(0, io.SeekStart)

	// Store file locally (MVP fallback; full version goes to MinIO)
	localPath := filepath.Join(h.uploadDir, safeFilename)
	dst, err := os.Create(localPath)
	if err != nil {
		slog.Error("failed to create upload file", "path", localPath, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "upload failed"})
		return
	}
	defer dst.Close()

	written, err := io.Copy(dst, file)
	if err != nil {
		os.Remove(localPath) // Clean up partial file
		slog.Error("failed to write upload file", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "upload failed"})
		return
	}

	slog.Info("file uploaded",
		"file_id", safeFilename,
		"type", detectedType,
		"size", written,
		"original", originalName,
		"client_ip", clientIP,
	)

	c.JSON(http.StatusCreated, gin.H{
		"file_id":    safeFilename,
		"url":        "/files/" + safeFilename,
		"type":       detectedType,
		"size":       written,
	})
}

// checkRateLimit implements IP-based upload rate limiting.
func (h *UploadHandler) checkRateLimit(ip string) bool {
	uploadRateMu.Lock()
	defer uploadRateMu.Unlock()

	now := time.Now().Unix()
	entry, exists := uploadRateMap[ip]
	if !exists || now >= entry.resetAt {
		uploadRateMap[ip] = &uploadRateEntry{count: 1, resetAt: now + 60}
		return true
	}

	if entry.count >= UploadRateLimitPerMinute {
		return false
	}

	entry.count++
	return true
}

// containsPathTraversal checks for common path traversal patterns in filenames.
// Rejects: ../, ..\, null bytes, leading /
func containsPathTraversal(name string) bool {
	if strings.Contains(name, "..") {
		return true
	}
	if strings.ContainsRune(name, 0) { // Null byte
		return true
	}
	if strings.HasPrefix(name, "/") || strings.HasPrefix(name, "\\") {
		return true
	}
	return false
}

// isSubType checks if declared type is a subtype of detected type.
func isSubType(declared, detected string) bool {
	// Simple check: both should have same major type
	declaredMajor := strings.SplitN(declared, "/", 2)[0]
	detectedMajor := strings.SplitN(detected, "/", 2)[0]
	return declaredMajor == detectedMajor
}

// getAllowedTypes returns a comma-separated list of allowed MIME types for error messages.
func getAllowedTypes() string {
	types := make([]string, 0, len(AllowedMimeTypes))
	for t := range AllowedMimeTypes {
		types = append(types, t)
	}
	return strings.Join(types, ", ")
}

// ServeFile serves uploaded files by file ID.
// GET /files/:id
// File IDs are UUID-based: {uuid}.{ext} — validated by checking the UUID prefix.
func (h *UploadHandler) ServeFile(c *gin.Context) {
	fileID := c.Param("id")

	// Extract the UUID portion before the extension
	base := strings.TrimSuffix(fileID, filepath.Ext(fileID))

	// Security: only allow UUID-format file IDs
	if _, err := uuid.Parse(base); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file id"})
		return
	}

	// Check for path traversal in file ID (belt and suspenders)
	if containsPathTraversal(fileID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file id"})
		return
	}

	localPath := filepath.Join(h.uploadDir, fileID)
	if _, err := os.Stat(localPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}

	c.File(localPath)
}

// cleanupUploadRateLimit runs periodically to prevent unbounded memory growth.
func cleanupUploadRateLimit() {
	for {
		time.Sleep(10 * time.Minute)
		uploadRateMu.Lock()
		now := time.Now().Unix()
		for ip, entry := range uploadRateMap {
			if now >= entry.resetAt {
				delete(uploadRateMap, ip)
			}
		}
		uploadRateMu.Unlock()
	}
}

func init() {
	// Start rate limit cleanup goroutine
	go cleanupUploadRateLimit()
	// Ensure local upload directory exists
	os.MkdirAll("./uploads", 0755)
}
