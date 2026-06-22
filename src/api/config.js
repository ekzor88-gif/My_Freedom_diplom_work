import axios from 'axios';

export const N8N_FRONTEND_WEBHOOK = import.meta.env.VITE_N8N_FRONTEND_WEBHOOK;
export const N8N_ORDERS_WEBHOOK = import.meta.env.VITE_N8N_ORDERS_WEBHOOK;
export const N8N_PURCHASE_REQUESTS_WEBHOOK = import.meta.env.VITE_N8N_PURCHASE_REQUESTS_WEBHOOK;
export const N8N_AUDIT_WEBHOOK = import.meta.env.VITE_N8N_AUDIT_WEBHOOK;
export const N8N_ANALYTICS_SNAPSHOTS_WEBHOOK = import.meta.env.VITE_N8N_ANALYTICS_SNAPSHOTS_WEBHOOK;

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  }
});

export const mapSKUData = (data) => {
  return data.map(item => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
    supplier: item.supplier_name || 'Неизвестен',
    stock: parseInt(item.current_stock) || 0,
    minLevel: parseInt(item.critical_threshold) || 0,
    avgConsumption: parseFloat(item.avg_daily_sales) || 0,
    category: item.category || 'Общее',
    salesTrend: parseFloat(item.sales_trend) || 0,
    leadTime: item.lead_time_days || 0
  }));
};

export const fetchLiveAudit = async () => {
  try {
    const response = await axios.get(N8N_ANALYTICS_SNAPSHOTS_WEBHOOK);
    const rawData = Array.isArray(response.data) ? response.data : [response.data];
    const latest = rawData[0];
    return latest?.report || latest?.ai_report || "Анализ завершен. Система работает в штатном режиме.";
  } catch (error) {
    console.error('Error fetching live audit:', error);
    return "Не удалось получить свежий аналитический срез. Проверьте n8n.";
  }
};

export const fetchInventory = async () => {
  try {
    const response = await axios.get(N8N_FRONTEND_WEBHOOK);
    return mapSKUData(response.data);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    throw error;
  }
};

export const fetchOrders = async () => {
  try {
    const response = await axios.get(N8N_ORDERS_WEBHOOK);
    return response.data;
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
};

export const fetchPurchaseRequests = async () => {
  let remoteRequests = [];
  try {
    const response = await axios.get(N8N_PURCHASE_REQUESTS_WEBHOOK);
    const data = Array.isArray(response.data) ? response.data : [response.data].filter(Boolean);
    remoteRequests = data.map(item => {
      let sku = item.sku;
      if (!sku && Array.isArray(item.products_json)) {
        sku = item.products_json.map(p => p.sku).filter(Boolean).join(', ');
      }
      if (!sku) sku = 'N/A';

      let qty = parseInt(item.requested_qty);
      if (isNaN(qty) && typeof item.total_qty === 'number') {
        qty = item.total_qty;
      }
      if (isNaN(qty) && Array.isArray(item.products_json)) {
        qty = item.products_json.reduce((sum, p) => sum + (parseInt(p.needed_qty) || 0), 0);
      }
      if (isNaN(qty)) qty = 0;

      const statusMap = {
        'approved': 'Отправлено',
        'pending_approval': 'На верификации',
        'pending': 'На верификации'
      };
      const status = statusMap[item.status] || 'Черновик';

      return {
        id: String(item.id),
        sku,
        supplier: item.supplier_name || 'Неизвестен',
        date: new Date(item.created_at || Date.now()).toLocaleDateString('ru-RU'),
        status,
        content: item.ai_draft_email || '',
        qty
      };
    });
  } catch (error) {
    console.error('Error fetching purchase requests from webhook:', error);
  }

  // Получаем локальные заявки из localStorage
  const localRequestsRaw = localStorage.getItem('local_purchase_requests');
  let localRequests = [];
  if (localRequestsRaw) {
    try {
      localRequests = JSON.parse(localRequestsRaw);
    } catch (e) {
      console.warn('Failed to parse local purchase requests:', e);
    }
  }

  // Объединяем, приоритет отдаем серверным
  const allRequests = [...localRequests, ...remoteRequests];
  const uniqueRequests = Array.from(new Map(allRequests.map(item => [item.id, item])).values());
  
  // Сортируем по ID (по убыванию времени создания)
  return uniqueRequests.sort((a, b) => b.id.localeCompare(a.id));
};

export const createPurchaseRequest = async (requestData) => {
  const newRequest = {
    id: `REQ-${Date.now().toString().slice(-6)}`,
    sku: requestData.sku || 'N/A',
    supplier: requestData.supplier_name || 'Неизвестен',
    date: new Date().toLocaleDateString('ru-RU'),
    status: 'Черновик',
    content: requestData.ai_draft_email || `Уважаемый менеджер ${requestData.supplier_name},\n\nНа основе анализа товарных остатков нашей системы просим подготовить коммерческое предложение на поставку следующих позиций:\n\n- Артикул: ${requestData.sku} — ${requestData.requested_qty} шт.\n\nПросим подтвердить наличие товара на складе и выставить счет.`,
    qty: parseInt(requestData.requested_qty) || 10
  };

  // Пытаемся отправить на вебхук (n8n)
  try {
    await axios.post(N8N_PURCHASE_REQUESTS_WEBHOOK, {
      id: newRequest.id,
      sku: newRequest.sku,
      supplier_name: newRequest.supplier,
      requested_qty: newRequest.qty,
      ai_draft_email: newRequest.content,
      status: 'pending',
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.warn('Webhook POST failed, saving locally only:', error);
  }

  // Сохраняем в localStorage в любом случае для надежности
  const localRequestsRaw = localStorage.getItem('local_purchase_requests');
  let localRequests = [];
  if (localRequestsRaw) {
    try {
      localRequests = JSON.parse(localRequestsRaw);
    } catch (e) {}
  }
  localRequests.unshift(newRequest);
  localStorage.setItem('local_purchase_requests', JSON.stringify(localRequests));

  return newRequest;
};

export const fetchAnalyticsSnapshots = async () => {
  try {
    const response = await axios.get(N8N_ANALYTICS_SNAPSHOTS_WEBHOOK);
    const data = Array.isArray(response.data) ? response.data : [response.data].filter(Boolean);
    
    // Unwrap n8n wrapper if present
    const unwrappedData = data.map(item => {
      if (item && item.body && typeof item.body === 'object') {
        return {
          ...item.body,
          executionMode: item.executionMode,
          webhookUrl: item.webhookUrl,
        };
      }
      return item;
    });

    const validData = unwrappedData.filter(item => item && (item.generated_at || item.date || item.created_at));
    
    if (validData.length > 0) {
      return normalizeSnapshots(validData);
    }
  } catch (error) {
    console.error('Error fetching analytics snapshots from webhook:', error);
  }
  
  return [];
};

const normalizeSnapshots = (rawData) => {
  return rawData
    .map(item => {
      // Пытаемся распарсить вложенный JSON из разных возможных полей
      let parsedText = {};
      const rawSource = item.raw_ai_response || item.text;
      
      if (rawSource) {
        try {
          parsedText = typeof rawSource === 'string' ? JSON.parse(rawSource) : rawSource;
        } catch (e) {
          console.warn('Failed to parse AI JSON:', e);
        }
      }

      // Извлекаем метрики склада
      let metricsObj = {};
      const rawMetrics = item.metrics || item.metrics_json || item.key_metrics || parsedText.key_metrics;
      if (rawMetrics) {
        try {
          metricsObj = typeof rawMetrics === 'string' ? JSON.parse(rawMetrics) : rawMetrics;
        } catch (e) {
          // Если не JSON, возможно это уже объект
          metricsObj = rawMetrics;
        }
      }

      // Выделяем структурированные инсайты, выводы и рекомендации
      const insights = item.insights || parsedText.insights || [];
      const summary = item.summary || parsedText.summary || '';
      const keyMetrics = item.key_metrics || parsedText.key_metrics || {};
      const recommendations = item.recommendations || parsedText.recommendations || [];

      // Определяем здоровье склада
      let healthScore = 100;
      if (typeof item.health_score === 'number') {
        healthScore = item.health_score;
      } else if (typeof keyMetrics.health_score === 'number') {
        healthScore = keyMetrics.health_score;
      } else if (typeof item.health_score === 'string') {
        healthScore = parseInt(item.health_score) || 100;
      }

      const generatedAt = item.generated_at || item.date || new Date().toISOString();

      return {
        ...item,
        ai_report: item.report || item.ai_report || summary || '',
        summary_json: metricsObj,
        insights,
        summary,
        key_metrics: keyMetrics,
        recommendations,
        health_score: healthScore,
        date: new Date(generatedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }),
        fullDate: generatedAt
      };
    })
    .sort((a, b) => new Date(b.fullDate) - new Date(a.fullDate));
};

export default api;
