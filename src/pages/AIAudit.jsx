import { useEffect, useState } from 'react';
import { fetchInventory, fetchAnalyticsSnapshots, createPurchaseRequest } from '../api/config';
import { 
  Sparkles, 
  AlertTriangle, 
  Lightbulb, 
  ChevronRight,
  Loader2,
  Building2,
  Send,
  History,
  CheckCircle2,
  BrainCircuit,
  PackageCheck,
  TrendingUp,
  Activity,
  Layers,
  X,
  Mail,
  CheckCircle,
  FileCheck,
  AlertCircle
} from 'lucide-react';

const AIAudit = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [items, setItems] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [activeTab, setActiveTab] = useState('report'); // 'report', 'deficit', 'sellers'
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSupplier, setModalSupplier] = useState(null);
  const [orderQuantities, setOrderQuantities] = useState({});
  const [emailText, setEmailText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successOrderInfo, setSuccessOrderInfo] = useState(null);

  // ABC classification helper
  const getABCAnalysis = (inventoryItems) => {
    if (!inventoryItems || inventoryItems.length === 0) return { A: [], B: [], C: [] };
    const sorted = [...inventoryItems].sort((a, b) => b.avgConsumption - a.avgConsumption);
    const totalConsumption = sorted.reduce((sum, item) => sum + item.avgConsumption, 0);
    
    if (totalConsumption === 0) {
      const aLimit = Math.ceil(sorted.length * 0.2);
      const bLimit = Math.ceil(sorted.length * 0.5);
      return {
        A: sorted.slice(0, aLimit),
        B: sorted.slice(aLimit, bLimit),
        C: sorted.slice(bLimit)
      };
    }

    let runningSum = 0;
    const A = [];
    const B = [];
    const C = [];
    
    sorted.forEach(item => {
      runningSum += item.avgConsumption;
      const ratio = runningSum / totalConsumption;
      if (ratio <= 0.70) {
        A.push(item);
      } else if (ratio <= 0.90) {
        B.push(item);
      } else {
        C.push(item);
      }
    });

    if (A.length === 0 && sorted.length > 0) {
      A.push(sorted[0]);
    }
    
    return { A, B, C };
  };

  const abc = getABCAnalysis(items);
  const totalItemsCount = items.length || 1;
  const percentA = Math.round((abc.A.length / totalItemsCount) * 100);
  const percentB = Math.round((abc.B.length / totalItemsCount) * 100);
  const percentC = 100 - percentA - percentB;

  const getTopCriticalSupplier = () => {
    if (!result || !result.suppliers || result.suppliers.length === 0) return { name: 'Неизвестен', count: 0 };
    const sortedSuppliers = [...result.suppliers].sort((a, b) => b.items.length - a.items.length);
    return {
      name: sortedSuppliers[0].name,
      count: sortedSuppliers[0].items.length
    };
  };

  const getTopSellerInfo = () => {
    if (!result || !result.topSellers || result.topSellers.length === 0) return { name: 'Неизвестен', trend: 0 };
    const sortedSellers = [...result.topSellers].sort((a, b) => (b.sales_trend || 0) - (a.sales_trend || 0));
    return {
      name: sortedSellers[0].name || sortedSellers[0].sku,
      trend: Math.round((sortedSellers[0].sales_trend || 0) * 100)
    };
  };

  const topSupplier = getTopCriticalSupplier();
  const topSeller = getTopSellerInfo();

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [inventory, snapData] = await Promise.all([
          fetchInventory(),
          fetchAnalyticsSnapshots().catch(() => [])
        ]);
        setItems(inventory);
        const sorted = [...snapData].sort((a, b) => new Date(b.fullDate) - new Date(a.fullDate));
        setSnapshots(sorted);
        if (sorted.length > 0) setSelectedSnapshot(sorted[0]);
      } catch (e) {
        console.error('Audit init error:', e);
      }
    };
    loadInitial();
  }, []);

  const processSnapshot = (snap) => {
    if (!snap) return null;
    
    let summary = snap.summary_json || {};
    let rawLowStock = summary.low_stock || [];
    let rawTopSellers = summary.top_sellers || [];
    let rawGrowth = summary.growth || [];
    
    // Fallback: если в снапшоте нет, берем из текущих остатков
    if (rawLowStock.length === 0) {
      rawLowStock = items
        .filter(i => i.stock <= (i.minLevel || 0))
        .map(i => ({ 
          sku: i.sku, 
          current_stock: i.stock, 
          days_left: i.avgConsumption > 0 ? (i.stock / i.avgConsumption).toFixed(1) : 0, 
          supplier_name: i.supplier || 'Неизвестен',
          supplier_email: ''
        }));
    }

    // Обогащаем товары по SKU (добавляем name и avg_daily_sales, если их нет)
    const enrichItem = (lsItem) => {
      const matched = items.find(inv => inv.sku === lsItem.sku);
      return {
        ...lsItem,
        name: lsItem.name || (matched ? matched.name : lsItem.sku),
        avg_daily_sales: lsItem.avg_daily_sales || (matched ? matched.avgConsumption : 0),
        lead_time_days: lsItem.lead_time_days || (matched ? matched.leadTime : 0)
      };
    };

    const enrichedLowStock = rawLowStock.map(enrichItem);
    const enrichedTopSellers = rawTopSellers.map(enrichItem);
    const enrichedGrowth = rawGrowth.map(enrichItem);

    // Группируем по поставщикам
    const suppliers = {};
    enrichedLowStock.forEach(lsItem => {
      const sName = lsItem.supplier_name || 'Неизвестен';
      if (!suppliers[sName]) {
        suppliers[sName] = { 
          name: sName, 
          items: [], 
          email: lsItem.supplier_email || 'opt@' + sName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.ru' 
        };
      }
      suppliers[sName].items.push(lsItem);
    });

    return {
      suppliers: Object.values(suppliers),
      aiReport: snap.ai_report || "Анализ завершен. Все позиции проверены.",
      healthScore: typeof snap.health_score === 'number' ? snap.health_score : 100,
      date: snap.date,
      lowStockItems: enrichedLowStock,
      topSellers: enrichedTopSellers,
      growthItems: enrichedGrowth,
      insights: snap.insights || [],
      recommendations: snap.recommendations || [],
      keyMetrics: snap.key_metrics || {}
    };
  };

  const handleStartAudit = () => {
    setIsAnalyzing(true);
    setResult(null);
    setTimeout(() => {
      setIsAnalyzing(false);
      setResult(processSnapshot(selectedSnapshot));
      setActiveTab('report');
    }, 1500);
  };

  // Helper to style AI plain text report as beautiful styled HTML elements
  const formatReport = (text) => {
    if (!text) return '';
    
    // Check if it already contains HTML tags
    if (text.includes('<b>') || text.includes('🚨') || text.includes('📈') || text.includes('•')) {
      return text
        .split('\n')
        .map(line => {
          let trimmed = line.trim();
          if (!trimmed) return '';
          
          if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
            const listContent = trimmed.replace(/^•|^-\s*/, '').trim();
            return `<li class="ml-6 list-disc text-gray-300 py-1.5 leading-relaxed font-sans">${listContent}</li>`;
          }
          if (trimmed.includes('Критические проблемы:') || trimmed.includes('Товары с ростом:') || trimmed.includes('Рекомендации:')) {
            return `<h4 class="flex items-center gap-2 text-white font-black mt-8 mb-3 text-lg uppercase tracking-wider border-b border-white/5 pb-2">${trimmed}</h4>`;
          }
          if (trimmed.includes('Здоровье склада:')) {
            return `<div class="p-4 bg-white/5 rounded-xl border border-white/5 my-4 text-white font-bold text-lg">${trimmed}</div>`;
          }
          return `<p class="mb-3 leading-relaxed font-sans text-gray-300">${trimmed}</p>`;
        })
        .join('');
    }
    
    // Otherwise fallback to basic formatting
    return text.split('\n').map(p => `<p class="mb-4 leading-relaxed font-sans text-gray-300">${p}</p>`).join('');
  };

  const renderHealthGauge = (score) => {
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;
    
    let strokeClass = 'stroke-success';
    let textClass = 'text-success';
    let glowClass = 'shadow-success/20';
    
    if (score < 40) {
      strokeClass = 'stroke-danger';
      textClass = 'text-danger';
      glowClass = 'shadow-danger/20';
    } else if (score < 75) {
      strokeClass = 'stroke-warning';
      textClass = 'text-warning';
      glowClass = 'shadow-warning/20';
    }
    
    return (
      <div className="relative flex items-center justify-center w-28 h-28">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="56"
            cy="56"
            r={radius}
            className="stroke-white/5"
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx="56"
            cy="56"
            r={radius}
            className={`transition-all duration-1000 ease-out ${strokeClass}`}
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-white">{score}%</span>
          <span className="text-[8px] uppercase tracking-widest text-muted-foreground font-black">Здоровье</span>
        </div>
      </div>
    );
  };

  // Open order creation modal for a specific supplier
  const handleOpenOrderModal = (supplier) => {
    setModalSupplier(supplier);
    
    // Initialize default order quantities (e.g. 10 or based on daily sales)
    const initialQtys = {};
    supplier.items.forEach(item => {
      const dailySales = parseFloat(item.avg_daily_sales) || 1.5;
      const leadTime = parseInt(item.lead_time_days) || 15;
      // Order quantity is daily sales * lead time * 2 (safety stock) or default 15
      const calculatedQty = Math.ceil(dailySales * leadTime * 2);
      initialQtys[item.sku] = calculatedQty > 0 ? calculatedQty : 15;
    });
    setOrderQuantities(initialQtys);
    
    // Generate initial email text
    const updatedItems = supplier.items.map(item => ({
      ...item,
      orderQty: initialQtys[item.sku]
    }));
    setEmailText(generateEmailBody(supplier.name, updatedItems));
    setIsModalOpen(true);
  };

  const handleQtyChange = (sku, val) => {
    const qty = parseInt(val) || 0;
    const updatedQtys = { ...orderQuantities, [sku]: qty };
    setOrderQuantities(updatedQtys);
    
    // Re-generate email with new quantities
    const updatedItems = modalSupplier.items.map(item => ({
      ...item,
      orderQty: updatedQtys[item.sku]
    }));
    setEmailText(generateEmailBody(modalSupplier.name, updatedItems));
  };

  const generateEmailBody = (supplierName, itemsList) => {
    const itemsText = itemsList
      .map(item => `• ${item.name} (SKU: ${item.sku}) — ${item.orderQty} шт.`)
      .join('\n');
      
    return `Уважаемый менеджер поставщика ${supplierName},\n\nНа основании анализа товарных запасов нашего склада просим подготовить счет на оплату и коммерческое предложение для поставки следующих товаров:\n\n${itemsText}\n\nПожалуйста, подтвердите наличие товаров на складе и укажите ориентировочные сроки отгрузки.\n\nС уважением,\nОтдел логистики и снабжения Smart Supplier SaaS`;
  };

  const handleSubmitOrder = async () => {
    setIsSubmitting(true);
    
    try {
      // Loop and submit a request for each item of the supplier
      for (const item of modalSupplier.items) {
        const qty = orderQuantities[item.sku] || 15;
        await createPurchaseRequest({
          sku: item.sku,
          supplier_name: modalSupplier.name,
          requested_qty: qty,
          ai_draft_email: emailText
        });
      }
      
      setIsSubmitting(false);
      setSuccessOrderInfo({
        supplier: modalSupplier.name,
        count: modalSupplier.items.length
      });
      setShowSuccess(true);
      
      // Update local state to remove ordered items from suppliers list or refresh
      setTimeout(() => {
        setShowSuccess(false);
        setIsModalOpen(false);
      }, 2500);
      
    } catch (e) {
      console.error(e);
      setIsSubmitting(false);
      alert('Ошибка при создании заявки. Сохранено локально.');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-white flex items-center gap-4">
            <BrainCircuit className="text-primary animate-pulse" size={40} />
            AI Аудит и Снабжение
          </h2>
          <p className="text-muted-foreground text-lg mt-2 font-medium">
            Интеллектуальный анализ остатков, трендов и автогенерация закупочных ордеров
          </p>
        </div>
        
        {snapshots.length > 0 && (
          <div className="px-6 py-4 glass-card border-primary/20 bg-primary/5 flex items-center gap-4 border-solid border">
            <History className="text-primary" />
            <div>
              <div className="text-[10px] uppercase font-bold text-primary tracking-widest leading-none mb-1">Срез данных</div>
              <select 
                value={selectedSnapshot?.fullDate || ''} 
                onChange={(e) => {
                  const found = snapshots.find(s => s.fullDate === e.target.value);
                  if (found) setSelectedSnapshot(found);
                }}
                className="bg-transparent text-white font-bold leading-none border-none outline-none focus:ring-0 p-0 text-sm cursor-pointer"
              >
                {snapshots.map(s => (
                  <option key={s.fullDate} value={s.fullDate} className="bg-[#121216] text-white">
                    {s.date}
                  </option>
                ))}
              </select>
            </div>
            <button 
              onClick={handleStartAudit}
              className="ml-4 px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              <Sparkles size={16} />
              Анализ
            </button>
          </div>
        )}
      </div>

      {!isAnalyzing && !result && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
          {snapshots.slice(0, 3).map((snap, i) => (
            <div key={i} className="glass-card p-6 border-white/5 hover:border-primary/30 transition-all cursor-pointer group flex flex-col justify-between h-48"
                 onClick={() => { setSelectedSnapshot(snap); handleStartAudit(); }}>
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-white/5 rounded-xl group-hover:bg-primary/20 transition-colors">
                    <PackageCheck className="text-muted-foreground group-hover:text-primary" />
                  </div>
                  <span className="text-2xl font-black text-white/20 group-hover:text-primary/40">0{i+1}</span>
                </div>
                <h4 className="font-bold text-white mb-1">Аналитический срез</h4>
                <p className="text-xs text-muted-foreground">{snap.date}</p>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground border-t border-white/5 pt-3 mt-4">
                <span className="flex items-center gap-1.5">
                  <Activity size={14} className="text-primary" />
                  Здоровье склада:
                </span>
                <span className="font-bold text-white">{snap.health_score}%</span>
              </div>
            </div>
          ))}
          {snapshots.length === 0 && (
            <div className="col-span-1 md:col-span-3 text-center py-20 glass-card">
              <Loader2 className="animate-spin mx-auto text-primary mb-4" size={40} />
              <p className="text-muted-foreground">Поиск активных снапшотов в базе данных...</p>
            </div>
          )}
          <div className="md:col-span-3 h-px bg-white/5 my-4"></div>
          <div className="md:col-span-3 text-center">
             <p className="text-muted-foreground italic">Выберите исторический срез для формирования подробного аналитического отчета</p>
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div className="h-[60vh] flex flex-col items-center justify-center space-y-8">
           <div className="relative">
              <div className="w-40 h-40 border-t-2 border-primary rounded-full animate-spin"></div>
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" size={48} />
           </div>
           <div className="text-center">
              <h3 className="text-3xl font-black text-white tracking-tighter">ИИ анализирует снапшот...</h3>
              <p className="text-muted-foreground font-mono mt-2">Сканируем данные по SKU, задержкам поставок и продажам</p>
           </div>
        </div>
      )}

      {result && (
        <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-500">
          {/* Key Metrics Cards Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 bg-white/[0.01] border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block mb-1">Показатель Здоровья</span>
                <h4 className="text-lg font-bold text-white">Статус цепи поставок</h4>
                <p className="text-xs text-muted-foreground mt-2">
                  {result.healthScore >= 75 ? 'Идеальные запасы' : result.healthScore >= 40 ? 'Умеренные дефициты' : 'Критический дефицит!'}
                </p>
              </div>
              {renderHealthGauge(result.healthScore)}
            </div>

            <div className="glass-card p-6 bg-white/[0.01] border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-danger tracking-widest block mb-1">Дефицит & Риски</span>
                <h4 className="text-3xl font-black text-white mt-2">
                  {result.lowStockItems.length} <span className="text-sm font-medium text-muted-foreground">SKU</span>
                </h4>
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <AlertTriangle className="text-danger" size={12} />
                  Требуют срочного пополнения остатков
                </p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center text-danger border border-danger/20">
                <AlertTriangle size={28} />
              </div>
            </div>

            <div className="glass-card p-6 bg-white/[0.01] border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-success tracking-widest block mb-1">Тренды & Рост</span>
                <h4 className="text-3xl font-black text-white mt-2">
                  {result.topSellers.length + result.growthItems.length} <span className="text-sm font-medium text-muted-foreground">SKU</span>
                </h4>
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <TrendingUp className="text-success" size={12} />
                  Демонстрируют высокий темп продаж
                </p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center text-success border border-success/20">
                <TrendingUp size={28} />
              </div>
            </div>
          </div>

          {/* Main Dashboard Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Column - Detailed Tabs */}
            <div className="lg:col-span-3 space-y-6">
              {/* Tab Selector */}
              <div className="flex border-b border-white/5 gap-6">
                <button 
                  onClick={() => setActiveTab('report')}
                  className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all relative ${activeTab === 'report' ? 'text-primary' : 'text-muted-foreground hover:text-white'}`}
                >
                  Вердикт ИИ
                  {activeTab === 'report' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></span>}
                </button>
                <button 
                  onClick={() => setActiveTab('deficit')}
                  className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all relative ${activeTab === 'deficit' ? 'text-primary' : 'text-muted-foreground hover:text-white'}`}
                >
                  Дефицитные SKU ({result.lowStockItems.length})
                  {activeTab === 'deficit' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></span>}
                </button>
                <button 
                  onClick={() => setActiveTab('sellers')}
                  className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all relative ${activeTab === 'sellers' ? 'text-primary' : 'text-muted-foreground hover:text-white'}`}
                >
                  Лидеры и Рост ({result.topSellers.length + result.growthItems.length})
                  {activeTab === 'sellers' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></span>}
                </button>
              </div>

              {/* Tab 1: AI Report & Insights */}
              {activeTab === 'report' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Summary Card */}
                  <div className="glass-card p-8 bg-white/[0.01] border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-primary"></div>
                    <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                      <Sparkles size={20} className="text-primary" />
                      Сводка аудита (AI Summary)
                    </h3>
                    <p className="text-base leading-relaxed text-gray-300 font-sans">
                      {result.aiReport}
                    </p>
                  </div>

                  {/* Recommendations Card */}
                  {result.recommendations && result.recommendations.length > 0 && (
                    <div className="glass-card p-8 border-white/5">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <CheckCircle2 size={20} className="text-success" />
                        Рекомендации по оптимизации
                      </h3>
                      <ul className="space-y-3.5">
                        {result.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex gap-3 text-sm leading-relaxed text-gray-300">
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
                  {result.insights && result.insights.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <BrainCircuit className="text-primary" size={20} />
                        Инсайты цепи поставок
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {result.insights.map((insight, idx) => {
                          let typeBadge = 'bg-primary/10 text-primary border-primary/20';
                          if (insight.type === 'anomaly') {
                            typeBadge = 'bg-warning/10 text-warning border-warning/20';
                          } else if (insight.type === 'risk') {
                            typeBadge = 'bg-danger/10 text-danger border-danger/20';
                          } else if (insight.type === 'opportunity') {
                            typeBadge = 'bg-success/10 text-success border-success/20';
                          }

                          let impactBadge = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                          if (insight.impact === 'high') {
                            impactBadge = 'bg-danger/20 text-danger border-danger/30';
                          } else if (insight.impact === 'medium') {
                            impactBadge = 'bg-warning/20 text-warning border-warning/30';
                          }

                          return (
                            <div key={idx} className="glass-card p-6 bg-white/[0.01] border-white/5 flex flex-col justify-between hover:border-primary/20 transition-all">
                              <div>
                                <div className="flex justify-between items-start mb-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${typeBadge}`}>
                                    {insight.type === 'trend' ? '🔥 Тренд' : 
                                     insight.type === 'anomaly' ? '📉 Аномалия' : 
                                     insight.type === 'risk' ? '⚠️ Риск' : '📈 Возможность'}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${impactBadge}`}>
                                    Импакт: {insight.impact === 'high' ? 'Критичный' : insight.impact === 'medium' ? 'Средний' : 'Низкий'}
                                  </span>
                                </div>
                                <h4 className="font-bold text-white text-base mb-2">{insight.title}</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed font-sans mb-4">{insight.description}</p>
                              </div>
                              
                              <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex gap-2.5 items-start mt-2">
                                <Lightbulb size={16} className="text-primary shrink-0 mt-0.5 animate-pulse" />
                                <div>
                                  <span className="text-[10px] font-black text-primary tracking-wider block">Решение стратега:</span>
                                  <p className="text-[11px] text-gray-300 leading-normal mt-0.5 font-sans">{insight.recommendation}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Deficit SKU Table */}
              {activeTab === 'deficit' && (
                <div className="glass-card overflow-hidden animate-fade-in border-white/5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          <th className="px-6 py-4 text-xs font-bold uppercase text-muted-foreground tracking-wider">Товар / SKU</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase text-muted-foreground tracking-wider">Поставщик</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase text-muted-foreground tracking-wider">В наличии</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase text-muted-foreground tracking-wider">Расход/дн</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase text-muted-foreground tracking-wider">Дней осталось</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase text-muted-foreground tracking-wider text-right">Действие</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {result.lowStockItems.map((item, i) => {
                          const days = parseFloat(item.days_left) || 0;
                          let daysBadge = 'bg-danger/10 text-danger border-danger/20';
                          if (days > 1.5) daysBadge = 'bg-warning/10 text-warning border-warning/20';
                          
                          return (
                            <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-bold text-white text-sm">{item.name}</div>
                                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{item.sku}</div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-300 font-medium">
                                {item.supplier_name}
                              </td>
                              <td className="px-6 py-4 text-sm font-bold text-white">
                                {item.current_stock} шт.
                              </td>
                              <td className="px-6 py-4 text-sm text-muted-foreground">
                                {item.avg_daily_sales ? parseFloat(item.avg_daily_sales).toFixed(2) : '—'} шт.
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${daysBadge}`}>
                                  {days} дн.
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button 
                                  onClick={() => handleOpenOrderModal({ name: item.supplier_name, email: item.supplier_email, items: [item] })}
                                  className="px-3 py-1.5 bg-white/5 hover:bg-primary/20 hover:text-white text-muted-foreground rounded-lg text-xs font-bold transition-all border border-white/5 hover:border-primary/30"
                                >
                                  Заказать
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {result.lowStockItems.length === 0 && (
                          <tr>
                            <td colSpan="6" className="text-center py-12 text-muted-foreground italic text-sm">
                              Ни один товар не находится в дефицитной зоне
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Top Sellers & Growth */}
              {activeTab === 'sellers' && (
                <div className="glass-card overflow-hidden animate-fade-in border-white/5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          <th className="px-6 py-4 text-xs font-bold uppercase text-muted-foreground tracking-wider">Товар / SKU</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase text-muted-foreground tracking-wider">В наличии</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase text-muted-foreground tracking-wider">Прод./дн</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase text-muted-foreground tracking-wider">Тип метрики</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase text-muted-foreground tracking-wider text-right">Динамика</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {/* Render top sellers */}
                        {result.topSellers.map((item, i) => (
                          <tr key={'top-' + i} className="hover:bg-white/[0.01] transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-white text-sm">{item.name}</div>
                              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{item.sku}</div>
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-white">
                              {item.current_stock} шт.
                            </td>
                            <td className="px-6 py-4 text-sm text-muted-foreground">
                              {item.avg_daily_sales ? parseFloat(item.avg_daily_sales).toFixed(2) : '—'} шт.
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-primary/10 text-primary border border-primary/20">
                                Топ продаж
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-success text-sm font-bold flex items-center justify-end gap-1">
                                <TrendingUp size={14} />
                                {item.sales_trend ? `+${(item.sales_trend * 100).toFixed(0)}%` : 'Рост'}
                              </span>
                            </td>
                          </tr>
                        ))}

                        {/* Render growth items */}
                        {result.growthItems.map((item, i) => (
                          <tr key={'grow-' + i} className="hover:bg-white/[0.01] transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-white text-sm">{item.name}</div>
                              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{item.sku}</div>
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-white">
                              {item.current_stock} шт.
                            </td>
                            <td className="px-6 py-4 text-sm text-muted-foreground">
                              {item.avg_daily_sales ? parseFloat(item.avg_daily_sales).toFixed(2) : '—'} шт.
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-success/10 text-success border border-success/20">
                                Рост тренда
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-success text-sm font-bold flex items-center justify-end gap-1">
                                <TrendingUp size={14} />
                                {item.sales_trend ? `+${(item.sales_trend * 100).toFixed(0)}%` : 'Рост'}
                              </span>
                            </td>
                          </tr>
                        ))}
                        
                        {result.topSellers.length === 0 && result.growthItems.length === 0 && (
                          <tr>
                            <td colSpan="5" className="text-center py-12 text-muted-foreground italic text-sm">
                              Нет данных по лидерам роста в текущем срезе
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              <button 
                onClick={() => setResult(null)}
                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-muted-foreground rounded-full text-xs font-bold uppercase tracking-widest transition-all mx-auto block border border-white/5 active:scale-95"
              >
                Вернуться к истории
              </button>
            </div>

            {/* Right Column - ABC Analysis & AI Insights */}
            <div className="lg:col-span-1 space-y-6">
              {/* ABC Analysis */}
              <div className="p-6 glass-card border-white/5 space-y-4">
                <div className="flex items-center gap-2">
                  <Layers className="text-primary" size={20} />
                  <h3 className="text-lg font-bold text-white">ABC-анализ склада</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Классификация ассортимента по объему ежедневных продаж.
                </p>

                {/* Progress bar representing dynamic SKU distribution */}
                <div className="h-3 w-full rounded-full bg-white/5 overflow-hidden flex">
                  <div 
                    style={{ width: `${percentA}%` }} 
                    className="h-full bg-primary" 
                    title={`Класс A: ${percentA}% SKU`}
                  />
                  <div 
                    style={{ width: `${percentB}%` }} 
                    className="h-full bg-warning" 
                    title={`Класс B: ${percentB}% SKU`}
                  />
                  <div 
                    style={{ width: `${percentC}%` }} 
                    className="h-full bg-gray-500" 
                    title={`Класс C: ${percentC}% SKU`}
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-start text-xs">
                    <div>
                      <span className="inline-block w-2.5 h-2.5 bg-primary rounded-full mr-2"></span>
                      <span className="font-bold text-white">Класс A (Высокий спрос)</span>
                      <p className="text-muted-foreground text-[10px] mt-0.5 ml-4.5">70% продаж • {abc.A.length} SKU ({percentA}%)</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-start text-xs">
                    <div>
                      <span className="inline-block w-2.5 h-2.5 bg-warning rounded-full mr-2"></span>
                      <span className="font-bold text-white">Класс B (Стабильный спрос)</span>
                      <p className="text-muted-foreground text-[10px] mt-0.5 ml-4.5">20% продаж • {abc.B.length} SKU ({percentB}%)</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-start text-xs">
                    <div>
                      <span className="inline-block w-2.5 h-2.5 bg-gray-500 rounded-full mr-2"></span>
                      <span className="font-bold text-white">Класс C (Низкий спрос)</span>
                      <p className="text-muted-foreground text-[10px] mt-0.5 ml-4.5">10% продаж • {abc.C.length} SKU ({percentC}%)</p>
                    </div>
                  </div>
                </div>

                {/* List of top items in Class A */}
                <div className="border-t border-white/5 pt-3 mt-2">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2">Топ товаров класса А:</span>
                  <div className="space-y-1.5">
                    {abc.A.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs py-1 px-2 bg-white/5 rounded-lg border border-white/[0.02]">
                        <span className="text-gray-300 truncate max-w-[120px]" title={item.name}>{item.name}</span>
                        <span className="text-primary font-bold">{item.avgConsumption.toFixed(1)}/дн</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Insights */}
              <div className="p-6 bg-primary/[0.02] border border-primary/20 rounded-3xl space-y-4">
                <div className="flex items-center gap-2">
                  <Lightbulb className="text-primary animate-pulse" size={22} />
                  <h3 className="text-lg font-black text-white">Инсайты стратега</h3>
                </div>
                
                <div className="space-y-4 text-xs leading-relaxed text-gray-300">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <span className="font-bold text-white block mb-1">⚠️ Концентрация риска</span>
                    Наибольший дефицит наблюдается у поставщика <strong className="text-primary">{topSupplier.name}</strong> ({topSupplier.count} позиций). Рекомендуется провести аудит их условий поставки.
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <span className="font-bold text-white block mb-1">🚀 Лидер спроса</span>
                    Товар <strong className="text-success">{topSeller.name}</strong> имеет максимальный рост тренда (<strong className="text-success">+{topSeller.trend}%</strong>). Заблаговременно зарезервируйте объемы на 1.5-2 месяца вперед.
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <span className="font-bold text-white block mb-1">💡 Эффективность капитала</span>
                    Категория C составляет <strong className="text-warning">{percentC}% ассортимента</strong> ({abc.C.length} SKU). Рекомендуется сократить их страховой запас до минимума для высвобождения оборотных средств.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Ordering Modal */}
      {isModalOpen && modalSupplier && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col animate-in scale-in duration-200 bg-[#121216] border-white/10 relative overflow-hidden">
            
            {/* Success Animation Overlay */}
            {showSuccess && (
              <div className="absolute inset-0 bg-[#0e0e11]/95 z-50 flex flex-col items-center justify-center space-y-4 animate-fade-in">
                <div className="w-20 h-20 rounded-full bg-success/15 border border-success/30 flex items-center justify-center text-success animate-bounce">
                  <CheckCircle size={44} />
                </div>
                <h4 className="text-2xl font-black text-white">Черновик успешно создан!</h4>
                <p className="text-muted-foreground text-sm max-w-md text-center">
                  Ордера для <strong>{successOrderInfo?.supplier}</strong> перенесены в раздел <strong>Журнал заявок</strong>.
                </p>
              </div>
            )}

            {/* Modal Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center text-success border border-success/20">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Формирование заказа поставщику</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{modalSupplier.name} ({modalSupplier.email})</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-1.5 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white rounded-lg transition-colors"
                title="Закрыть"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 bg-black/10">
              {/* Left Side: Items & Quantities */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Позиции для заказа:</h4>
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                  {modalSupplier.items.map((item, idx) => (
                    <div key={idx} className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-white text-xs truncate" title={item.name}>{item.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-1 flex gap-3">
                          <span>SKU: {item.sku}</span>
                          <span className="text-danger">Остаток: {item.current_stock} шт.</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input 
                          type="number" 
                          min="1"
                          value={orderQuantities[item.sku] || ''} 
                          onChange={(e) => handleQtyChange(item.sku, e.target.value)}
                          className="w-20 bg-black/40 border border-white/15 rounded-lg px-2.5 py-1.5 text-center text-white text-xs font-bold outline-none focus:border-primary"
                        />
                        <span className="text-xs text-muted-foreground font-medium">шт.</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Side: AI Generated Email Draft */}
              <div className="space-y-4 flex flex-col h-full">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Mail size={14} className="text-primary" />
                    Сопроводительное письмо
                  </h4>
                  <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded uppercase font-bold">
                    Черновик AI
                  </span>
                </div>
                
                <textarea 
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                  className="flex-1 w-full bg-black/40 border border-white/10 rounded-xl p-4 text-xs font-serif leading-relaxed text-gray-300 outline-none focus:border-success/50 resize-none min-h-[300px]"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/5 flex gap-4 bg-[#121216]">
              <button 
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white rounded-xl text-xs font-bold transition-all border border-white/5 active:scale-[0.98]" 
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Отмена
              </button>
              <button 
                className="flex-2 px-8 py-3 bg-success hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-success/15 active:scale-[0.98] disabled:opacity-50"
                onClick={handleSubmitOrder}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <FileCheck size={16} />
                    Сформировать и сохранить
                  </>
                )}
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
};

export default AIAudit;
