import { useEffect, useState } from 'react';
import { fetchPurchaseRequests } from '../api/config';
import { 
  FileText, 
  Send, 
  Eye, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Search,
  ExternalLink,
  Loader2
} from 'lucide-react';

const Orders = () => {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  useEffect(() => {
    fetchPurchaseRequests().then(data => {
      setRequests(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedRequests = [...requests].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Отправлено': return <CheckCircle2 className="text-success" size={16} />;
      case 'На верификации': return <AlertCircle className="text-warning" size={16} />;
      default: return <Clock className="text-muted-foreground" size={16} />;
    }
  };

  const handleApprove = () => {
    // Mock n8n webhook call
    alert(`Заявка ${selectedOrder.id} одобрена и отправлена поставщику ${selectedOrder.supplier} через n8n!`);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div>
          <h2 className="text-2xl font-bold">Журнал заявок</h2>
          <p className="text-muted-foreground">История автоматических и ручных заказов поставщикам</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary">
            <Search size={18} />
            Поиск
          </button>
          <button className="btn-primary">
            <Send size={18} />
            Новая заявка
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden animate-slide-up" style={{ animationDelay: '0.2s' }}>
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="animate-spin text-primary mb-4" size={40} />
            <p className="text-muted-foreground">Загружаем журнал из базы данных...</p>
          </div>
        ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/5">
              <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase cursor-pointer hover:text-white" onClick={() => requestSort('id')}>
                <div className="flex items-center gap-1">
                  ID / SKU {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </div>
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase cursor-pointer hover:text-white" onClick={() => requestSort('supplier')}>
                <div className="flex items-center gap-1">
                  Поставщик {sortConfig.key === 'supplier' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </div>
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase cursor-pointer hover:text-white" onClick={() => requestSort('qty')}>
                <div className="flex items-center gap-1">
                  Кол-во {sortConfig.key === 'qty' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </div>
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase cursor-pointer hover:text-white" onClick={() => requestSort('date')}>
                <div className="flex items-center gap-1">
                  Дата {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </div>
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase cursor-pointer hover:text-white" onClick={() => requestSort('status')}>
                <div className="flex items-center gap-1">
                  Статус {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </div>
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase text-right">Черновик AI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedRequests.map((order) => (
              <tr key={order.id} className="hover:bg-white/5">
                <td className="px-6 py-4">
                  <div className="font-mono text-sm">{order.id}</div>
                  <div className="text-[10px] text-muted-foreground">{order.sku}</div>
                </td>
                <td className="px-6 py-4 font-medium">{order.supplier}</td>
                <td className="px-6 py-4 text-sm font-bold text-primary">{order.qty} шт.</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{order.date}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm">
                    {getStatusIcon(order.status)}
                    {order.status}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => { setSelectedOrder(order); setIsModalOpen(true); }}
                    className="flex items-center gap-2 text-primary hover:text-blue-400 text-sm font-medium ml-auto"
                  >
                    Открыть
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      {isModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-2xl max-h-[80vh] flex flex-col animate-in slide-in-from-top-4">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Просмотр черновика заявки</h3>
                <p className="text-sm text-muted-foreground">{selectedOrder.id} • {selectedOrder.supplier}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground" title="Закрыть">
                <ExternalLink size={20} className="rotate-45" />
              </button>
            </div>
            <div className="p-8 overflow-y-auto bg-slate-950/40 flex-1">
              <div className="bg-slate-900 p-6 rounded-lg border border-slate-800 font-serif leading-relaxed text-slate-100 whitespace-pre-wrap">
                {selectedOrder.content ? selectedOrder.content : (
                  <>
                    <p>Уважаемый менеджер {selectedOrder.supplier},</p>
                    <br />
                    <p>На основе анализа товарных остатков нашей системы просим подготовить коммерческое предложение на поставку следующих позиций:</p>
                    <ul className="list-disc ml-6 mt-4 space-y-2">
                      <li>Артикул: {selectedOrder.sku} — {selectedOrder.qty} шт.</li>
                    </ul>
                    <br />
                    <p>Просим подтвердить наличие товара на складе и выставить счет.</p>
                  </>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-white/10 flex">
              <button 
                className="w-full bg-primary hover:bg-blue-600 py-3 rounded-xl text-sm font-bold text-center transition-all" 
                style={{ color: '#ffffff' }}
                onClick={() => setIsModalOpen(false)}
              >
                Закрыть окно
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
