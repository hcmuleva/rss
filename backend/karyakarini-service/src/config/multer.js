const multer = require('multer');

const storage = multer.memoryStorage();

const allowedMimePrefixes = ['image/', 'video/'];
const allowedExactMimes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);

const fileFilter = (req, file, cb) => {
  const mime = String(file?.mimetype || '').toLowerCase();
  if (allowedMimePrefixes.some((prefix) => mime.startsWith(prefix)) || allowedExactMimes.has(mime)) {
    cb(null, true);
    return;
  }
  cb(new Error('Unsupported file type'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

module.exports = upload;
