const { google } = require('googleapis');
const CrawledData = require('../models/crawledDataModel');

// Set up Google Sheets client
const setupSheetsClient = () => {
  try {
    // Load service account key from environment variable or file
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || './huy-hoang-book-0bf0f972303b.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    return google.sheets({ version: 'v4', auth });
  } catch (error) {
    console.error('Error setting up Google Sheets client:', error);
    throw error;
  }
};

// Get or create main sheet for all product data
const getOrCreateMainSheet = async (sheets, spreadsheetId) => {
  try {
    const sheetTitle = 'Shopee Comments';
    
    // Get existing sheets
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    });
    
    // Check if sheet exists
    const existingSheet = response.data.sheets.find(
      sheet => sheet.properties.title === sheetTitle
    );
    
    if (existingSheet) {
      return existingSheet.properties.sheetId;
    }
    
    // Create new sheet if it doesn't exist
    const addSheetResponse = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetTitle,
              },
            },
          },
        ],
      },
    });
    
    return addSheetResponse.data.replies[0].addSheet.properties.sheetId;
  } catch (error) {
    console.error('Error getting/creating main sheet:', error);
    throw error;
  }
};

// Initialize sheet with headers
const initializeSheetHeaders = async (sheets, spreadsheetId) => {
  try {
    const sheetTitle = 'Shopee Comments';
    
    // Define headers - column 1 for URL, column 2 for all comments
    const headers = ['Product URL', 'All Comments', 'Updated At'];
    
    // Check if headers already exist
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetTitle}!A1:C1`,
    });
    
    if (dataResponse.data.values && dataResponse.data.values[0] && dataResponse.data.values[0].length === headers.length) {
      return; // Headers already exist
    }
    
    // Write headers
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetTitle}!A1:C1`,
      valueInputOption: 'RAW',
      resource: {
        values: [headers],
      },
    });
    
    // Format headers (bold, freeze)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: await getOrCreateMainSheet(sheets, spreadsheetId),
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: {
                    bold: true,
                  },
                  backgroundColor: {
                    red: 0.9,
                    green: 0.9,
                    blue: 0.9,
                  },
                },
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
          {
            updateSheetProperties: {
              properties: {
                sheetId: await getOrCreateMainSheet(sheets, spreadsheetId),
                gridProperties: {
                  frozenRowCount: 1,
                },
              },
              fields: 'gridProperties.frozenRowCount',
            },
          },
          // Set column width for comments column
          {
            updateDimensionProperties: {
              range: {
                sheetId: await getOrCreateMainSheet(sheets, spreadsheetId),
                dimension: 'COLUMNS',
                startIndex: 1,
                endIndex: 2,
              },
              properties: {
                pixelSize: 600,
              },
              fields: 'pixelSize',
            },
          },
        ],
      },
    });
  } catch (error) {
    console.error('Error initializing sheet headers:', error);
    throw error;
  }
};

// Format comment text for export
const formatComment = (comment) => {
  const stars = '★'.repeat(comment.ratingStar) + '☆'.repeat(5 - comment.ratingStar);
  
  let text = `[${stars}] ${comment.commenterUsername || 'Anonymous'} - ${new Date(comment.commentTimestamp).toLocaleString()}:\n`;
  text += `${comment.commentText || '(No text)'}\n`;
  
  if (comment.ratingImages && comment.ratingImages.length > 0) {
    text += `Images: ${comment.ratingImages.join(', ')}\n`;
  }
  
  if (comment.ratingVideos && comment.ratingVideos.length > 0) {
    text += `Videos: ${comment.ratingVideos.join(', ')}\n`;
  }
  
  if (comment.likeCount > 0) {
    text += `Likes: ${comment.likeCount}\n`;
  }
  
  text += '------------------------\n';
  return text;
};

// Sync crawled data to Google Sheet
const syncCrawledDataToSheet = async (spreadsheetId, specificProductId = null) => {
  try {
    // Set up Sheets client
    const sheets = setupSheetsClient();
    
    // Create or get main sheet
    await getOrCreateMainSheet(sheets, spreadsheetId);
    
    // Initialize headers if needed
    await initializeSheetHeaders(sheets, spreadsheetId);
    
    // Get the sheet data to check for existing products
    const sheetTitle = 'Shopee Comments';
    const existingDataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetTitle}!A:A`,
    });
    
    const existingUrls = existingDataResponse.data.values || [];
    const existingUrlMap = {};
    
    // Create map of existing URLs to row numbers (1-based)
    for (let i = 1; i < existingUrls.length; i++) {
      if (existingUrls[i] && existingUrls[i][0]) {
        existingUrlMap[existingUrls[i][0]] = i + 1; // +1 because 0th row is header
      }
    }
    
    // Build query for fetching data
    const query = {};
    if (specificProductId) {
      query.productId = specificProductId;
    }
    
    // Group all comments by product URL
    const distinctUrls = await CrawledData.distinct('originalUrl', query);
    
    for (const url of distinctUrls) {
      // Get all comments for this URL
      const comments = await CrawledData.find({ originalUrl: url })
        .sort({ ratingStar: -1, commentTimestamp: -1 });
      
      if (comments.length === 0) continue;
      
      // Format all comments
      let allCommentsText = "";
      for (const comment of comments) {
        allCommentsText += formatComment(comment);
      }
      
      // Check if URL already exists in sheet
      const rowIndex = existingUrlMap[url];
      const updateTime = new Date().toLocaleString();
      
      if (rowIndex) {
        // Update existing row
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetTitle}!B${rowIndex}:C${rowIndex}`,
          valueInputOption: 'RAW',
          resource: {
            values: [[allCommentsText, updateTime]],
          },
        });
      } else {
        // Add new row
        const nextRow = Object.keys(existingUrlMap).length + 2; // +2 for header and 0-indexing
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetTitle}!A${nextRow}:C${nextRow}`,
          valueInputOption: 'RAW',
          resource: {
            values: [[url, allCommentsText, updateTime]],
          },
        });
        existingUrlMap[url] = nextRow;
      }
      
      // Mark all comments as saved
      await CrawledData.updateMany(
        { originalUrl: url },
        { savedToSheet: true }
      );
      
      console.log(`Synced ${comments.length} comments for URL: ${url}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error syncing data to Google Sheet:', error);
    return false;
  }
};

module.exports = {
  syncCrawledDataToSheet,
}; 