// Base API URL
const API_BASE_URL = '/api';

// Debug logging
const DEBUG = true;

function logDebug(message, data = null) {
  if (DEBUG) {
    if (data) {
      console.log(`[DEBUG] ${message}`, data);
    } else {
      console.log(`[DEBUG] ${message}`);
    }
  }
}

// Enhanced fetch function with logging
async function fetchWithLogging(url, options = {}) {
  logDebug(`Fetching: ${url}`, options);
  
  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      logDebug(`Response from ${url}:`, { 
        status: response.status, 
        statusText: response.statusText, 
        data 
      });
      
      return { ok: response.ok, data, response };
    } else {
      const text = await response.text();
      logDebug(`Response from ${url} (text):`, { 
        status: response.status, 
        statusText: response.statusText, 
        text: text.substring(0, 500) + (text.length > 500 ? '...' : '') 
      });
      
      return { ok: response.ok, text, response };
    }
  } catch (error) {
    logDebug(`Error fetching ${url}:`, error);
    throw error;
  }
}

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
  // Tab navigation
  const tabItems = document.querySelectorAll('.tab-item');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabItems.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      
      // Remove active class from all tabs and contents
      tabItems.forEach(item => item.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      tab.classList.add('active');
      document.getElementById(`content-${tabId}`).classList.add('active');
    });
  });
  
  // Queue tab navigation
  const queueTabItems = document.querySelectorAll('.queue-tab-item');
  const queueContents = document.querySelectorAll('.queue-content');
  
  queueTabItems.forEach(tab => {
    tab.addEventListener('click', () => {
      const status = tab.getAttribute('data-status');
      
      // Remove active class from all tabs and contents
      queueTabItems.forEach(item => item.classList.remove('active'));
      queueContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      tab.classList.add('active');
      document.getElementById(`queue-content-${status}`).classList.add('active');
    });
  });
  
  // Load initial data
  loadConfig();
  
  // Set up event listeners for forms
  setupFormEventListeners();
  
  // If the tab is 'crawl', load crawl data
  if (document.getElementById('tab-crawl').classList.contains('active')) {
    loadCrawlData();
  }
  
  // If the tab is 'data', load crawled data
  if (document.getElementById('tab-data').classList.contains('active')) {
    loadCrawledData();
  }
});

// Show toast notification
function showToast(message, type = 'success') {
  const toastContainer = document.getElementById('toast-container');
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    ${message}
    <span class="toast-close">&times;</span>
  `;
  
  toastContainer.appendChild(toast);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      toastContainer.removeChild(toast);
    }, 300);
  }, 5000);
  
  // Close on click
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      toastContainer.removeChild(toast);
    }, 300);
  });
}

// Format date
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString();
}

// Setup form event listeners
function setupFormEventListeners() {
  // API Configuration Form
  const apiConfigForm = document.getElementById('api-config-form');
  if (apiConfigForm) {
    apiConfigForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const apiKey = document.getElementById('apiKey').value;
      
      if (!apiKey) {
        showToast('Vui lòng nhập API key', 'error');
        return;
      }
      
      try {
        logDebug('Submitting API key:', { apiKey });
        
        const { ok, data } = await fetchWithLogging(`${API_BASE_URL}/config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey,
            baseUrl: "https://shopee-e-commerce-data.p.rapidapi.com/shopee/item/ratings",
            defaultHeaders: {
              'x-rapidapi-host': 'shopee-e-commerce-data.p.rapidapi.com'
            },
          }),
        });
        
        if (ok) {
          showToast('Cấu hình API đã được lưu thành công.');
        } else {
          showToast(`Lỗi: ${data.message}`, 'error');
        }
      } catch (error) {
        showToast(`Lỗi: ${error.message}`, 'error');
      }
    });
  }
  
  // Comment Limits Form
  const commentLimitsForm = document.getElementById('comment-limits-form');
  if (commentLimitsForm) {
    // Đã loại bỏ tính năng này, ẩn form đi
    const commentLimitsSection = document.getElementById('comment-limits-section');
    if (commentLimitsSection) {
      commentLimitsSection.style.display = 'none';
    }
  }
  
  // Cronjob Settings Form
  const cronjobForm = document.getElementById('cronjob-form');
  if (cronjobForm) {
    // Ẩn phần cronjob form
    const cronjobSection = document.getElementById('cronjob-section');
    if (cronjobSection) {
      cronjobSection.style.display = 'none';
    }
  }
  
  // Google Sheet Configuration Form
  const sheetConfigForm = document.getElementById('sheet-config-form');
  if (sheetConfigForm) {
    sheetConfigForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const googleSheetId = document.getElementById('googleSheetId').value;
      
      try {
        logDebug('Submitting Google Sheet ID:', { googleSheetId });
        
        const { ok, data } = await fetchWithLogging(`${API_BASE_URL}/config/googleSheet`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            googleSheetId,
          }),
        });
        
        if (ok) {
          showToast('ID Google Sheet đã được lưu thành công.');
          // Update sheet status
          loadSheetStatus();
        } else {
          showToast(`Lỗi: ${data.message}`, 'error');
        }
      } catch (error) {
        showToast(`Lỗi: ${error.message}`, 'error');
      }
    });
  }
  
  // Add URLs to Crawl Queue Form
  const addUrlsForm = document.getElementById('add-urls-form');
  if (addUrlsForm) {
    addUrlsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const urlsText = document.getElementById('urls').value;
      const urls = urlsText.split('\n').filter(url => url.trim() !== '');
      
      if (urls.length === 0) {
        showToast('Vui lòng nhập ít nhất một URL.', 'error');
        return;
      }
      
      const ratings = [];
      document.querySelectorAll('input[name="ratings"]:checked').forEach(checkbox => {
        ratings.push(parseInt(checkbox.value));
      });
      
      if (ratings.length === 0) {
        showToast('Vui lòng chọn ít nhất một mức đánh giá để thu thập.', 'error');
        return;
      }
      
      try {
        logDebug('Adding URLs to crawl queue:', { urls, ratings });
        
        const { ok, data } = await fetchWithLogging(`${API_BASE_URL}/crawl/queue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            urls,
            ratings,
          }),
        });
        
        if (ok) {
          const successCount = data.results.length;
          const errorCount = data.errors.length;
          
          if (data.errors.length > 0) {
            logDebug('Errors adding URLs:', data.errors);
          }
          
          showToast(`Đã thêm ${successCount} URL vào hàng đợi thu thập. ${errorCount > 0 ? `${errorCount} lỗi.` : ''}`);
          
          // Clear the form
          document.getElementById('urls').value = '';
          
          // Reload crawl queue
          loadCrawlQueue();
        } else {
          showToast(`Lỗi: ${data.message}`, 'error');
        }
      } catch (error) {
        showToast(`Lỗi: ${error.message}`, 'error');
      }
    });
  }
  
  // Run Crawl Button
  const runCrawlBtn = document.getElementById('run-crawl-btn');
  if (runCrawlBtn) {
    runCrawlBtn.addEventListener('click', async () => {
      const ratings = [];
      document.querySelectorAll('input[name="ratings"]:checked').forEach(checkbox => {
        ratings.push(parseInt(checkbox.value));
      });
      
      if (ratings.length === 0) {
        showToast('Vui lòng chọn ít nhất một mức đánh giá để thu thập.', 'error');
        return;
      }
      
      try {
        logDebug('Starting crawl process with ratings:', ratings);
        
        const { ok, data } = await fetchWithLogging(`${API_BASE_URL}/crawl/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ratings,
          }),
        });
        
        if (ok) {
          showToast('Quá trình thu thập đã bắt đầu thành công.');
          
          // Reload crawl status after a short delay
          setTimeout(() => {
            loadCrawlStatus();
          }, 2000);
        } else {
          showToast(`Lỗi: ${data.message}`, 'error');
        }
      } catch (error) {
        showToast(`Lỗi: ${error.message}`, 'error');
      }
    });
  }
  
  // Sync to Google Sheets Button
  const syncSheetsBtn = document.getElementById('sync-sheets-btn');
  if (syncSheetsBtn) {
    syncSheetsBtn.addEventListener('click', async () => {
      try {
        logDebug('Starting Google Sheets sync process');
        
        const { ok, data } = await fetchWithLogging(`${API_BASE_URL}/sheet/sync`, {
          method: 'POST',
        });
        
        if (ok) {
          showToast('Quá trình đồng bộ Google Sheets đã bắt đầu.');
        } else {
          showToast(`Lỗi: ${data.message}`, 'error');
        }
      } catch (error) {
        showToast(`Lỗi: ${error.message}`, 'error');
      }
    });
  }
  
  // Refresh Status Button
  const refreshStatusBtn = document.getElementById('refresh-status-btn');
  if (refreshStatusBtn) {
    refreshStatusBtn.addEventListener('click', () => {
      loadCrawlStatus();
      loadCrawlQueue();
    });
  }
  
  // Data Filter Button
  const dataFilterBtn = document.getElementById('data-filter-btn');
  if (dataFilterBtn) {
    dataFilterBtn.addEventListener('click', () => {
      loadCrawledData(1);
    });
  }
  
  // Data Export JSON Button
  const dataExportJsonBtn = document.getElementById('data-export-json-btn');
  if (dataExportJsonBtn) {
    dataExportJsonBtn.addEventListener('click', () => {
      exportCrawledData('json');
    });
  }
  
  // Data Export CSV Button
  const dataExportCsvBtn = document.getElementById('data-export-csv-btn');
  if (dataExportCsvBtn) {
    dataExportCsvBtn.addEventListener('click', () => {
      exportCrawledData('csv');
    });
  }
  
  // Data Pagination
  const dataPrevPage = document.getElementById('data-prev-page');
  const dataNextPage = document.getElementById('data-next-page');
  
  if (dataPrevPage) {
    dataPrevPage.addEventListener('click', () => {
      const currentPage = parseInt(document.getElementById('data-current-page').textContent.replace('Trang ', ''));
      if (currentPage > 1) {
        loadCrawledData(currentPage - 1);
      }
    });
  }
  
  if (dataNextPage) {
    dataNextPage.addEventListener('click', () => {
      const currentPage = parseInt(document.getElementById('data-current-page').textContent.replace('Trang ', ''));
      const totalPages = parseInt(document.getElementById('data-pagination-total').getAttribute('data-total-pages') || '1');
      
      if (currentPage < totalPages) {
        loadCrawledData(currentPage + 1);
      }
    });
  }
}

// Load configuration from API
async function loadConfig() {
  try {
    logDebug('Loading configuration');
    
    const { ok, data } = await fetchWithLogging(`${API_BASE_URL}/config`);
    
    if (ok) {
      // Populate API Configuration form
      if (document.getElementById('apiKey')) {
        document.getElementById('apiKey').value = data.apiKey || "";
        document.getElementById('apiKey').disabled = false; // Cho phép sửa API key
      }
      
      // Ẩn các phần không cần thiết
      if (document.getElementById('baseUrl')) {
        document.getElementById('baseUrl').parentElement.style.display = 'none';
      }
      if (document.getElementById('defaultHeaders')) {
        document.getElementById('defaultHeaders').parentElement.style.display = 'none';
      }
      
      // Ẩn phần Cronjob Settings form
      const cronjobSection = document.getElementById('cronjob-section');
      if (cronjobSection) {
        cronjobSection.style.display = 'none';
      }
      
      // Populate Google Sheet ID
      if (document.getElementById('googleSheetId')) {
        document.getElementById('googleSheetId').value = data.googleSheetId || '';
      }
      
      // Load sheet status
      loadSheetStatus();
    } else {
      showToast('Không thể tải cấu hình.', 'error');
    }
  } catch (error) {
    showToast(`Lỗi khi tải cấu hình: ${error.message}`, 'error');
  }
}

// Load Google Sheet status
async function loadSheetStatus() {
  const sheetStatus = document.getElementById('sheetStatus');
  if (!sheetStatus) return;
  
  try {
    logDebug('Loading Google Sheet status');
    
    const { ok, data } = await fetchWithLogging(`${API_BASE_URL}/sheet/status`);
    
    if (ok) {
      if (data.isConfigured) {
        const syncedPercentage = data.counts.total > 0 
          ? Math.round((data.counts.synced / data.counts.total) * 100) 
          : 100;
        
        sheetStatus.innerHTML = `
          <div class="p-4 bg-blue-50 rounded-md">
            <p class="text-blue-800 font-medium">Google Sheet đã được cấu hình.</p>
            <p class="text-sm mt-1">
              <a href="${data.sheetUrl}" target="_blank" class="text-blue-600 hover:underline">Xem Sheet</a>
            </p>
            <div class="mt-2">
              <p class="text-sm text-gray-700">
                ${data.counts.synced} / ${data.counts.total} bản ghi đã đồng bộ (${syncedPercentage}%)
              </p>
              <div class="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${syncedPercentage}%"></div>
              </div>
            </div>
          </div>
        `;
      } else {
        sheetStatus.innerHTML = `
          <div class="p-4 bg-yellow-50 rounded-md">
            <p class="text-yellow-800">ID Google Sheet chưa được cấu hình.</p>
            <p class="text-sm mt-1">Nhập ID Google Sheet hợp lệ để bật đồng bộ.</p>
          </div>
        `;
      }
    } else {
      sheetStatus.innerHTML = `
        <div class="p-4 bg-red-50 rounded-md">
          <p class="text-red-800">Lỗi khi kiểm tra trạng thái Google Sheet.</p>
        </div>
      `;
    }
  } catch (error) {
    sheetStatus.innerHTML = `
      <div class="p-4 bg-red-50 rounded-md">
        <p class="text-red-800">Lỗi: ${error.message}</p>
      </div>
    `;
  }
}

// Load crawl data
function loadCrawlData() {
  loadCrawlStatus();
  loadCrawlQueue();
}

// Load crawl status from API
async function loadCrawlStatus() {
  const crawlStatus = document.getElementById('crawl-status');
  if (!crawlStatus) return;
  
  try {
    crawlStatus.innerHTML = '<div class="flex items-center"><span class="loader"></span> Đang tải trạng thái...</div>';
    
    logDebug('Loading crawl status');
    
    const { ok, data } = await fetchWithLogging(`${API_BASE_URL}/crawl/status`);
    
    if (ok) {
      const statusHtml = `
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-yellow-50 p-4 rounded-md">
            <h3 class="font-medium">Đang Chờ</h3>
            <p class="text-2xl mt-1">${data.counts.pending}</p>
          </div>
          <div class="bg-blue-50 p-4 rounded-md">
            <h3 class="font-medium">Đang Xử Lý</h3>
            <p class="text-2xl mt-1">${data.counts.processing}</p>
          </div>
          <div class="bg-green-50 p-4 rounded-md">
            <h3 class="font-medium">Đã Hoàn Thành</h3>
            <p class="text-2xl mt-1">${data.counts.completed}</p>
          </div>
          <div class="bg-red-50 p-4 rounded-md">
            <h3 class="font-medium">Lỗi</h3>
            <p class="text-2xl mt-1">${data.counts.error}</p>
          </div>
        </div>
        ${data.isCurrentlyCrawling ? '<p class="mt-4 text-blue-600 font-medium">Quá trình thu thập đang chạy.</p>' : ''}
      `;
      
      crawlStatus.innerHTML = statusHtml;
    } else {
      crawlStatus.innerHTML = '<p class="text-red-600">Không thể tải trạng thái thu thập.</p>';
    }
  } catch (error) {
    crawlStatus.innerHTML = `<p class="text-red-600">Lỗi: ${error.message}</p>`;
  }
}

// Load crawl queue from API
async function loadCrawlQueue() {
  const pendingQueueTable = document.getElementById('pending-queue-table');
  const processingQueueTable = document.getElementById('processing-queue-table');
  const completedQueueTable = document.getElementById('completed-queue-table');
  const errorQueueTable = document.getElementById('error-queue-table');
  
  try {
    // Load pending items
    if (pendingQueueTable) {
      pendingQueueTable.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center">Đang tải...</td></tr>';
      
      logDebug('Loading pending queue items');
      
      const { ok, data: pendingData } = await fetchWithLogging(`${API_BASE_URL}/crawl/queue?status=pending`);
      
      if (ok) {
        if (pendingData.length === 0) {
          pendingQueueTable.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center">Không có mục đang chờ</td></tr>';
        } else {
          pendingQueueTable.innerHTML = pendingData.map(item => `
            <tr>
              <td class="px-6 py-4 whitespace-nowrap">${truncateUrl(item.url)}</td>
              <td class="px-6 py-4 whitespace-nowrap">${item.productId}</td>
              <td class="px-6 py-4 whitespace-nowrap">${item.targetRatings.join(', ')}</td>
              <td class="px-6 py-4 whitespace-nowrap">${formatDate(item.createdAt)}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <button class="text-red-500 hover:text-red-700" onclick="removeFromQueue('${item._id}')">
                  Xóa
                </button>
              </td>
            </tr>
          `).join('');
        }
      } else {
        pendingQueueTable.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-red-600">Không thể tải dữ liệu</td></tr>';
      }
    }
    
    // Load processing items
    if (processingQueueTable) {
      processingQueueTable.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center">Đang tải...</td></tr>';
      
      logDebug('Loading processing queue items');
      
      const { ok, data: processingData } = await fetchWithLogging(`${API_BASE_URL}/crawl/queue?status=processing`);
      
      if (ok) {
        if (processingData.length === 0) {
          processingQueueTable.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center">Không có mục đang xử lý</td></tr>';
        } else {
          processingQueueTable.innerHTML = processingData.map(item => `
            <tr>
              <td class="px-6 py-4 whitespace-nowrap">${truncateUrl(item.url)}</td>
              <td class="px-6 py-4 whitespace-nowrap">${item.productId}</td>
              <td class="px-6 py-4 whitespace-nowrap">${item.targetRatings.join(', ')}</td>
              <td class="px-6 py-4 whitespace-nowrap">${item.lastAttemptedAt ? formatDate(item.lastAttemptedAt) : 'N/A'}</td>
            </tr>
          `).join('');
        }
      } else {
        processingQueueTable.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-red-600">Không thể tải dữ liệu</td></tr>';
      }
    }
    
    // Load completed items
    if (completedQueueTable) {
      completedQueueTable.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center">Đang tải...</td></tr>';
      
      logDebug('Loading completed queue items');
      
      const { ok, data: completedData } = await fetchWithLogging(`${API_BASE_URL}/crawl/queue?status=completed`);
      
      if (ok) {
        if (completedData.length === 0) {
          completedQueueTable.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center">Không có mục đã hoàn thành</td></tr>';
        } else {
          completedQueueTable.innerHTML = completedData.map(item => `
            <tr>
              <td class="px-6 py-4 whitespace-nowrap">${truncateUrl(item.url)}</td>
              <td class="px-6 py-4 whitespace-nowrap">${item.productId}</td>
              <td class="px-6 py-4 whitespace-nowrap">${item.completedRatings ? item.completedRatings.join(', ') : 'N/A'}</td>
              <td class="px-6 py-4 whitespace-nowrap">${formatDate(item.updatedAt)}</td>
            </tr>
          `).join('');
        }
      } else {
        completedQueueTable.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-red-600">Không thể tải dữ liệu</td></tr>';
      }
    }
    
    // Load error items
    if (errorQueueTable) {
      errorQueueTable.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center">Đang tải...</td></tr>';
      
      logDebug('Loading error queue items');
      
      const { ok, data: errorData } = await fetchWithLogging(`${API_BASE_URL}/crawl/queue?status=error`);
      
      if (ok) {
        if (errorData.length === 0) {
          errorQueueTable.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center">Không có mục lỗi</td></tr>';
        } else {
          errorQueueTable.innerHTML = errorData.map(item => `
            <tr>
              <td class="px-6 py-4 whitespace-nowrap">${truncateUrl(item.url)}</td>
              <td class="px-6 py-4 whitespace-nowrap">${item.productId}</td>
              <td class="px-6 py-4 whitespace-nowrap">${item.errorMessage || 'Lỗi không xác định'}</td>
              <td class="px-6 py-4 whitespace-nowrap">${formatDate(item.updatedAt)}</td>
            </tr>
          `).join('');
        }
      } else {
        errorQueueTable.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-red-600">Không thể tải dữ liệu</td></tr>';
      }
    }
  } catch (error) {
    if (pendingQueueTable) pendingQueueTable.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-red-600">Lỗi: ${error.message}</td></tr>`;
    if (processingQueueTable) processingQueueTable.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-red-600">Lỗi: ${error.message}</td></tr>`;
    if (completedQueueTable) completedQueueTable.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-red-600">Lỗi: ${error.message}</td></tr>`;
    if (errorQueueTable) errorQueueTable.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-red-600">Lỗi: ${error.message}</td></tr>`;
  }
}

// Remove item from crawl queue
async function removeFromQueue(id) {
  try {
    logDebug('Removing item from queue:', { id });
    
    const { ok, data } = await fetchWithLogging(`${API_BASE_URL}/crawl/queue/${id}`, {
      method: 'DELETE',
    });
    
    if (ok) {
      showToast('Đã xóa mục khỏi hàng đợi thành công.');
      loadCrawlQueue();
    } else {
      showToast(`Lỗi: ${data.message}`, 'error');
    }
  } catch (error) {
    showToast(`Lỗi: ${error.message}`, 'error');
  }
}

// Load crawled data
let currentDataPage = 1;
let dataLimit = 50;

async function loadCrawledData(page = 1) {
  currentDataPage = page;
  
  const dataTable = document.getElementById('data-table');
  if (!dataTable) return;
  
  dataTable.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center">Đang tải...</td></tr>';
  
  try {
    // Get filter values
    const productId = document.getElementById('data-product-id')?.value || '';
    const rating = document.getElementById('data-rating')?.value || '';
    
    // Sửa lỗi URL bằng cách thêm origin
    const apiUrl = `${window.location.origin}${API_BASE_URL}/data`;
    const url = new URL(apiUrl);
    url.searchParams.append('page', page);
    url.searchParams.append('limit', dataLimit);
    if (productId) url.searchParams.append('productId', productId);
    if (rating) url.searchParams.append('rating', rating);
    
    logDebug('Loading crawled data:', { 
      page, 
      limit: dataLimit, 
      productId: productId || undefined, 
      rating: rating || undefined,
      url: url.toString()
    });
    
    const { ok, data } = await fetchWithLogging(url.toString());
    
    if (ok) {
      if (data.data.length === 0) {
        dataTable.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center">Không tìm thấy dữ liệu</td></tr>';
      } else {
        dataTable.innerHTML = data.data.map(item => `
          <tr>
            <td class="px-6 py-4 whitespace-nowrap">${item.productId}</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="star-rating">
                ${renderStars(item.ratingStar)}
              </div>
            </td>
            <td class="px-6 py-4">${item.commentText || 'Không có bình luận'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${item.commenterUsername || 'Vô danh'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${item.commentTimestamp ? formatDate(item.commentTimestamp) : 'N/A'}</td>
          </tr>
        `).join('');
        
        // Update pagination
        const start = (data.pagination.page - 1) * data.pagination.limit + 1;
        const end = Math.min(start + data.pagination.limit - 1, data.pagination.total);
        
        document.getElementById('data-pagination-start').textContent = start;
        document.getElementById('data-pagination-end').textContent = end;
        document.getElementById('data-pagination-total').textContent = data.pagination.total;
        document.getElementById('data-pagination-total').setAttribute('data-total-pages', data.pagination.pages);
        document.getElementById('data-current-page').textContent = `Trang ${data.pagination.page}`;
        
        document.getElementById('data-prev-page').disabled = data.pagination.page <= 1;
        document.getElementById('data-next-page').disabled = data.pagination.page >= data.pagination.pages;
      }
    } else {
      dataTable.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-red-600">Không thể tải dữ liệu</td></tr>';
    }
  } catch (error) {
    dataTable.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-red-600">Lỗi: ${error.message}</td></tr>`;
  }
}

// Export crawled data
function exportCrawledData(format = 'json') {
  // Get filter values
  const productId = document.getElementById('data-product-id')?.value || '';
  const rating = document.getElementById('data-rating')?.value || '';
  
  // Sửa lỗi URL bằng cách thêm origin
  const apiUrl = `${window.location.origin}${API_BASE_URL}/data/export`;
  const url = new URL(apiUrl);
  url.searchParams.append('format', format);
  if (productId) url.searchParams.append('productId', productId);
  if (rating) url.searchParams.append('rating', rating);
  
  logDebug('Exporting data:', { 
    format, 
    productId: productId || undefined, 
    rating: rating || undefined,
    url: url.toString()
  });
  
  // Redirect to download URL
  window.open(url, '_blank');
}

// Helper functions
function truncateUrl(url, maxLength = 40) {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + '...';
}

function renderStars(rating) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      stars += '<span class="star-filled">★</span>';
    } else {
      stars += '<span class="star-empty">☆</span>';
    }
  }
  return stars;
}

// Extract shop ID and item ID from Shopee URL
function extractShopeeIds(url) {
  try {
    // Extract the shop ID and product ID from a Shopee URL
    // Example URL: https://shopee.vn/product-name-i.12345678.1234567890
    const regex = /i\.(\d+)\.(\d+)/;
    const match = url.match(regex);
    
    if (match && match.length >= 3) {
      return {
        shopId: match[1], // Shop ID
        itemId: match[2]  // Product/Item ID
      };
    }
    
    return null;
  } catch (error) {
    console.error('Lỗi khi trích xuất ID Shopee:', error);
    return null;
  }
}

// Add global function reference for the remove button
window.removeFromQueue = removeFromQueue; 