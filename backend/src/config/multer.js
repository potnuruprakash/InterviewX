const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `resume-${uniqueSuffix}${ext}`);
  },
});

const allowedMimeTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('INVALID_FILE_TYPE: Only PDF and DOCX files are allowed'), false);
  }
};

const resumeUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

const chatAttachmentMimeTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/json',
  'text/csv',
];

const chatAttachmentExtensions = ['.pdf', '.doc', '.docx', '.txt', '.md', '.markdown', '.json', '.csv'];

const chatAttachmentFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (chatAttachmentMimeTypes.includes(file.mimetype) || chatAttachmentExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('INVALID_FILE_TYPE: Allowed formats: PDF, DOCX, TXT, MD, JSON, CSV'), false);
  }
};

const chatAttachmentUpload = multer({
  storage,
  fileFilter: chatAttachmentFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB
  },
});

module.exports = { resumeUpload, chatAttachmentUpload };
