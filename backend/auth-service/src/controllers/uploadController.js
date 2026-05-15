/**
 * =====================================================================
 * Upload Controller
 * Company: emeelan
 * =====================================================================
 * Generic file upload controller for photos and documents
 */

// No database imports needed for basic upload

/**
 * @route   POST /api/upload/photo
 * @desc    Upload photo to S3
 * @access  Private
 */
exports.uploadPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const folder = req.body.folder || 'general';
    const { uploadProfilePhoto } = require('../config/s3');
    const fileName = `${folder}/${Date.now()}-${req.file.originalname}`;
    const photoUrl = await uploadProfilePhoto(
      req.file.buffer,
      fileName,
      req.file.mimetype
    );

    return res.status(200).json({
      success: true,
      url: photoUrl,
      message: 'Photo uploaded successfully'
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload photo'
    });
  }
};

/**
 * @route   POST /api/upload/document
 * @desc    Upload document to S3
 * @access  Private
 */
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const folder = req.body.folder || 'documents';
    const { uploadProfilePhoto } = require('../config/s3');
    const fileName = `${folder}/${Date.now()}-${req.file.originalname}`;
    const documentUrl = await uploadProfilePhoto(
      req.file.buffer,
      fileName,
      req.file.mimetype
    );

    return res.status(200).json({
      success: true,
      url: documentUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      message: 'Document uploaded successfully'
    });
  } catch (error) {
    console.error('Upload document error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload document'
    });
  }
};
