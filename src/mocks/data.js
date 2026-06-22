export const mockSKUs = [
  { id: 1, sku: "EL-001", name: "Автоматический выключатель ABB S201 C16", supplier: "ABB Russia", stock: 5, minLevel: 10, avgConsumption: 1.2, category: "Электроавтоматика" },
  { id: 2, sku: "EL-002", name: "Кабель ВВГнг-LS 3x2.5", supplier: "Камкабель", stock: 450, minLevel: 100, avgConsumption: 15.5, category: "Кабель" },
  { id: 3, sku: "EL-003", name: "Розетка Schneider Electric AtlasDesign", supplier: "Schneider Electric", stock: 85, minLevel: 20, avgConsumption: 2.5, category: "Электроустановочные" },
  { id: 4, sku: "EL-004", name: "Светильник светодиодный 600x600", supplier: "IEK Group", stock: 12, minLevel: 50, avgConsumption: 4.8, category: "Освещение" },
  { id: 5, sku: "EL-005", name: "Счётчик электроэнергии Меркурий 230", supplier: "Инкотекс", stock: 8, minLevel: 5, avgConsumption: 0.5, category: "Измерительные приборы" },
  { id: 6, sku: "EL-006", name: "УЗО Schneider Electric iID 4P 40A 30mA", supplier: "Schneider Electric", stock: 2, minLevel: 5, avgConsumption: 0.8, category: "Электроавтоматика" },
  { id: 7, sku: "EL-007", name: "Лоток проволочный 100x50", supplier: "ДКС", stock: 120, minLevel: 200, avgConsumption: 25.0, category: "Кабеленесущие системы" },
  { id: 8, sku: "EL-008", name: "Подрозетник HEGEL КУ1102", supplier: "Hegel", stock: 1200, minLevel: 500, avgConsumption: 80.0, category: "Электроустановочные" },
  { id: 9, sku: "EL-009", name: "Клемма WAGO 221-413", supplier: "WAGO", stock: 4500, minLevel: 1000, avgConsumption: 350.0, category: "Расходные материалы" },
  { id: 10, sku: "EL-010", name: "Дифференциальный автомат IEK АД12 2П 16А", supplier: "IEK Group", stock: 15, minLevel: 15, avgConsumption: 1.5, category: "Электроавтоматика" },
  // ... (additional items would go here to reach 50)
];

// Add more mock items dynamically to reach 50
for (let i = 11; i <= 50; i++) {
  const categories = ["Электроавтоматика", "Кабель", "Освещение", "Расходные материалы", "Электроустановочные"];
  const suppliers = ["ABB Russia", "Schneider Electric", "IEK Group", "Legrand", "Энергомера"];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
  const minLevel = Math.floor(Math.random() * 50) + 5;
  const stock = Math.random() > 0.3 ? Math.floor(Math.random() * 100) + minLevel : Math.floor(Math.random() * minLevel);
  
  mockSKUs.push({
    id: i,
    sku: `EL-${String(i).padStart(3, '0')}`,
    name: `${category} Item Spec ${i}`,
    supplier: supplier,
    stock: stock,
    minLevel: minLevel,
    avgConsumption: (Math.random() * 5).toFixed(1),
    category: category
  });
}

export const mockSalesData = [
  { month: 'Янв', sales: 4000, stock: 2400 },
  { month: 'Фев', sales: 3000, stock: 1398 },
  { month: 'Мар', sales: 2000, stock: 9800 },
  { month: 'Апр', sales: 2780, stock: 3908 },
  { month: 'Май', sales: 1890, stock: 4800 },
  { month: 'Июн', sales: 2390, stock: 3800 },
  { month: 'Июл', sales: 3490, stock: 4300 },
  { month: 'Авг', sales: 4200, stock: 3200 },
  { month: 'Сен', sales: 4800, stock: 2800 },
  { month: 'Окт', sales: 5100, stock: 2100 },
  { month: 'Ноя', sales: 4500, stock: 1800 },
  { month: 'Дек', sales: 5600, stock: 2500 },
];

export const mockCategoryData = [
  { name: 'Электроавтоматика', value: 400 },
  { name: 'Кабель', value: 300 },
  { name: 'Освещение', value: 300 },
  { name: 'Установочные', value: 200 },
  { name: 'Расходные', value: 278 },
];

export const mockOrders = [
  { id: 'ORD-2024-001', supplier: 'ABB Russia', date: '2024-06-01', status: 'Отправлено', content: 'Поставка автоматических выключателей серии S201...' },
  { id: 'ORD-2024-002', supplier: 'Schneider Electric', date: '2024-06-03', status: 'Черновик', content: 'Запрос на розетки и выключатели AtlasDesign...' },
  { id: 'ORD-2024-003', supplier: 'IEK Group', date: '2024-06-04', status: 'На верификации', content: 'Срочная дозакупка светодиодных светильников...' },
];
