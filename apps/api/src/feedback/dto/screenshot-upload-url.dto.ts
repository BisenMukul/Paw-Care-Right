/**
 * `POST /v1/feedback/screenshot-upload-url` request body (T104 plan D2/D4):
 * intentionally empty. A feedback screenshot is always re-encoded to JPEG
 * by the existing `compressImage` helper before upload (mirrors the
 * pet-photo pipeline's own re-encode step), so there is no client-supplied
 * content-type/length to validate here -- the presign always issues an
 * `image/jpeg` PUT URL under the caller's own `feedback/<userId>/`
 * namespace. The app-wide `forbidNonWhitelisted` pipe still rejects any
 * unexpected body key.
 */
export class ScreenshotUploadUrlDto {}
