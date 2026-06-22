import { useEffect, useState } from 'react';
import { fetchInventory, fetchOrders, fetchAnalyticsSnapshots } from '../api/config';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, 
  AlertTriangle, 
  Banknote, 
  CheckCircle,
  MoreVertical,
  Loader2,
  Sparkles,
  ArrowRight,
  Clock,
  TrendingDown
} from 'lucide-react';

const KPICard = ({ title, value, icon: Icon, trend, color }) => (
  <div className="glass-card p-6 flex flex-col justify-between">
    <div className="flex justify-between items-start">
      <div className={`p-2 rounded-lg bg-${color}-500/20 text-${color}-500`}>
        <Icon size={24} />
      </div>
      <button className="text-muted-foreground hover:text-white">
        <MoreVertical size={20} />
      </button>
    </div>
    <div className="mt-4">
      <h3 className="text-muted-foreground text-sm font-medium">{title}</h3>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-3xl font-bold">{value}</span>
        {trend && (
          <span className={`text-xs ${trend > 0 ? 'text-success' : 'text-danger'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const [items, setItems] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [healthData, setHealthData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveReport, setLiveReport] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [insights, setInsights] = useState({ urgent: [], worst: [] });

  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      try {
        const [inventory, orders, snapshots] = await Promise.all([
          fetchInventory().catch(e => { console.error(e); return []; }),
          fetchOrders().catch(e => { console.error(e); return []; }),
          fetchAnalyticsSnapshots().catch(e => { console.error(e); return []; })
        ]);
        
        setItems(inventory);
        setHealthData(snapshots);

        // Аналитика: Срочные закупки (Stock / AvgSales <= LeadTime + 3)
        const urgent = inventory
          .filter(i => (i.stock / (i.avgConsumption || 1)) <= (i.leadTime + 3))
          .sort((a, b) => (a.stock / (a.avgConsumption || 1)) - (b.stock / (b.avgConsumption || 1)))
          .slice(0, 3);
        
        // Аналитика: Худшие продажи (Dead Stock / Low Trend)
        const worst = inventory
          .filter(i => i.salesTrend < 0.9 || (i.avgConsumption < 0.2 && i.stock > i.minLevel))
          .sort((a, b) => a.salesTrend - b.salesTrend)
          .slice(0, 3);

        setInsights({ urgent, worst });

        // Группировка категорий
        const cats = {};
        inventory.forEach(item => {
          const cat = item.category || 'Прочее';
          cats[cat] = (cats[cat] || 0) + 1;
        });
        setCategoryData(Object.entries(cats).map(([name, value]) => ({ name, value })));

        // Данные графиков
        if (Array.isArray(orders)) {
          const monthlyData = {};
          const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
          orders.forEach(order => {
            if (!order.created_at) return;
            const date = new Date(order.created_at);
            const monthName = monthNames[date.getMonth()];
            if (!monthlyData[monthName]) monthlyData[monthName] = { month: monthName, sales: 0, index: date.getMonth() };
            monthlyData[monthName].sales += parseInt(order.quantity) || 0;
          });
          setSalesData(Object.values(monthlyData).sort((a, b) => a.index - b.index));
        }
        
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadAllData();
  }, []);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary mb-4" size={48} />
        <p className="text-muted-foreground animate-pulse text-lg">Загружаем предиктивную аналитику...</p>
      </div>
    );
  }

  const deficitCount = items.filter(item => item.stock <= item.minLevel).length;
  const salesGrowthCount = items.filter(i => i.salesTrend > 1.1).length;
  const deficitRiskCount = items.filter(i => (i.stock / (i.avgConsumption || 1)) <= (i.leadTime + 3) && i.stock > i.minLevel).length;
  const latestHealthScore = healthData[healthData.length - 1]?.health_score || 100;
  
  // Sort items under risk of running out
  const itemsAtRisk = [...items]
    .filter(i => (i.stock / (i.avgConsumption || 1)) <= (i.leadTime + 3))
    .sort((a, b) => (a.stock / (a.avgConsumption || 1)) - (b.stock / (b.avgConsumption || 1)))
    .slice(0, 5);

  // ABC Classification (70/20/10 cumulative consumption rule)
  const getABCData = () => {
    if (!items || items.length === 0) return { A: [], B: [], C: [] };
    const sorted = [...items].sort((a, b) => b.avgConsumption - a.avgConsumption);
    const totalConsumption = sorted.reduce((sum, item) => sum + item.avgConsumption, 0);
    
    if (totalConsumption === 0) {
      const aLimit = Math.ceil(sorted.length * 0.2);
      const bLimit = Math.ceil(sorted.length * 0.5);
      return { A: sorted.slice(0, aLimit), B: sorted.slice(aLimit, bLimit), C: sorted.slice(bLimit) };
    }

    let runningSum = 0;
    const A = [], B = [], C = [];
    sorted.forEach(item => {
      runningSum += item.avgConsumption;
      const ratio = runningSum / totalConsumption;
      if (ratio <= 0.70) A.push(item);
      else if (ratio <= 0.90) B.push(item);
      else C.push(item);
    });
    if (A.length === 0 && sorted.length > 0) A.push(sorted[0]);
    return { A, B, C };
  };

  const abcData = getABCData();
  const totalItems = items.length || 1;
  const abcPercents = {
    a: Math.round((abcData.A.length / totalItems) * 100),
    b: Math.round((abcData.B.length / totalItems) * 100),
    c: 100 - Math.round((abcData.A.length / totalItems) * 100) - Math.round((abcData.B.length / totalItems) * 100)
  };

  // Extract AI insights from the latest snapshot
  const latestInsights = healthData.length > 0 ? (healthData[0].insights || []) : [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Умная Аналитика</h2>
          <p className="text-muted-foreground">Предиктивный анализ запасов и трендов продаж</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-primary text-sm font-medium ai-glow">
          <Sparkles size={16} />
          ИИ-модель Qwen: Данные актуальны
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <KPICard title="Критические остатки" value={deficitCount} icon={AlertTriangle} color="danger" />
        <KPICard title="Рост продаж (SKU)" value={salesGrowthCount} icon={TrendingUp} color="success" />
        <KPICard title="Риски дефицита (SKU)" value={deficitRiskCount} icon={Clock} color="warning" />
        <KPICard title="Здоровье склада" value={`${latestHealthScore}%`} icon={CheckCircle} color="blue" />
      </div>

      {/* ABC Анализ и Инсайты */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ABC Analysis - Full Classified List */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/20 text-primary">
                <TrendingUp size={20} />
              </div>
              <div>
                <h3 className="text-xl font-bold">ABC Классификация</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">По объёму ежедневного расхода</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/20">A — {abcData.A.length}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-warning/15 text-warning border border-warning/20">B — {abcData.B.length}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-500/15 text-gray-400 border border-gray-500/20">C — {abcData.C.length}</span>
            </div>
          </div>

          {/* ABC Progress Bar */}
          <div className="h-2.5 w-full rounded-full bg-white/5 overflow-hidden flex mb-6">
            <div style={{ width: `${abcPercents.a}%` }} className="h-full bg-primary transition-all duration-1000" title={`A: ${abcPercents.a}%`} />
            <div style={{ width: `${abcPercents.b}%` }} className="h-full bg-warning transition-all duration-1000" title={`B: ${abcPercents.b}%`} />
            <div style={{ width: `${abcPercents.c}%` }} className="h-full bg-gray-500 transition-all duration-1000" title={`C: ${abcPercents.c}%`} />
          </div>

          {/* ABC Items List */}
          <div className="space-y-1 max-h-[380px] overflow-y-auto pr-1">
            {[
              { label: 'Класс A — Высокий спрос', items: abcData.A, color: 'primary', dotClass: 'bg-primary' },
              { label: 'Класс B — Стабильный спрос', items: abcData.B, color: 'warning', dotClass: 'bg-warning' },
              { label: 'Класс C — Низкий спрос', items: abcData.C, color: 'gray-500', dotClass: 'bg-gray-500' },
            ].map(group => (
              <div key={group.label}>
                <div className="flex items-center gap-2 py-2 mt-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${group.dotClass}`}></span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{group.label}</span>
                  <span className="text-[10px] text-muted-foreground">({group.items.length} SKU)</span>
                </div>
                {group.items.slice(0, 8).map((item, idx) => {
                  const maxConsumption = abcData.A[0]?.avgConsumption || 1;
                  const pct = Math.min(100, (item.avgConsumption / maxConsumption) * 100);
                  return (
                    <div key={item.id || idx} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/[0.02] transition-colors group">
                      <span className={`w-5 h-5 rounded-md bg-${group.color}/10 border border-${group.color}/20 flex items-center justify-center text-[9px] font-black text-${group.color} shrink-0`}>
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-white truncate max-w-[200px] font-medium">{item.name}</span>
                          <span className="font-mono text-muted-foreground text-xs shrink-0 ml-2">{item.avgConsumption.toFixed(1)} <span className="text-[9px]">ед/дн</span></span>
                        </div>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden mt-1.5">
                          <div 
                            className={`h-full ${group.dotClass} transition-all duration-1000`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {group.items.length > 8 && (
                  <div className="text-[10px] text-muted-foreground italic pl-10 py-1">
                    и ещё {group.items.length - 8} позиций...
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* AI Insights Sidebar */}
        <div className="glass-card p-6 flex flex-col h-full border-primary/10 bg-primary/[0.01]">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="text-primary animate-pulse" size={22} />
            <h3 className="text-lg font-bold">Инсайты ИИ</h3>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto max-h-[420px] pr-1">
            {latestInsights.length > 0 ? (
              latestInsights.map((insight, idx) => {
                let borderColor = 'border-primary/20';
                let bgColor = 'bg-primary/5';
                let icon = '💡';
                if (insight.type === 'risk' || insight.impact === 'high') {
                  borderColor = 'border-danger/20';
                  bgColor = 'bg-danger/5';
                  icon = '⚠️';
                } else if (insight.type === 'anomaly') {
                  borderColor = 'border-warning/20';
                  bgColor = 'bg-warning/5';
                  icon = '📉';
                } else if (insight.type === 'opportunity') {
                  borderColor = 'border-success/20';
                  bgColor = 'bg-success/5';
                  icon = '📈';
                } else if (insight.type === 'trend') {
                  borderColor = 'border-primary/20';
                  bgColor = 'bg-primary/5';
                  icon = '🔥';
                }

                return (
                  <div key={idx} className={`p-4 rounded-xl border ${borderColor} ${bgColor} transition-all hover:scale-[1.01]`}>
                    <div className="flex items-start gap-2 mb-1.5">
                      <span className="text-sm">{icon}</span>
                      <h4 className="font-bold text-white text-xs leading-snug">{insight.title}</h4>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mb-2 pl-6">{insight.description}</p>
                    {insight.recommendation && (
                      <div className="pl-6 flex gap-1.5 items-start">
                        <ArrowRight size={10} className="text-primary shrink-0 mt-0.5" />
                        <p className="text-[10px] text-primary/80 leading-snug font-medium">{insight.recommendation}</p>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <>
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                  <span className="font-bold text-white block mb-1 text-xs">⚠️ Концентрация риска</span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {deficitCount > 0 
                      ? `${deficitCount} товаров находятся на критическом уровне остатков. Рекомендуется проверить цепочку поставок.`
                      : 'Все товары в пределах нормы. Критических рисков не обнаружено.'}
                  </p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                  <span className="font-bold text-white block mb-1 text-xs">🚀 Тренд роста</span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {salesGrowthCount > 0
                      ? `${salesGrowthCount} SKU демонстрируют устойчивый рост продаж. Обеспечьте запас на 1.5-2 мес. вперёд.`
                      : 'Стабильный спрос. Резких изменений тренда не зафиксировано.'}
                  </p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                  <span className="font-bold text-white block mb-1 text-xs">💡 Эффективность капитала</span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Категория C — {abcPercents.c}% ассортимента ({abcData.C.length} SKU). Сократите страховой запас для высвобождения оборотных средств.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="border-t border-white/5 pt-3 mt-4 text-[10px] text-muted-foreground italic">
            Обновлено: {healthData.length > 0 ? healthData[0].date : 'н/д'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-6 h-[400px] flex flex-col border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="text-primary" size={20} />
              Индекс здоровья склада
            </h3>
            <span className="text-[10px] text-muted-foreground uppercase">Предиктивный тренд</span>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={healthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="date" stroke="#a3a3a3" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#a3a3a3" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#121212', border: '1px solid #ffffff10', borderRadius: '8px' }}
                  itemStyle={{ color: '#3b82f6' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="health_score" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex gap-4 text-[10px] text-muted-foreground">
             <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary"></div> Текущее: {healthData[healthData.length-1]?.health_score || 0}%</div>
             <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-danger"></div> Крит. аномалий: {healthData[healthData.length-1]?.critical_count || 0}</div>
          </div>
        </div>

        <div className="glass-card p-6 h-[400px] flex flex-col">
          <h3 className="text-lg font-semibold mb-6 uppercase tracking-wider text-sm opacity-70">История продаж</h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="month" stroke="#a3a3a3" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#a3a3a3" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#121212', border: '1px solid #ffffff10', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSales)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
