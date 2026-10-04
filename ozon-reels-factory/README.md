# OZON AI REELS FACTORY

**«Из товара — в готовый продающий Reels за несколько минут.»**

Веб-приложение для продавцов Ozon и контент-мейкеров: карточка товара → анализ → 5 рекламных концепций → сценарий → раскадровка → image/video prompts → voiceover → social package → экспорт.

## Запуск

```bash
cd ozon-reels-factory
pnpm install
pnpm dev            # http://localhost:3000 (Express + Vite, один порт)

pnpm build && pnpm start   # production: собранный фронтенд + API
```

Без API-ключей приложение работает в **Demo Mode** — на детерминированном движке шаблонов (`shared/engine.ts`). Интерфейс показывает: «AI API не подключен. Используется демонстрационный режим.»

## Подключение AI

Скопируйте `.env.example` в `.env` и укажите ключ. Ключи читаются только сервером и не попадают в браузер.

| Переменная | Назначение |
| --- | --- |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` | OpenAI или любой OpenAI-совместимый endpoint |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Google Gemini |
| `AI_PROVIDER` | `openai` / `gemini` / `demo`; без него провайдер выбирается по наличию ключа |

Если провайдер вернул ошибку, используется демо-движок, а пользователь видит уведомление с причиной.

## Архитектура

```
shared/      типы, демо-движок (анализ, концепции, сцены, prompt engine, Make It Viral,
             Continue Story, voiceover, social), проверка рекламных рисков, экспорт, демо-проект
server/      Express API: /api/status, /api/ai/:task, /api/ozon/parse
  ai/        AIService (единая точка входа) + провайдеры OpenAI / Gemini + системные промпты
src/         React SPA: проекты (localStorage), 9-шаговый workflow, модальные окна, экспорт
tests/       unit-тесты движка и AIService (vitest)
e2e/         сквозной сценарий всего пути пользователя (playwright-core + системный Chrome)
```

- **AIService** — задачи `analyze`, `angles`, `script`, `viral`, `continue`, `social`. Ответы моделей нормализуются: длительность сцен приводится к выбранной, Product Lock добавляется в промпты, локальная проверка рисков применяется всегда.
- **Product Lock** — каждый промпт с товаром содержит `preserve the exact product design and packaging from the reference image` и описание внешнего вида от продавца.
- **Рекламные ограничения** — рискованные обещания («100%», «гарантированно», «лучший», «вылечит»…) отмечаются при анализе и не попадают в сценарий и тексты.
- **Ozon-ссылка** — разбор работает в режиме best-effort: Ozon обычно блокирует серверные запросы, поэтому всегда доступен ручной ввод (артикул из ссылки сохраняется).
- **Coming soon** — генерация кадров и TTS-озвучка помечены в интерфейсе и неактивны.

## Проверки

```bash
pnpm typecheck && pnpm test
pnpm dev & pnpm e2e        # BASE_URL=... CHROME=/path/to/chrome при необходимости
```
