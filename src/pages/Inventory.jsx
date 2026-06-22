import { useEffect, useState } from 'react';
import axios from 'axios';
import { fetchInventory } from '../api/config';
import { 
  Search, 
  Filter, 
  Download, 
  Plus, 
  Minus,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Package,
  Loader2
} from 'lucide-react';

const Inventory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSKU, setSelectedSKU] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'sku', direction: 'asc' });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchInventory();
        setItems(data);
      } catch (err) {
        setError('Ошибка при загрузке данных со склада');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredSKUs = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedSKUs = [...filteredSKUs].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const getStatus = (item) => {
    if (item.stock <= item.minLevel) return 'deficit';
    if (item.stock > item.minLevel * 3) return 'surplus';
    return 'normal';
  };

  const handleStockUpdate = async (type) => {
    const qtyInput = document.getElementById('stock-qty');
    const qty = parseInt(qtyInput.value);
    if (!qty || !selectedSKU) return;

    try {
      setLoading(true);
      const diff = type === 'sale' ? -qty : qty;
      
      // РЕАЛЬНЫЙ ВЫЗОВ n8n
      await axios.post('https://a1-n8n1.alem.ai/webhook/update-stock', {
        sku: selectedSKU.sku,
        diff: diff,
        new_stock: selectedSKU.stock + diff // Передаем и разницу, и итоговое значение для удобства
      });
      
      // Локальное обновление для мгновенного фидбека
      setItems(prev => prev.map(item => {
        if (item.id === selectedSKU.id) {
          return { ...item, stock: Math.max(0, item.stock + diff) };
        }
        return item;
      }));
      
      setIsModalOpen(false);
      
      if (type === 'sale' && (selectedSKU.stock + diff) <= selectedSKU.minLevel) {
        alert(`Внимание! Товар ${selectedSKU.name} упал ниже критического уровня. Бот запустил процесс генерации заявки.`);
      }
    } catch (err) {
      alert('Ошибка при связи с n8n: убедитесь, что вебхук /update-stock настроен и активен');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div>
          <h2 className="text-2xl font-bold">Склад & Остатки</h2>
          <p className="text-muted-foreground">Управление запасами и имитация движения товара</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary group">
            <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
            Экспорт Excel
          </button>
        </div>
      </div>

      <div className="glass-card p-4 flex flex-col md:flex-row gap-4 items-center justify-between animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input 
            type="text" 
            placeholder="Поиск по SKU, названию или поставщику..." 
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground border border-white/5">
            <Filter size={20} />
          </button>
          <select className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option>Все категории</option>
            <option>Электроавтоматика</option>
            <option>Кабель</option>
            <option>Освещение</option>
          </select>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <Loader2 className="animate-spin text-primary mb-4" size={40} />
            <p className="text-muted-foreground">Загрузка актуальных остатков из БД...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-danger">
            <AlertCircle size={40} className="mb-4" />
            <p>{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 text-sm underline hover:text-white"
            >
              Попробовать снова
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('sku')}>
                  <div className="flex items-center gap-1">
                    SKU / Артикул {sortConfig.key === 'sku' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('name')}>
                  <div className="flex items-center gap-1">
                    Название товара {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => requestSort('supplier')}>
                  <div className="flex items-center gap-1">
                    Поставщик {sortConfig.key === 'supplier' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center cursor-pointer hover:text-white" onClick={() => requestSort('stock')}>
                  <div className="flex items-center justify-center gap-1">
                    Остаток {sortConfig.key === 'stock' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center cursor-pointer hover:text-white" onClick={() => requestSort('minLevel')}>
                  <div className="flex items-center justify-center gap-1">
                    Мин. уровень {sortConfig.key === 'minLevel' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedSKUs.map((item) => {
                const status = getStatus(item);
                return (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4 font-mono text-sm">{item.sku}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.category}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">{item.supplier}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                        status === 'deficit' ? 'text-danger bg-danger/10 animate-pulse' : 
                        status === 'surplus' ? 'text-info bg-info/10' : 
                        'text-foreground'
                      }`}>
                        {item.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-muted-foreground">{item.minLevel}</td>
                    <td className="px-6 py-4">
                      {status === 'deficit' && (
                        <span className="flex items-center gap-1 text-xs text-danger font-medium">
                          <AlertCircle size={14} /> Дефицит
                        </span>
                      )}
                      {status === 'surplus' && (
                        <span className="flex items-center gap-1 text-xs text-info font-medium">
                          <TrendingDown size={14} /> Неликвид
                        </span>
                      )}
                      {status === 'normal' && (
                        <span className="flex items-center gap-1 text-xs text-success font-medium">
                          <TrendingUp size={14} /> В норме
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Modal Mockup */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-8 animate-in zoom-in-95 duration-200 shadow-2xl border-primary/20">
            <h3 className="text-xl font-bold mb-4">Изменение остатков (Имитация)</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Товар</label>
                <div className="text-lg font-medium">{selectedSKU?.name}</div>
                <div className="text-xs text-muted-foreground mt-1">Текущий остаток: {selectedSKU?.stock} шт.</div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Количество</label>
                <input 
                  id="stock-qty"
                  type="number" 
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 mt-1 focus:ring-primary focus:border-primary" 
                  placeholder="Введите количество..."
                  defaultValue="1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <button 
                  className="px-4 py-3 bg-danger text-white rounded-xl hover:bg-red-600 transition-colors font-bold flex flex-col items-center gap-1"
                  onClick={() => handleStockUpdate('sale')}
                >
                  <Minus size={20} />
                  Списать (Продажа)
                </button>
                <button 
                  className="px-4 py-3 bg-success text-white rounded-xl hover:bg-green-600 transition-colors font-bold flex flex-col items-center gap-1"
                  onClick={() => handleStockUpdate('restock')}
                >
                  <Plus size={20} />
                  Приход товара
                </button>
              </div>
              <button 
                className="w-full text-muted-foreground hover:text-white pt-2 text-sm" 
                onClick={() => setIsModalOpen(false)}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
