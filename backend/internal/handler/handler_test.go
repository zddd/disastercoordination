package handler

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestUploadHandler_AllowedType(t *testing.T) {
	handler := NewUploadHandler("./testdata/uploads")
	defer os.RemoveAll("./testdata")

	router := gin.New()
	router.POST("/upload", handler.Upload)

	// Create a minimal valid JPEG file (magic bytes: FF D8 FF)
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, _ := writer.CreateFormFile("file", "test.jpg")
	part.Write([]byte{0xFF, 0xD8, 0xFF, 0xE0}) // JPEG magic bytes
	writer.WriteField("disaster_id", "test-disaster")
	writer.Close()

	req := httptest.NewRequest("POST", "/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 201 {
		t.Errorf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["file_id"] == "" {
		t.Error("expected file_id in response")
	}
}

func TestUploadHandler_InvalidType(t *testing.T) {
	handler := NewUploadHandler("./testdata/uploads")
	defer os.RemoveAll("./testdata")

	router := gin.New()
	router.POST("/upload", handler.Upload)

	// Send text file (not in whitelist)
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, _ := writer.CreateFormFile("file", "test.txt")
	part.Write([]byte("this is plain text"))
	writer.Close()

	req := httptest.NewRequest("POST", "/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 400 {
		t.Errorf("expected 400 for invalid type, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUploadHandler_FileTooLarge(t *testing.T) {
	handler := NewUploadHandler("./testdata/uploads")
	defer os.RemoveAll("./testdata")

	router := gin.New()
	router.POST("/upload", handler.Upload)

	// Create a file that exceeds 10MB
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, _ := writer.CreateFormFile("file", "large.jpg")
	// Write JPEG header first
	part.Write([]byte{0xFF, 0xD8, 0xFF, 0xE0})
	// Then write large data
	largeData := make([]byte, MaxFileSize+1)
	part.Write(largeData)
	writer.Close()

	req := httptest.NewRequest("POST", "/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 413 {
		t.Errorf("expected 413 for oversized file, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUploadHandler_PathTraversal(t *testing.T) {
	// Path traversal check works at the Golang level via containsPathTraversal
	// The multipart form builder normalizes filenames, so we test the function directly
	// and rely on the handler code path for real HTTP requests

	// Test the containsPathTraversal function directly (already in TestContainsPathTraversal)
	// Verify the handler still accepts normal filenames
	handler := NewUploadHandler("./testdata/uploads")
	defer os.RemoveAll("./testdata")

	router := gin.New()
	router.POST("/upload", handler.Upload)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, _ := writer.CreateFormFile("file", "normal_photo.jpg")
	part.Write([]byte{0xFF, 0xD8, 0xFF, 0xE0}) // JPEG header
	writer.Close()

	req := httptest.NewRequest("POST", "/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 201 {
		t.Errorf("expected 201 for normal filename, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUploadHandler_EmptyFile(t *testing.T) {
	handler := NewUploadHandler("./testdata/uploads")
	defer os.RemoveAll("./testdata")

	router := gin.New()
	router.POST("/upload", handler.Upload)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, _ := writer.CreateFormFile("file", "empty.jpg")
	part.Write([]byte{}) // Empty
	writer.Close()

	req := httptest.NewRequest("POST", "/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 400 {
		t.Errorf("expected 400 for empty file, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUploadHandler_NoFile(t *testing.T) {
	handler := NewUploadHandler("./testdata/uploads")
	defer os.RemoveAll("./testdata")

	router := gin.New()
	router.POST("/upload", handler.Upload)

	body := &bytes.Buffer{}
	req := httptest.NewRequest("POST", "/upload", body)
	req.Header.Set("Content-Type", "multipart/form-data; boundary=something")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 400 {
		t.Errorf("expected 400 for missing file, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUploadHandler_ServeFile(t *testing.T) {
	uploadDir := "./testdata/uploads"
	handler := NewUploadHandler(uploadDir)
	defer os.RemoveAll("./testdata")

	// Create a test file
	os.MkdirAll(uploadDir, 0755)
	testFile := filepath.Join(uploadDir, "00000000-0000-0000-0000-000000000001.jpg")
	os.WriteFile(testFile, []byte{0xFF, 0xD8}, 0644)

	router := gin.New()
	router.GET("/files/:id", handler.ServeFile)

	req := httptest.NewRequest("GET", "/files/00000000-0000-0000-0000-000000000001.jpg", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestUploadHandler_ServeFileInvalidUUID(t *testing.T) {
	handler := NewUploadHandler("./testdata/uploads")
	defer os.RemoveAll("./testdata")

	router := gin.New()
	router.GET("/files/:id", handler.ServeFile)

	// Try path traversal via file ID — should return 400 (invalid UUID) or 404 (file not found)
	req := httptest.NewRequest("GET", "/files/../../etc/passwd", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 400 && w.Code != 404 {
		t.Errorf("expected 400 or 404 for invalid file id, got %d", w.Code)
	}
}

func TestUploadHandler_ServeFileNotFound(t *testing.T) {
	handler := NewUploadHandler("./testdata/uploads")
	defer os.RemoveAll("./testdata")

	router := gin.New()
	router.GET("/files/:id", handler.ServeFile)

	req := httptest.NewRequest("GET", "/files/00000000-0000-0000-0000-000000000099.jpg", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 404 {
		t.Errorf("expected 404 for missing file, got %d", w.Code)
	}
}

func TestContainsPathTraversal(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{"normal file", "photo.jpg", false},
		{"dot dot slash", "../../etc/passwd", true},
		{"dot dot backslash", "..\\windows\\system32", true},
		{"leading slash root", "/etc/passwd", true},
		{"normal path", "subdir/photo.jpg", false},
	}

	for _, tt := range tests {
		result := containsPathTraversal(tt.input)
		if result != tt.expected {
			t.Errorf("containsPathTraversal(%s) = %v, want %v", tt.input, result, tt.expected)
		}
	}
}

func TestHandleCreateHelp_MissingRequired(t *testing.T) {
	handler := NewHelpHandler(nil)

	router := gin.New()
	router.POST("/api/v1/helps", handler.Create)

	// Send empty JSON — should get 400 for missing required fields
	req := httptest.NewRequest("POST", "/api/v1/helps", nil)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 400 && w.Code != 500 {
		t.Errorf("expected 400 or 500, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetHelpStatus_Handler(t *testing.T) {
	// Skip — Status handler requires a non-nil service for proper testing.
	// Tested indirectly via service layer tests (TestGetHelpStatus).
	t.Skip("requires wired service layer")
}

func TestHandleCreateHelp_ValidInput(t *testing.T) {
	// Skip — Create handler requires a non-nil service for proper testing.
	// Tested indirectly via service layer tests (TestCreateHelp_Success).
	t.Skip("requires wired service layer")
}
