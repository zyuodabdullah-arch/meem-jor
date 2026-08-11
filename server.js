require('dotenv').config();

const express = require('express');
const ImageKit = require('imagekit');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();

// ==========================================
// Middleware
// ==========================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ==========================================
// ImageKit Configuration
// ==========================================

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});


// ==========================================
// Multer - receive image in memory
// ==========================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 20 * 1024 * 1024 // 20 MB
  },

  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});


// ==========================================
// Health Check
// ==========================================

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'MEEM JOR server is running'
  });
});


// ==========================================
// ImageKit authentication
// ==========================================

app.get('/api/imagekit-auth', (req, res) => {
  try {

    const authenticationParameters =
      imagekit.getAuthenticationParameters();

    res.json(authenticationParameters);

  } catch (error) {

    console.error('ImageKit auth error:', error);

    res.status(500).json({
      error: 'Failed to generate ImageKit authentication'
    });
  }
});


// ==========================================
// Upload image to ImageKit
// ==========================================

app.post(
  '/api/upload-image',
  upload.single('file'),
  async (req, res) => {

    try {

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No image uploaded'
        });
      }

      const originalName =
        req.file.originalname || 'product-image.jpg';

      const safeName = originalName.replace(
        /[^a-zA-Z0-9._-]/g,
        '_'
      );

      const fileName =
        Date.now() + '_' + safeName;


      const result = await imagekit.upload({
        file: req.file.buffer,
        fileName: fileName,
        folder: '/products',
        useUniqueFileName: true
      });


      console.log('Image uploaded:', result.url);


      res.json({
        success: true,

        url: result.url,

        fileId: result.fileId,

        name: result.name,

        thumbnailUrl: result.thumbnailUrl || null
      });

    } catch (error) {

      console.error(
        'ImageKit upload error:',
        error
      );

      res.status(500).json({
        success: false,

        error:
          error.message ||
          'Image upload failed'
      });
    }
  }
);


// ==========================================
// Serve website files
// ==========================================

// يسمح بعرض:
// index.html
// admin.html
// data.js
// firebase-config.js
// logos/
// products/
// etc.

app.use(express.static(__dirname));


// ==========================================
// Main Website
// ==========================================

app.get('/', (req, res) => {

  res.sendFile(
    path.join(__dirname, 'index.html')
  );

});


// ==========================================
// Admin Page
// ==========================================

app.get('/admin', (req, res) => {

  res.sendFile(
    path.join(__dirname, 'admin.html')
  );

});


// ==========================================
// 404
// مهم: لازم يكون آخر Route
// ==========================================

app.use((req, res) => {

  res.status(404).send(
    '404 - Page Not Found'
  );

});


// ==========================================
// Start Server
// ==========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {

  console.log(
    `MEEM JOR server running on port ${PORT}`
  );

  console.log(
    `ImageKit endpoint: ${
      process.env.IMAGEKIT_URL_ENDPOINT
        ? 'Configured'
        : 'Missing'
    }`
  );

});
