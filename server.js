require('dotenv').config();

const express = require('express');
const ImageKit = require('imagekit');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// ======================================
// عرض ملفات الموقع
// index.html
// admin.html
// css/js/images/logos/products...
// ======================================

app.use(express.static(__dirname));


// ======================================
// IMAGE UPLOAD SETTINGS
// ======================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});


const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});


// ======================================
// HEALTH CHECK
// ======================================

app.get('/api/health', (req, res) => {
  res.json({
    ok: true
  });
});


// ======================================
// PRODUCT IMAGE UPLOAD
// ======================================

app.post(
  '/api/upload-image',
  upload.single('file'),
  async (req, res) => {

    try {

      if (!req.file) {
        return res.status(400).json({
          error: 'No image uploaded'
        });
      }

      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({
          error: 'Only image files are allowed'
        });
      }

      const safeName =
        req.file.originalname.replace(
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


      res.json({
        success: true,
        url: result.url,
        fileId: result.fileId
      });

    } catch (error) {

      console.error(
        'ImageKit server upload error:',
        error
      );

      res.status(500).json({
        error:
          error.message ||
          'Image upload failed'
      });

    }

  }
);


// ======================================
// MAIN WEBSITE
// ======================================

app.get('/', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'index.html')
  );
});


// ======================================
// SERVER
// ======================================

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `Server running on port ${PORT}`
  );
});