const express = require('express');
const { engine } = require('express-handlebars');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const shortid = require('shortid');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

mongoose.connect(`${process.env.DATABASE_URL || 'mongodb://localhost/urlShortener'}`, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const urlSchema = new mongoose.Schema({
    originalUrl: String,
    shortUrl: String,
    userId: String,
    fileId: String,
    isFileUpload: { type: Boolean, default: false },
    createdAt: { type: Date, expires: '2m', default: Date.now },
});

const Url = mongoose.model('Url', urlSchema);

app.engine('handlebars', engine({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');

// Middleware to parse URL-encoded and JSON bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function (req, file, cb) {
        cb(null, file.originalname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 30 * 1000000 }, // 30MB file size limit
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
}).single('myFile');

function checkFileType(file, cb) {
    const filetypes = /pdf|csv|xls|xlsx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: PDFs, CSVs, and Excel files only!');
    }
}

app.post('/upload', async (req, res, next) => {
    try {
        if (!req.headers.referer) {
            return res.status(400).json({ error: 'Referer not found!' });
        }
        const url = new URL(req.headers.referer);
        const userId = url.searchParams.get('userId');
        const fileId = url.searchParams.get('fileId');

        const shortUrlDetails = await Url.findOne({ userId: userId, fileId: fileId });

        if (!shortUrlDetails) {
            return res.redirect(`/404.html?name=${encodeURIComponent('Url is expired!')}`);
        }
        if (shortUrlDetails.isFileUpload) {
            return res.redirect(`/404.html?name=${encodeURIComponent('File Already Uploaded!')}`);
        }

        upload(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            if (!req.file) {
                return res.status(400).json({ error: 'No file selected' });
            }
            await Url.updateOne({ userId: userId, fileId: fileId }, { $set: { isFileUpload: true } }).exec();
            res.json({ message: `File uploaded: ${req.file.filename}` });
        });
    } catch (error) {
        next(error);
    }
});

app.post('/shorten', async (req, res, next) => {
    try {
        const { originalUrl } = req.body;

        if (!originalUrl) {
            return res.status(400).json({ error: 'Original URL is required' });
        }
        const shortUrl = shortid.generate();
        await Url.create({ ...req.body, shortUrl });
        const baseUrl = req.protocol + '://' + req.get('host');
        const fullShortUrl = `${baseUrl}/shortAccess/${shortUrl}`;
        console.log(`Original URL: ${originalUrl}, Short URL: ${fullShortUrl}`);
        res.json({ originalUrl, shortUrl: fullShortUrl });
    } catch (error) {
        next(error);
    }
});

app.get('/shortAccess/:shortUrl', async (req, res, next) => {
    try {
        const { shortUrl } = req.params;

        const url = await Url.findOne({ shortUrl });

        if (url) {
            const redirectUrl = `${url.originalUrl}?userId=${url.userId}&fileId=${url.fileId}`;
            res.redirect(redirectUrl);
        } else {
            res.redirect(`/404.html?name=${encodeURIComponent('Url not found!')}`);
        }
    } catch (error) {
        next(error);
    }
});

app.get('/uploadhere', (req, res) => {
    res.render('uploadNew');
});

app.get('/', (req, res) => {
    res.redirect(`/index.html`);
});

// 404 handler
app.use((req, res) => {
    res.status(404).send('404: Page not found');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
