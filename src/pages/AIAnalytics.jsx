import { useEffect, useState, useMemo } from 'react';
import { fetchInventory } from '../api/config'; // Keep fetchInventory for ABC analysis
import {
  Loader2, AlertCircle, Brain, Zap, Target, TrendingUp, AlertTriangle,
  CheckCircle2, Layers, BarChart3, Lightbulb, Activity, Sparkles
} from 'lucide-react';

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */
const getHealthConfig = (score) => {
  if (score >= 70) return {
    color: 'text-success', bg: 'bg-success/10', border: 'border-success/20',
    stroke: '#22c55e', status: 'Стабильная работа'
  };
  if (score >= 40) return {
    color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20',
    stroke: '#f59e0b', status: 'Умеренные дефициты'
  };
  return {
    color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/20',
    stroke: '#ef4444', status: 'Критические проблемы'
  };
};

const getInsightConfig = (type) => {
  switch (type) {
    case 'risk': return {
      icon: <AlertTriangle size={18} />, badge: '⚠️ Риск',
      bg: 'bg-danger/5', border: 'border-danger/20', tagBg: 'bg-danger/10', tagText: 'text-danger', tagBorder: 'border-danger/20'
    };
    case 'opportunity': return {
      icon: <TrendingUp size={18} />, badge: '📈 Возможность',
      bg: 'bg-success/5', border: 'border-success/20', tagBg: 'bg-success/10', tagText: 'text-success', tagBorder: 'border-success/20'
    };
    case 'anomaly': return {
      icon: <Zap size={18} />, badge: '📉 Аномалия',
      bg: 'bg-warning/5', border: 'border-warning/20', tagBg: 'bg-warning/10', tagText: 'text-warning', tagBorder: 'border-warning/20'
    };
    default: return {
      icon: <Target size={18} />, badge: '🔥 Тренд',
      bg: 'bg-primary/5', border: 'border-primary/20', tagBg: 'bg-primary/10', tagText: 'text-primary', tagBorder: 'border-primary/20'
    };
  }
};

const getImpactConfig = (impact) => {
  if (impact === 'high') return { text: 'Критичный', cls: 'bg-danger/20 text-danger border-danger/30' };
  if (impact === 'medium') return { text: 'Средний', cls: 'bg-warning/20 text-warning border-warning/30' };
  return { text: 'Низкий', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
};

const getABCAnalysis = (inventoryItems) => {
  if (!inventoryItems || inventoryItems.length === 0) return { A: [], B: [], C: [] };
  const sorted = [...inventoryItems].sort((a, b) => (b.avgConsumption || 0) - (a.avgConsumption || 0));
  const totalConsumption = sorted.reduce((sum, item) => sum + (item.avgConsumption || 0), 0);

  if (totalConsumption === 0) {
    const aLimit = Math.ceil(sorted.length * 0.2);
    const bLimit = Math.ceil(sorted.length * 0.5);
    return { A: sorted.slice(0, aLimit), B: sorted.slice(aLimit, bLimit), C: sorted.slice(bLimit) };
  }

  let runningSum = 0;
  const A = [], B = [], C = [];
  sorted.forEach(item => {
    runningSum += (item.avgConsumption || 0);
    const ratio = runningSum / totalConsumption;
    if (ratio <= 0.70) A.push(item);
    else if (ratio <= 0.90) B.push(item);
    else C.push(item);
  });
  if (A.length === 0 && sorted.length > 0) A.push(sorted[0]);
  return { A, B, C };
};

/* ──────────────────────────────────────────────
   Health Gauge SVG
   ────────────────────────────────────────────── */
const HealthGauge = ({ score }) => {
  const config = getHealthConfig(score);
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 112 112">
        <circle cx="56" cy="56" r={radius} className="stroke-white/5" strokeWidth="7" fill="transparent" />
        <circle
          cx="56" cy="56" r={radius}
          stroke={config.stroke} strokeWidth="7" fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-2xl font-black ${config.color}`}>{score}%</span>
        <span className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">Здоровье</span>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────── */
const AIAnalytics = () => {
  // 1. Добавь стейты для управления данными и лоадером
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inventory, setInventory] = useState([]); // Keep for ABC analysis
  const [activeTab, setActiveTab] = useState('verdict');

  /* ── Fetch Data ── */
  // 2. Добавь хук useEffect, который при монтировании компонента делает fetch запрос на URL вебхука.
  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      setError(null); // Clear previous errors
      try {
        // Fetch inventory data (for ABC analysis), independent of AI analytics webhook
        const inv = await fetchInventory().catch(() => []);
        setInventory(inv);

        // ВАЖНО: В коде запроса используй строку "https://a1-n8n1.alem.ai/webhook/analytics_snapshots"
        const res = await fetch("https://a1-n8n1.alem.ai/webhook/analytics_snapshots");
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        const resultObj = Array.isArray(data) ? data[0] : data;
        
        let reportObj = resultObj;
        if (resultObj && resultObj.body && typeof resultObj.body === 'object') {
          reportObj = resultObj.body;
        }

        // If the reportObj contains a raw_ai_response string, parse it. Otherwise use reportObj itself
        let parsedAI = reportObj;
        if (reportObj && reportObj.raw_ai_response) {
          try {
            parsedAI = typeof reportObj.raw_ai_response === 'string' ? JSON.parse(reportObj.raw_ai_response) : reportObj.raw_ai_response;
          } catch (e) {
            console.warn('Failed to parse raw_ai_response:', e);
          }
        }
        setAnalyticsData(parsedAI);
      } catch (err) {
        console.error('Failed to load AI analytics:', err);
        setError('Ошибка при загрузке предиктивной аналитики от ИИ.');
        setAnalyticsData(null); // Ensure analyticsData is null on error
      } finally {
        setLoading(false);
      }
    };
    loadAllData();
  }, []); // Empty dependency array means this runs once on mount

  /* ── Derived Data ── */
  const healthScore = typeof analyticsData?.key_metrics?.health_score === 'number' 
    ? analyticsData.key_metrics.health_score 
    : (typeof analyticsData?.health_score === 'number' ? analyticsData.health_score : 0);
    
  const criticalItemsCount = analyticsData?.key_metrics?.critical_items || 0;
  const growthItemsCount = analyticsData?.key_metrics?.growth_items || 0;

  // Helper parser for matching and extracting numeric details from insight text descriptions
  const parseMetricsFromText = (text, matchedProductName, inventoryItem) => {
    const metrics = {
      current_stock: inventoryItem?.stock ?? 0,
      avg_daily_sales: inventoryItem?.avgConsumption ?? 0,
      days_left: 0,
      lead_time_days: inventoryItem?.leadTime ?? 0,
      sales_trend: inventoryItem?.salesTrend ?? 0
    };

    if (metrics.avg_daily_sales > 0) {
      metrics.days_left = parseFloat((metrics.current_stock / metrics.avg_daily_sales).toFixed(1));
    }

    if (!text) return metrics;
    const lowerText = text.toLowerCase();

    const daysRegex = /(?:\b\d+(?:\.\d+)?\b\s*(?:,|и|или|до)\s*)*\b\d+(?:\.\d+)?\b\s*(?:дня|дней|дн|суток)/g;
    let daysMatch;
    const daysMatches = [];
    while ((daysMatch = daysRegex.exec(lowerText)) !== null) {
      const numbers = daysMatch[0].match(/\d+(?:\.\d+)?/g);
      if (numbers) {
        daysMatches.push(...numbers.map(Number));
      }
    }
    
    const stockRegex = /(\d+)\s*(?:шт|единиц|остаток|запас)/g;
    let stockMatch;
    const stockMatches = [];
    while ((stockMatch = stockRegex.exec(lowerText)) !== null) {
      stockMatches.push(parseInt(stockMatch[1], 10));
    }

    const trendRegex = /(?:trend|тренд)\s*(\d+(?:\.\d+)?)/g;
    let trendMatch = trendRegex.exec(lowerText);
    if (trendMatch) {
      metrics.sales_trend = parseFloat(trendMatch[1]);
    } else {
      const trendPercentRegex = /(?:\+|\-)(\d+)%/g;
      let trendPercentMatch = trendPercentRegex.exec(lowerText);
      if (trendPercentMatch) {
        metrics.sales_trend = parseInt(trendPercentMatch[1], 10) / 100;
      }
    }

    const leadRegex = /(?:поставки|доставки)\s*(?:—|-|от поставщика)?\s*(\d+)\s*(?:дней|дня|дн)/i;
    let leadMatch = leadRegex.exec(lowerText);
    if (leadMatch) {
      metrics.lead_time_days = parseInt(leadMatch[1], 10);
    }

    const parts = lowerText.split(/(?:и|,|соответственно|\.|\n)/);

    // Find all inventory items mentioned in this text, and see where they appear.
    const mentionedProducts = [];
    inventory.forEach(invItem => {
      const cleanName = invItem.name ? invItem.name.replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase() : '';
      const sku = invItem.sku ? invItem.sku.toLowerCase() : '';
      
      let firstIdx = -1;
      if (sku && lowerText.includes(sku)) {
        firstIdx = lowerText.indexOf(sku);
      } else if (cleanName && cleanName.length > 5 && lowerText.includes(cleanName)) {
        firstIdx = lowerText.indexOf(cleanName);
      }
      
      if (firstIdx !== -1) {
        mentionedProducts.push({
          sku: invItem.sku,
          name: invItem.name,
          index: firstIdx
        });
      }
    });

    // Sort them by their position in the text
    mentionedProducts.sort((a, b) => a.index - b.index);

    // Find our current product's index among the mentioned products
    let productIndex = -1;
    if (matchedProductName) {
      productIndex = mentionedProducts.findIndex(p => p.name === matchedProductName);
    } else if (inventoryItem) {
      productIndex = mentionedProducts.findIndex(p => p.sku === inventoryItem.sku);
    }

    if (productIndex !== -1) {
      if (daysMatches.length > productIndex) {
        metrics.days_left = daysMatches[productIndex];
      }
      
      const demandMatches = [];
      const demandSentence = parts.find(p => p.includes("спросе") || p.includes("потреблении") || p.includes("спрос"));
      if (demandSentence) {
        const numbers = demandSentence.match(/\d+(?:\.\d+)?/g);
        if (numbers) {
          demandMatches.push(...numbers.map(Number));
        }
      }
      if (demandMatches.length > productIndex) {
        metrics.avg_daily_sales = demandMatches[productIndex];
      }
    } else {
      if (daysMatches.length > 0) metrics.days_left = daysMatches[0];
      if (stockMatches.length > 0) metrics.current_stock = stockMatches[0];
    }

    if (metrics.current_stock !== undefined && metrics.avg_daily_sales > 0 && !metrics.days_left) {
      metrics.days_left = parseFloat((metrics.current_stock / metrics.avg_daily_sales).toFixed(1));
    }

    return metrics;
  };

  // Process, match, and enrich insights with inventory details for the tables
  const insights = useMemo(() => {
    const rawInsights = analyticsData?.insights || [];
    if (rawInsights.length === 0) return [];
    
    const structuredInsights = [];
    
    rawInsights.forEach(insight => {
      const matchedItems = [];
      
      inventory.forEach(invItem => {
        const cleanName = invItem.name ? invItem.name.replace(/\s*\(.*?\)\s*/g, '').trim() : '';
        const nameWords = cleanName.split(/\s+/).filter(w => w.length > 2);
        
        const skuMatch = invItem.sku && (
          insight.title.toLowerCase().includes(invItem.sku.toLowerCase()) || 
          insight.description.toLowerCase().includes(invItem.sku.toLowerCase())
        );
        
        let nameMatch = false;
        if (cleanName && cleanName.length > 5) {
          nameMatch = insight.title.toLowerCase().includes(cleanName.toLowerCase()) || 
                      insight.description.toLowerCase().includes(cleanName.toLowerCase());
        }
        
        let phraseMatch = false;
        if (nameWords.length >= 2) {
          const firstTwoWords = nameWords.slice(0, 2).join(' ').toLowerCase();
          phraseMatch = insight.title.toLowerCase().includes(firstTwoWords) || 
                        insight.description.toLowerCase().includes(firstTwoWords);
        }
        
        if (skuMatch || nameMatch || phraseMatch) {
          matchedItems.push(invItem);
        }
      });
      
      if (matchedItems.length > 0) {
        matchedItems.forEach(invItem => {
          const parsedMetrics = parseMetricsFromText(insight.description, invItem.name, invItem);
          
          structuredInsights.push({
            ...insight,
            sku: invItem.sku,
            name: invItem.name,
            supplier_name: invItem.supplier || 'Неизвестен',
            current_stock: parsedMetrics.current_stock,
            avg_daily_sales: parsedMetrics.avg_daily_sales,
            days_left: parsedMetrics.days_left,
            lead_time_days: parsedMetrics.lead_time_days,
            sales_trend: parsedMetrics.sales_trend,
          });
        });
      } else {
        // Fallback row if no product matches
        structuredInsights.push({
          ...insight,
          sku: 'N/A',
          name: insight.title,
          supplier_name: '—',
          current_stock: 0,
          avg_daily_sales: 0,
          days_left: 0,
          lead_time_days: 0,
          sales_trend: 0
        });
      }
    });
    
    return structuredInsights;
  }, [analyticsData, inventory]);

  const abc = useMemo(() => getABCAnalysis(inventory), [inventory]);
  const totalItems = inventory.length || 1;
  const pctA = Math.round((abc.A.length / totalItems) * 100);
  const pctB = Math.round((abc.B.length / totalItems) * 100);
  const pctC = 100 - pctA - pctB;

  const healthConfig = getHealthConfig(healthScore);

  /* ── Loading ── */
  // 4. Добавь условие загрузки: если loading === true, показывай по центру текст или спиннер "Загрузка предиктивной аналитики от ИИ...".
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary mb-4" size={40} />
        <p className="text-muted-foreground">Загрузка предиктивной аналитики от ИИ...</p>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-danger">
        <AlertCircle size={40} className="mb-4" />
        <p>{error}</p>
      </div>
    );
  }

  // If not loading and no error, but analyticsData is still null, it means fetch failed to get data
  if (!analyticsData) {
    return <div className="text-center py-20 text-muted-foreground">AI-отчёт отсутствует или не удалось загрузить.</div>;
  }

  /* ──────────────────────────────────────────────
     Render
     ────────────────────────────────────────────── */
  return (
    <div className="space-y-6 animate-fade-in pb-10">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
          <Brain size={24} className="text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">AI Аналитика</h2>
          <p className="text-xs text-muted-foreground font-medium">Предиктивный анализ от ИИ</p>
        </div>
      </div>

      {/* ── Top Metric Cards (3 columns) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Card 1: Health */}
        <div className="glass-card p-5 border-white/5">
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-3">Показатель здоровья</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-black text-white mb-1">Статус цепи поставок</div>
              <div className={`text-xs font-bold ${healthConfig.color}`}>{healthConfig.status}</div>
            </div>
            {/* 5. Интегрируй данные в верстку вместо нулей: Показатель здоровья */}
            <HealthGauge score={healthScore} />
          </div>
        </div>

        {/* Card 2: Deficit */}
        <div className={`glass-card p-5 ${healthConfig.border} ${healthConfig.bg}`}>
          <div className="text-[10px] uppercase font-bold text-danger tracking-widest mb-3">Дефицит & Риски</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                {/* 5. Интегрируй данные в верстку вместо нулей: Дефицит & Риски */}
                <span className="text-4xl font-black text-white">{criticalItemsCount}</span>
                <span className="text-sm font-bold text-muted-foreground">SKU</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Требуют срочного пополнения остатков</div>
            </div>
            <div className="w-14 h-14 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center">
              <AlertTriangle className="text-danger" size={24} />
            </div>
          </div>
        </div>

        {/* Card 3: Growth */}
        <div className="glass-card p-5 border-success/10 bg-success/[0.02]">
          <div className="text-[10px] uppercase font-bold text-success tracking-widest mb-3">Тренды & Рост</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                {/* 5. Интегрируй данные в верстку вместо нулей: Тренды & Рост */}
                <span className="text-4xl font-black text-white">{growthItemsCount}</span>
                <span className="text-sm font-bold text-muted-foreground">SKU</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Демонстрируют высокий темп продаж</div>
            </div>
            <div className="w-14 h-14 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center">
              <TrendingUp className="text-success" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* ── Left: Tabs ── */}
        <div className="lg:col-span-3">

          {/* Tab Buttons */}
          <div className="flex gap-0 border-b border-white/10 mb-6">
            {[
              { key: 'verdict', label: 'ВЕРДИКТ ИИ' },
              // 6. Интегрируй данные во вкладки (Tabs): ДЕФИЦИТНЫЕ SKU
              { key: 'deficit', label: `ДЕФИЦИТНЫЕ SKU (${insights.filter(i => i.type === 'risk').length})` },
              // 6. Интегрируй данные во вкладки (Tabs): ЛИДЕРЫ И РОСТ
              { key: 'leaders', label: `ЛИДЕРЫ И РОСТ (${insights.filter(i => i.type === 'opportunity' || i.type === 'anomaly').length})` }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all relative ${
                  activeTab === tab.key ? 'text-primary' : 'text-muted-foreground hover:text-white'
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            ))}
          </div>

          {/* ── Tab 1: Verdict ── */}
          {activeTab === 'verdict' && (
            <div className="space-y-6 animate-fade-in">

              {/* AI Summary */}
              <div className="glass-card p-6 border-l-4 border-l-primary bg-primary/[0.02]">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={18} className="text-primary" />
                  <h3 className="text-lg font-bold text-white">Сводка аудита (AI Summary)</h3>
                </div>
                {/* 6. Интегрируй данные во вкладки (Tabs): ВЕРДИКТ ИИ */}
                {analyticsData.summary ? (
                  <p className="text-sm text-gray-300 leading-relaxed">{analyticsData.summary}</p>
                ) : (
                  <p className="text-sm text-gray-300 leading-relaxed">Анализ завершён. Все позиции проверены.</p>
                )}
              </div>

              {/* Recommendations */}
              {analyticsData.recommendations && analyticsData.recommendations.length > 0 && (
                <div className="glass-card p-6 border-white/5">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <CheckCircle2 size={20} className="text-success" />
                    Рекомендации по оптимизации
                  </h3>
                  <ul className="space-y-3">
                    {analyticsData.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex gap-3 text-sm text-gray-300">
                        <span className="w-5 h-5 rounded-full bg-success/10 border border-success/20 flex items-center justify-center text-[10px] font-bold text-success shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Insights Grid */}
              {insights.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Brain size={20} className="text-primary" />
                    Инсайты цепи поставок
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {insights.map((insight, idx) => {
                      const cfg = getInsightConfig(insight.type);
                      const imp = getImpactConfig(insight.impact);
                      return (
                        <div key={idx} className={`glass-card p-5 ${cfg.bg} ${cfg.border} flex flex-col justify-between`}>
                          <div>
                            <div className="flex justify-between items-start mb-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${cfg.tagBg} ${cfg.tagText} ${cfg.tagBorder}`}>
                                {cfg.badge}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${imp.cls}`}>
                                Импакт: {imp.text}
                              </span>
                            </div>
                            <h4 className="font-bold text-white text-sm mb-2">{insight.title}</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
                          </div>
                          <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/5 flex gap-2 items-start">
                            <Lightbulb size={16} className="text-primary shrink-0 mt-0.5" />
                            <p className="text-[11px] text-gray-300 leading-normal">{insight.recommendation}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab 2: Deficit ── */}
          {activeTab === 'deficit' && (
            <div className="glass-card overflow-hidden animate-fade-in border-white/5">
              {/* 6. Интегрируй данные во вкладки (Tabs): ДЕФИЦИТНЫЕ SKU */}
              {insights.filter(i => i.type === 'risk').length === 0 ? (
                <div className="p-12 text-center">
                  <CheckCircle2 size={32} className="text-success mx-auto mb-3" />
                  <p className="text-muted-foreground">Ни один товар не находится в дефицитной зоне</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <th className="px-5 py-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Товар / SKU</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Поставщик</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">В наличии</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Расход/дн</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Дней осталось</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Заказ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {insights.filter(i => i.type === 'risk').map((item, i) => {
                        const days = parseFloat(item.days_left) || 0;
                        const badgeCls = days > 1.5 ? 'bg-warning/10 text-warning border-warning/20' : 'bg-danger/10 text-danger border-danger/20';
                        return (
                          <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                            <td className="px-5 py-3">
                              <div className="font-bold text-white text-sm">{item.name || item.sku}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">{item.sku}</div>
                            </td>
                            <td className="px-5 py-3 text-sm text-gray-300">{item.supplier_name || '—'}</td>
                            <td className="px-5 py-3 text-sm font-bold text-white">{item.current_stock || 0} шт</td>
                            <td className="px-5 py-3 text-sm text-muted-foreground">{item.avg_daily_sales ? parseFloat(item.avg_daily_sales).toFixed(2) : '—'}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2.5 py-1 rounded text-xs font-bold border ${badgeCls}`}>{days} дн</span>
                            </td>
                            <td className="px-5 py-3 text-sm text-muted-foreground">{item.lead_time_days || '?'} дн</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Tab 3: Leaders ── */}
          {activeTab === 'leaders' && (
            <div className="glass-card overflow-hidden animate-fade-in border-white/5">
              {/* 6. Интегрируй данные во вкладки (Tabs): ЛИДЕРЫ И РОСТ */}
              {insights.filter(i => i.type === 'opportunity' || i.type === 'anomaly').length === 0 ? (
                <div className="p-12 text-center">
                  <BarChart3 size={32} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Нет данных по лидерам роста в текущем срезе</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <th className="px-5 py-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Товар / SKU</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">В наличии</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Прод./дн</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Тип</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wider text-right">Динамика</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {insights.filter(i => i.type === 'opportunity' || i.type === 'anomaly').map((item, i) => (
                        <tr key={`leader-${i}`} className="hover:bg-white/[0.01] transition-colors">
                          <td className="px-5 py-3">
                            <div className="font-bold text-white text-sm">{item.name || item.sku}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{item.sku}</div>
                          </td>
                          <td className="px-5 py-3 text-sm font-semibold text-white">{item.current_stock || 0} шт</td>
                          <td className="px-5 py-3 text-sm text-muted-foreground">{item.avg_daily_sales ? parseFloat(item.avg_daily_sales).toFixed(2) : '—'}</td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.type === 'opportunity' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-warning/10 text-warning border-warning/20'}`}>
                              {item.type === 'opportunity' ? 'Рост' : 'Аномалия'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="text-success text-sm font-bold flex items-center justify-end gap-1">
                              <TrendingUp size={14} />
                              {item.sales_trend ? `+${(item.sales_trend * 100).toFixed(0)}%` : '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Back Button */}
          <div className="flex justify-center pt-6">
            <button
              onClick={() => window.history.back()}
              className="glass-card px-6 py-2.5 text-sm font-bold text-muted-foreground hover:text-white hover:border-white/20 transition-all rounded-xl border border-white/5"
            >
              ВЕРНУТЬСЯ К ИСТОРИИ
            </button>
          </div>
        </div>

        {/* ── Right: ABC Sidebar ── */}
        <div className="lg:col-span-1">
          <div className="glass-card p-5 border-white/5 sticky top-4 space-y-4">
            <div className="flex items-center gap-2">
              <Layers size={20} className="text-primary" />
              <h3 className="text-base font-bold text-white">ABC-анализ склада</h3>
            </div>
            <p className="text-xs text-muted-foreground">Классификация ассортимента по объёму ежедневных продаж.</p>

            {/* Progress Bar */}
            <div className="h-3 w-full rounded-full bg-white/5 overflow-hidden flex">
              <div style={{ width: `${pctA}%` }} className="h-full bg-primary transition-all" />
              <div style={{ width: `${pctB}%` }} className="h-full bg-warning transition-all" />
              <div style={{ width: `${pctC}%` }} className="h-full bg-gray-500 transition-all" />
            </div>

            {/* Class A */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span className="text-sm font-bold text-white">Класс A (Высокий спрос)</span>
              </div>
              <p className="text-xs text-muted-foreground">70% продаж • {abc.A.length} SKU ({pctA}%)</p>
              <div className="mt-2 space-y-1">
                {abc.A.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs py-1 px-2 bg-white/[0.02] rounded-lg">
                    <span className="text-gray-300 truncate max-w-[130px]" title={item.name}>{item.name}</span>
                    <span className="text-primary font-bold">{(item.avgConsumption || 0).toFixed(1)}/дн</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Class B */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-warning" />
                <span className="text-sm font-bold text-white">Класс B (Стабильный спрос)</span>
              </div>
              <p className="text-xs text-muted-foreground">20% продаж • {abc.B.length} SKU ({pctB}%)</p>
            </div>

            {/* Class C */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                <span className="text-sm font-bold text-white">Класс C (Низкий спрос)</span>
              </div>
              <p className="text-xs text-muted-foreground">10% продаж • {abc.C.length} SKU ({pctC}%)</p>
            </div>

            {/* AI Insights */}
            <div className="border-t border-white/5 pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Lightbulb size={16} className="text-primary animate-pulse" />
                <span className="text-sm font-bold text-white">Инсайты</span>
              </div>

              {criticalItemsCount > 0 && (
                <div className="p-3 bg-danger/5 rounded-xl border border-danger/10">
                  <span className="text-xs font-bold text-white block mb-1">⚠️ Дефицит</span>
                  <p className="text-[11px] text-gray-300">{criticalItemsCount} SKU требуют срочного пополнения. Риск остановки продаж.</p>
                </div>
              )}

              {abc.C.length > 0 && (
                <div className="p-3 bg-warning/5 rounded-xl border border-warning/10">
                  <span className="text-xs font-bold text-white block mb-1">💡 Капитал</span>
                  <p className="text-[11px] text-gray-300">Класс C — {pctC}% ассортимента. Рекомендуется сократить страховой запас.</p>
                </div>
              )}

              {growthItemsCount > 0 && (
                <div className="p-3 bg-success/5 rounded-xl border border-success/10">
                  <span className="text-xs font-bold text-white block mb-1">🚀 Рост</span>
                  <p className="text-[11px] text-gray-300">{growthItemsCount} SKU с высоким темпом продаж. Зарезервируйте объёмы на 1.5-2 месяца.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAnalytics;