# Техническая документация фронтенда системы «СмартСнаб»

## 1. Архитектура компонентов
Проект представляет собой Single Page Application (SPA), разработанное на базе React с использованием Vite. Архитектура построена на функциональных компонентах и React Hooks. Маршрутизация организована с помощью `react-router-dom`.

### Основная структура:
- **`App.jsx`**: Корневой компонент роутинга. Определяет основные пути приложения и оборачивает их в общий интерфейс.
- **`Layout` (`components/Layout.jsx`)**: Компонент-обертка, задающий общий каркас (сайдбар навигации, шапка).
- **Страницы (`src/pages/`)**:
  - `Dashboard`: Главная панель с основной сводкой.
  - `Inventory`: Раздел управления складскими остатками (без лишних колонок "Действия", с фокусом на данные).
  - `AIAnalytics` (маршруты `/ai-audit`, `/ai-analytics`): Раздел с отчетами от AI, содержащий таблицы дефицита и лидеров, а также общую аналитику.
  - `Orders`: Управление заказами, генерация email-заявок партнерам, управление подтверждением заказов.
  - `Settings`: Страница настроек, в которой реализованы моковые настройки пользователя и переключение глобальной темы (светлая/темная) с использованием React Context или глобального состояния.

## 2. Логика интеграции с вебхуками n8n
Фронтенд плотно интегрирован с оркестратором n8n через REST API вызовы (используется `axios`). Настройки запросов вынесены в `src/api/config.js`.

### Особенности интеграции:
1. **Динамический маппинг ответов**: Вебхуки могут возвращать данные в различном формате в зависимости от цепочки (array или object). Интеграция умеет безопасно приводить ответ к массиву:
   ```javascript
   const data = Array.isArray(response.data) ? response.data : [response.data].filter(Boolean);
   ```
2. **Разворачивание (Unwrapping) n8n Body**: В некоторых сценариях n8n возвращает вложенную структуру, где полезная нагрузка лежит внутри поля `body`. 
   ```javascript
   const validData = data.map(item => item.body ? item.body : item);
   ```

## 3. Управление стейтами загрузки
Для обеспечения плавного пользовательского опыта (UX) приложение активно использует стейты загрузки и обработки ошибок. В компонентах применяются паттерны на основе `useState` и `useEffect`:

```javascript
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
const [data, setData] = useState([]);

useEffect(() => {
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchFromN8n();
      setData(response);
    } catch (err) {
      setError('Ошибка загрузки данных. Пожалуйста, попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };
  loadData();
}, []);
```
Пока данные загружаются, отображаются скелетные загрузчики (Skeletons) или спиннеры.

## 4. Парсинг строфицированного JSON raw_ai_response
На странице AI-аналитики (`AIAnalytics.jsx`) реализован защищенный механизм парсинга текстовых ответов, генерируемых LLM и пробрасываемых через n8n. Часто n8n передает готовый ответ ИИ как экранированную строку в поле `raw_ai_response`.

Логика извлечения объекта из строки:
```javascript
let parsedAI = reportObj;

// Проверка наличия raw_ai_response и безопасный парсинг
if (reportObj && reportObj.raw_ai_response) {
  try {
    parsedAI = typeof reportObj.raw_ai_response === 'string' 
      ? JSON.parse(reportObj.raw_ai_response) 
      : reportObj.raw_ai_response;
  } catch (e) {
    console.warn('Не удалось распарсить raw_ai_response:', e);
  }
}
```
После парсинга `parsedAI` используется как источник массивов `insights`, `summary` и `key_metrics` для построения UI.

## 5. Примеры схем данных

### 5.1. Ответ от вебхука аналитики (до парсинга)
```json
{
  "id": "12345",
  "created_at": "2026-06-22T10:00:00Z",
  "raw_ai_response": "{\"summary\": \"Запасы в норме\", \"insights\": [{\"type\": \"deficit\", \"description\": \"Дефицит товара RD-SPC-TARM-56\"}], \"key_metrics\": {\"health_score\": 88}}"
}
```

### 5.2. Структура parsedAI (после JSON.parse)
```json
{
  "summary": "Запасы в норме",
  "key_metrics": {
    "health_score": 88,
    "critical_items": 2,
    "growth_items": 5
  },
  "insights": [
    {
      "type": "deficit",
      "description": "Дефицит товара RD-SPC-TARM-56. Остаток 3 шт.",
      "recommendation": "Заказать 50 шт."
    },
    {
      "type": "leader",
      "description": "Товар MTB-MER-BIG-29 показывает отличные продажи."
    }
  ],
  "recommendations": [
    "Увеличить закупку компонентов",
    "Провести аудит по поставщикам"
  ]
}
```
