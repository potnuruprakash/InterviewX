/**
 * Storage Service Abstraction
 *
 * Provides a unified API for managing files (resumes, audio recordings, video clips).
 * Defaults to the local filesystem for seamless zero-dependency development,
 * with architecture prepared for Cloudinary / AWS S3 / Cloudflare R2 object storage.
 *
 * Methods:
 *   upload(fileBufferOrPath, destinationKey, options) -> Promise<{ key, url, size }>
 *   getUrl(key) -> string
 *   delete(key) -> Promise<boolean>
 *   exists(key) -> Promise<boolean>
 */

const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'));

// Ensure local upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (err) {
    console.warn('[Storage] Could not create upload directory:', err.message);
  }
}

class StorageService {
  constructor() {
    this.provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
  }

  /**
   * Upload or persist a file.
   *
   * @param {Buffer|string} input - File buffer or source path
   * @param {string} destinationKey - Relative filename / storage key
   * @param {Object} [options]
   * @returns {Promise<{ key: string, url: string, size: number }>}
   */
  async upload(input, destinationKey, options = {}) {
    const filename = path.basename(destinationKey);
    const targetPath = path.join(UPLOAD_DIR, filename);

    if (Buffer.isBuffer(input)) {
      await fs.promises.writeFile(targetPath, input);
      const stat = await fs.promises.stat(targetPath);
      return {
        key: filename,
        url: this.getUrl(filename),
        size: stat.size,
      };
    } else if (typeof input === 'string') {
      // If it's already an existing file, copy or verify
      if (input !== targetPath && fs.existsSync(input)) {
        await fs.promises.copyFile(input, targetPath);
      }
      const stat = await fs.promises.stat(targetPath);
      return {
        key: filename,
        url: this.getUrl(filename),
        size: stat.size,
      };
    }

    throw new Error('Unsupported storage input type.');
  }

  /**
   * Get public or internal URL for a file key.
   *
   * @param {string} key
   * @returns {string}
   */
  getUrl(key) {
    if (!key) return null;
    const filename = path.basename(key);
    const backendUrl = (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/+$/, '');
    return `${backendUrl}/uploads/${filename}`;
  }

  /**
   * Delete a file by key.
   *
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async delete(key) {
    if (!key) return false;
    const filename = path.basename(key);
    const targetPath = path.join(UPLOAD_DIR, filename);

    try {
      if (fs.existsSync(targetPath)) {
        await fs.promises.unlink(targetPath);
        return true;
      }
      return false;
    } catch (err) {
      console.warn(`[Storage] Failed to delete file ${filename}:`, err.message);
      return false;
    }
  }

  /**
   * Check if a file exists by key.
   *
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    if (!key) return false;
    const filename = path.basename(key);
    const targetPath = path.join(UPLOAD_DIR, filename);
    return fs.existsSync(targetPath);
  }
}

const storageService = new StorageService();
module.exports = storageService;
