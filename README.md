# Shopee Product Review Crawler

A web application to crawl product reviews from Shopee e-commerce platform, store them in MongoDB, and sync them to Google Sheets.

## Features

- Configure API credentials and settings
- Set up comment limits per rating (1-5 stars)
- Schedule automatic crawling via cronjob
- Add multiple product URLs to the crawl queue
- View and manage crawl status and queue
- Browse and filter crawled data
- Export data to JSON or CSV formats
- Sync data to Google Sheets for further analysis

## Technology Stack

- **Backend**: Node.js (Express.js)
- **Database**: MongoDB
- **Frontend**: HTML, CSS (Tailwind CSS), JavaScript
- **External APIs**: Shopee E-commerce API, Google Sheets API

## Project Structure

```
project-root/
├── backend/
│   ├── config/               # Configuration files
│   │   └── db.js             # MongoDB connection
│   ├── controllers/          # API route handlers
│   │   ├── configController.js
│   │   ├── crawlController.js
│   │   └── sheetController.js
│   ├── cronjobs/             # Scheduled tasks
│   │   └── shopeeCron.js
│   ├── models/               # Database models
│   │   ├── configModel.js
│   │   ├── crawlQueueModel.js
│   │   └── crawledDataModel.js
│   ├── routes/               # API routes
│   │   └── api.js
│   ├── services/             # Business logic
│   │   ├── googleSheetService.js
│   │   └── shopeeApiService.js
│   ├── .env                  # Environment variables
│   ├── huy-hoang-book-0bf0f972303b.json  # Google API credentials
│   ├── package.json
│   └── server.js             # Main application entry point
├── frontend/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── main.js
│   └── index.html
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- MongoDB database (hosted or local)
- Google Cloud project with Sheets API enabled
- Shopee E-commerce API credentials

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/Craw-shopee-api.git
   cd Craw-shopee-api
   ```

2. Install backend dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the `backend` directory with the following variables:
   ```
   PORT=5000
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database
   GOOGLE_APPLICATION_CREDENTIALS=./path-to-credentials.json
   NODE_ENV=development
   ```

4. Place your Google service account credentials JSON file in the `backend` directory and update the path in the `.env` file.

5. Start the server:
   ```
   npm run dev
   ```

6. Open your browser and navigate to `http://localhost:5000`

## Usage

1. **Configuration**:
   - Set up your Shopee API credentials (API key, base URL, headers)
   - Configure the number of comments to fetch for each rating
   - Enable and schedule automatic crawling if needed
   - Add your Google Sheet ID for syncing data

2. **Crawl Management**:
   - Add Shopee product URLs to the crawl queue
   - Select which ratings to crawl for each URL
   - Monitor the crawl status and queue
   - Manually start the crawl process

3. **Data Management**:
   - Browse and filter crawled comments
   - Export data to JSON or CSV format
   - Sync data to Google Sheets

## API Documentation

### Configuration Endpoints

- `GET /api/config` - Get current system configuration
- `POST /api/config` - Update API configuration
- `POST /api/config/commentLimits` - Update comment limits per rating
- `POST /api/config/cronjob` - Update cronjob settings
- `POST /api/config/googleSheet` - Update Google Sheet configuration

### Crawl Endpoints

- `GET /api/crawl/queue` - Get crawl queue (can filter by status and rating)
- `POST /api/crawl/queue` - Add URLs to crawl queue
- `DELETE /api/crawl/queue/:id` - Remove item from crawl queue
- `POST /api/crawl/run` - Manually start crawl process
- `GET /api/crawl/status` - Get current crawl status

### Data Endpoints

- `GET /api/data` - Get crawled data (supports pagination and filtering)
- `GET /api/data/export` - Export crawled data (JSON or CSV)

### Google Sheets Endpoints

- `GET /api/sheet/status` - Get Google Sheet sync status
- `POST /api/sheet/sync` - Start data sync to Google Sheets

## License

This project is licensed under the MIT License.

## Acknowledgements

- [Express.js](https://expressjs.com/)
- [MongoDB](https://www.mongodb.com/)
- [Mongoose](https://mongoosejs.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [Shopee E-commerce API](https://rapidapi.com/apidojo/api/shopee-e-commerce-data/)

## Cài đặt

```bash
# Clone repository
git clone https://github.com/yourusername/Craw-shopee-api.git
cd Craw-shopee-api

# Cài đặt dependencies
npm install
```

## Cấu hình

### Môi trường Development

Tạo file `.env` trong thư mục `backend` với nội dung:

```
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://your_mongodb_uri
GOOGLE_APPLICATION_CREDENTIALS=./huy-hoang-book-0bf0f972303b.json
```

### Môi trường Production

Tạo file `.env.production` trong thư mục `backend` với nội dung:

```
PORT=9005
NODE_ENV=production
DOMAIN=vuquangduy.online
MONGO_URI=mongodb+srv://your_mongodb_uri
GOOGLE_APPLICATION_CREDENTIALS=./huy-hoang-book-0bf0f972303b.json
DEFAULT_RAPIDAPI_KEY=your_rapidapi_key
DEFAULT_RAPIDAPI_HOST=shopee-e-commerce-data.p.rapidapi.com
```

## Chạy ứng dụng

### Development

```bash
# Chạy server
node backend/server.js
# hoặc với nodemon
nodemon backend/server.js
```

### Production với PM2

1. Cài đặt PM2 nếu chưa có:

```bash
npm install -g pm2
```

2. Triển khai với PM2:

```bash
# Khởi động với file cấu hình
pm2 start ecosystem.config.js --env production

# Đảm bảo PM2 tự khởi động khi server restart
pm2 startup
pm2 save
```

## Cấu hình Nginx (tùy chọn)

Nếu bạn muốn sử dụng domain và HTTPS:

```nginx
server {
    listen 80;
    server_name vuquangduy.online;

    location / {
        proxy_pass http://localhost:9005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Các lệnh hữu ích

```bash
# Xem logs
pm2 logs shopee-crawler

# Restart ứng dụng
pm2 restart shopee-crawler

# Xem trạng thái
pm2 status
``` 