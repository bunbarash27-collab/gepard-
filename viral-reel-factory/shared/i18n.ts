import type { BeatName, Duration, HookType, Lang, ReelStyle, Verdict } from './types';

export const LANGS: Lang[] = ['ru', 'en'];
export const DEFAULT_LANGUAGE: Lang = 'ru';
export const DEFAULT_PROMPT_LANGUAGE: Lang = 'en';
export const isLang = (v: unknown): v is Lang => v === 'ru' || v === 'en';

/** Russian plural: 1 сцена, 2 сцены, 5 сцен. */
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export const BEAT_LABELS: Record<Lang, Record<BeatName, string>> = {
  ru: { 'COLD OPEN': 'ТИЗЕР', HOOK: 'ХУК', SETUP: 'ЗАВЯЗКА', ESCALATION: 'РАЗВИТИЕ', TURN: 'ПОВОРОТ', PAYOFF: 'РАЗВЯЗКА' },
  en: { 'COLD OPEN': 'COLD OPEN', HOOK: 'HOOK', SETUP: 'SETUP', ESCALATION: 'ESCALATION', TURN: 'TURN', PAYOFF: 'PAYOFF' },
};

export type Stage = 'analyze' | 'hooks' | 'story' | 'scenes' | 'image' | 'video' | 'stronger' | 'prompts' | 'translate';

export interface Dict {
  subtitle: string;
  ideaLabel: string;
  ideaPlaceholder: string;
  create: string;
  openDemo: string;
  duration: string;
  format: string;
  style: string;
  sec(n: Duration | number): string;
  styles: Record<ReelStyle, string>;
  pipeline: { idea: string; hook: string; story: string; scenes: string; prompts: string };
  workflow: string;
  uiLanguage: string;
  demoMode: string;
  realAi: string;
  demoProject: string;
  demoNote: string;
  demoHint: [string, string];
  serverDown: string;
  settingsChanged(duration: number, style: string): string;
  working: Record<Stage, string>;
  selectHint: string;
  analysisTitle: string;
  score: string;
  verdict: string;
  verdicts: Record<Verdict, string>;
  fields: { concept: string; mainCharacter: string; goal: string; conflict: string; surprise: string; emotionalDirection: string; payoff: string };
  strengths: string;
  weaknesses: string;
  improved: string;
  useImproved: string;
  hooksTitle: string;
  hooksHint: string;
  hookTypes: Record<HookType, string>;
  hookLabel: string;
  why: string;
  firstSec: string;
  select: string;
  selected: string;
  storyTitle: string;
  storyLabel: string;
  arc: string;
  pacing: string;
  viewerFeels: string;
  pacingLabel: string;
  total(n: number): string;
  tempo: { fast: string; pause: string; peak: string; steady: string };
  timeline: string;
  reelTitle: string;
  reelConcept: string;
  selectedHook: string;
  scenesTitle: string;
  onScreen: string;
  sceneN(n: string): string;
  time: string;
  timeRange(start: number, end: number): string;
  sceneFields: { purpose: string; visual: string; action: string; camera: string; lighting: string; sound: string; onScreenText: string; voiceover: string };
  scenesMeta(n: number, duration: number, format: string, style: string): string;
  imagePrompt: string;
  videoPrompt: string;
  copyImage: string;
  copyVideo: string;
  copyAll: string;
  copied: string;
  copiedShort: string;
  copyFailed: string;
  promptLanguage: string;
  promptNote: Record<Lang, string>;
  version(v: number): string;
  stronger: string;
  strongerTitle: string;
  checklist: string;
  improvementsCount(n: number): string;
  before: string;
  after: string;
  whyStronger: string;
  keep: string;
  use: string;
  hookText: string;
  applied(n: number): string;
  close: string;
  enterIdea: string;
  createFailed: string;
  otherLanguage: string;
  rebuild: string;
  ruPromptsUnavailable: string;
  /** Plain-text export (COPY ALL). */
  export: { idea: string; format: string; concept: string; hook: string; why: string; story: string; arc: string; pacing: string; scenes: string; voiceover: string };
}

const ruSec = (n: number) => String(n).replace('.', ',');

export const UI: Record<Lang, Dict> = {
  ru: {
    subtitle: 'Преврати идею в сильный короткий ролик',
    ideaLabel: 'Что вы хотите создать?',
    ideaPlaceholder: 'Например: девушка садится в машину, закрывает дверь и оказывается в мире динозавров',
    create: 'СОЗДАТЬ РОЛИК',
    openDemo: 'Открыть демо-проект',
    duration: 'Длительность',
    format: 'Формат',
    style: 'Стиль',
    sec: (n) => `${n} сек`,
    styles: { cinematic: 'Кинематографичный', ugc: 'UGC', commercial: 'Реклама', comedy: 'Комедия', realistic: 'Реализм' },
    pipeline: { idea: 'ИДЕЯ', hook: 'ХУК', story: 'ИСТОРИЯ', scenes: 'СЦЕНЫ', prompts: 'ПРОМПТЫ' },
    workflow: 'Этапы работы',
    uiLanguage: 'Язык интерфейса',
    demoMode: 'ДЕМО-РЕЖИМ',
    realAi: 'REAL AI',
    demoProject: 'ДЕМО-ПРОЕКТ',
    demoNote: 'AI API не подключён. Сейчас используется демонстрационный режим: все результаты создаёт встроенный офлайн-движок.',
    demoHint: ['Чтобы подключить OpenAI или Gemini, укажите ключ в', '.'],
    serverDown: 'Сервер недоступен.',
    settingsChanged: (d, s) => `Настройки изменены — нажмите «СОЗДАТЬ РОЛИК», чтобы пересобрать ролик (${d} сек, ${s}).`,
    working: {
      analyze: 'Анализируем идею…',
      hooks: 'Пишем 5 хуков…',
      story: 'Строим историю…',
      scenes: 'Разбиваем историю на сцены…',
      image: 'Собираем промпты для изображений…',
      video: 'Собираем промпты для видео…',
      stronger: 'Заново анализируем ролик…',
      prompts: 'Готовим промпты на другом языке…',
      translate: 'Пересобираем ролик на другом языке…',
    },
    selectHint: '↑ Выберите хук, чтобы построить историю, сцены и промпты.',
    analysisTitle: 'АНАЛИЗ ИДЕИ',
    score: 'Оценка',
    verdict: 'Вердикт',
    verdicts: { strong: 'Сильная идея', 'needs-work': 'Требует доработки', weak: 'Слабая идея' },
    fields: { concept: 'Концепция', mainCharacter: 'Главный персонаж', goal: 'Цель', conflict: 'Конфликт', surprise: 'Неожиданность', emotionalDirection: 'Эмоциональное направление', payoff: 'Финал / Развязка' },
    strengths: 'Что работает',
    weaknesses: 'Слабые места',
    improved: 'Улучшенная идея',
    useImproved: 'Использовать улучшенную идею',
    hooksTitle: 'ХУКИ',
    hooksHint: 'Выберите начало, на котором строится ролик',
    hookTypes: { curiosity: 'Любопытство', shock: 'Шок', emotional: 'Эмоция', visual: 'Визуальный хук', story: 'История' },
    hookLabel: 'Хук',
    why: 'Почему это работает',
    firstSec: 'Первые 2 сек:',
    select: 'ВЫБРАТЬ',
    selected: '✓ ВЫБРАН',
    storyTitle: 'ИСТОРИЯ',
    storyLabel: 'СЮЖЕТ',
    arc: 'ЭМОЦИОНАЛЬНАЯ ДУГА',
    pacing: 'ТЕМП',
    viewerFeels: 'Зритель чувствует:',
    pacingLabel: 'Темп:',
    total: (n) => `Итого: ${n} сек`,
    tempo: { fast: 'быстро', pause: 'пауза', peak: 'пик', steady: 'ровно' },
    timeline: 'Таймлайн битов',
    reelTitle: 'ВАШ РОЛИК',
    reelConcept: 'КОНЦЕПЦИЯ РОЛИКА',
    selectedHook: 'ВЫБРАННЫЙ ХУК',
    scenesTitle: 'СЦЕНЫ',
    onScreen: 'На экране:',
    sceneN: (n) => `СЦЕНА ${n}`,
    time: 'Время',
    timeRange: (a, b) => `${ruSec(a)}–${ruSec(b)} сек`,
    sceneFields: { purpose: 'Задача сцены', visual: 'Визуал', action: 'Действие', camera: 'Камера', lighting: 'Освещение', sound: 'Звук', onScreenText: 'Текст на экране', voiceover: 'Закадровый голос' },
    scenesMeta: (n, d, f, s) => `${n} ${plural(n, 'сцена', 'сцены', 'сцен')} · ${d} сек · ${f} · ${s}`,
    imagePrompt: 'ПРОМПТ ДЛЯ ИЗОБРАЖЕНИЯ',
    videoPrompt: 'ПРОМПТ ДЛЯ ВИДЕО',
    copyImage: 'КОПИРОВАТЬ ПРОМПТ ИЗОБРАЖЕНИЯ',
    copyVideo: 'КОПИРОВАТЬ ПРОМПТ ВИДЕО',
    copyAll: 'КОПИРОВАТЬ ВСЁ',
    copied: 'Скопировано в буфер обмена',
    copiedShort: '✓ Скопировано',
    copyFailed: 'Не удалось скопировать',
    promptLanguage: 'ЯЗЫК ПРОМПТОВ',
    promptNote: { en: 'Английская версия — оптимизирована для AI-генераторов', ru: 'Русская версия — для генераторов, которые понимают русский язык' },
    version: (v) => `v${v} · усилен`,
    stronger: '🔥 УСИЛИТЬ РОЛИК',
    strongerTitle: '🔥 УСИЛЕНИЕ РОЛИКА',
    checklist: 'Чек-лист улучшений',
    improvementsCount: (n) => `${n} ${plural(n, 'улучшение', 'улучшения', 'улучшений')}`,
    before: 'БЫЛО',
    after: 'СТАЛО',
    whyStronger: 'ПОЧЕМУ СТАЛО СИЛЬНЕЕ',
    keep: 'ОСТАВИТЬ ТЕКУЩУЮ ВЕРСИЮ',
    use: 'ИСПОЛЬЗОВАТЬ УСИЛЕННУЮ ВЕРСИЮ',
    hookText: 'Текст хука:',
    applied: (n) => `Усиленная версия применена — ${n} ${plural(n, 'улучшение', 'улучшения', 'улучшений')}`,
    close: 'Закрыть',
    enterIdea: 'Введите идею',
    createFailed: 'Не удалось создать ролик. Попробуйте ещё раз.',
    otherLanguage: 'Этот ролик создан AI на английском языке. Чтобы получить русский текст, его нужно создать заново.',
    rebuild: 'Пересоздать на русском',
    ruPromptsUnavailable: 'Русские промпты для этого ролика сейчас недоступны — показаны английские.',
    export: { idea: 'Идея', format: 'Формат', concept: 'КОНЦЕПЦИЯ РОЛИКА', hook: 'ВЫБРАННЫЙ ХУК', why: 'Почему это работает', story: 'ИСТОРИЯ', arc: 'Эмоциональная дуга', pacing: 'Темп', scenes: 'СЦЕНЫ', voiceover: 'Текст диктора' },
  },
  en: {
    subtitle: 'Turn an idea into a cinematic short video.',
    ideaLabel: 'What do you want to create?',
    ideaPlaceholder: "A girl gets into her car, shuts the door — and suddenly she's in a world of dinosaurs.",
    create: 'CREATE REEL',
    openDemo: 'Open demo project',
    duration: 'Duration',
    format: 'Format',
    style: 'Style',
    sec: (n) => `${n} sec`,
    styles: { cinematic: 'Cinematic', ugc: 'UGC', commercial: 'Commercial', comedy: 'Comedy', realistic: 'Realistic' },
    pipeline: { idea: 'IDEA', hook: 'HOOK', story: 'STORY', scenes: 'SCENES', prompts: 'PROMPTS' },
    workflow: 'Workflow',
    uiLanguage: 'Interface language',
    demoMode: 'DEMO MODE',
    realAi: 'REAL AI',
    demoProject: 'DEMO PROJECT',
    demoNote: 'No AI API connected. Demo Mode is on: every result comes from the built-in offline engine.',
    demoHint: ['To connect OpenAI or Gemini, add a key to', '.'],
    serverDown: 'Server unreachable.',
    settingsChanged: (d, s) => `Settings changed — press CREATE REEL to rebuild with ${d} sec / ${s}.`,
    working: {
      analyze: 'Analyzing the idea…',
      hooks: 'Writing 5 hooks…',
      story: 'Building the story…',
      scenes: 'Breaking the story into scenes…',
      image: 'Compiling image prompts…',
      video: 'Compiling video prompts…',
      stronger: 'Re-analyzing the reel…',
      prompts: 'Preparing prompts in the other language…',
      translate: 'Rebuilding the reel in the other language…',
    },
    selectHint: '↑ Select a hook to build the story, scenes and prompts.',
    analysisTitle: 'IDEA ANALYSIS',
    score: 'Score',
    verdict: 'Verdict',
    verdicts: { strong: 'Strong idea', 'needs-work': 'Needs work', weak: 'Weak idea' },
    fields: { concept: 'Concept', mainCharacter: 'Main character', goal: 'Goal', conflict: 'Conflict', surprise: 'Surprise', emotionalDirection: 'Emotional direction', payoff: 'Ending / Payoff' },
    strengths: 'What works',
    weaknesses: 'Weak points',
    improved: 'Improved idea',
    useImproved: 'Use improved idea',
    hooksTitle: 'HOOKS',
    hooksHint: 'Pick the opening that builds the reel',
    hookTypes: { curiosity: 'Curiosity', shock: 'Shock', emotional: 'Emotional', visual: 'Visual hook', story: 'Story' },
    hookLabel: 'Hook',
    why: 'Why it works',
    firstSec: 'First 2 sec:',
    select: 'SELECT',
    selected: '✓ SELECTED',
    storyTitle: 'STORY',
    storyLabel: 'STORY',
    arc: 'EMOTIONAL ARC',
    pacing: 'PACING',
    viewerFeels: 'Viewer feels:',
    pacingLabel: 'Pacing:',
    total: (n) => `Total: ${n} sec`,
    tempo: { fast: 'fast', pause: 'pause', peak: 'peak', steady: 'steady' },
    timeline: 'Beat timeline',
    reelTitle: 'YOUR REEL',
    reelConcept: 'REEL CONCEPT',
    selectedHook: 'SELECTED HOOK',
    scenesTitle: 'SCENES',
    onScreen: 'On screen:',
    sceneN: (n) => `SCENE ${n}`,
    time: 'Time',
    timeRange: (a, b) => `${a}–${b} sec`,
    sceneFields: { purpose: 'Purpose', visual: 'Visual', action: 'Action', camera: 'Camera', lighting: 'Lighting', sound: 'Sound', onScreenText: 'On-screen text', voiceover: 'Voiceover' },
    scenesMeta: (n, d, f, s) => `${n} scenes · ${d} sec · ${f} · ${s}`,
    imagePrompt: 'IMAGE PROMPT',
    videoPrompt: 'VIDEO PROMPT',
    copyImage: 'COPY IMAGE PROMPT',
    copyVideo: 'COPY VIDEO PROMPT',
    copyAll: 'COPY ALL',
    copied: 'Copied to clipboard',
    copiedShort: '✓ Copied',
    copyFailed: 'Could not copy',
    promptLanguage: 'PROMPT LANGUAGE',
    promptNote: { en: 'English version — optimized for AI generators', ru: 'Russian version — for generators that understand Russian' },
    version: (v) => `v${v} · stronger`,
    stronger: '🔥 MAKE IT STRONGER',
    strongerTitle: '🔥 MAKE IT STRONGER',
    checklist: 'Strength checklist',
    improvementsCount: (n) => `${n} improvements`,
    before: 'BEFORE',
    after: 'AFTER',
    whyStronger: 'WHY IT IS STRONGER',
    keep: 'KEEP CURRENT VERSION',
    use: 'USE STRONGER VERSION',
    hookText: 'Hook text:',
    applied: (n) => `Stronger version applied — ${n} improvements`,
    close: 'Close',
    enterIdea: 'Enter an idea',
    createFailed: 'Could not create the reel. Please try again.',
    otherLanguage: 'This reel was written by AI in Russian. To get English text it has to be generated again.',
    rebuild: 'Regenerate in English',
    ruPromptsUnavailable: 'Russian prompts are not available for this reel right now — showing English.',
    export: { idea: 'Idea', format: 'Format', concept: 'REEL CONCEPT', hook: 'SELECTED HOOK', why: 'Why it works', story: 'STORY', arc: 'Emotional arc', pacing: 'Pacing', scenes: 'SCENES', voiceover: 'Voiceover' },
  },
};

/** Messages produced on the server (AIService validation and notices). */
export const MESSAGES: Record<Lang, {
  demo: string;
  providerFailed(reason: string): string;
  ideaRequired: string;
  ideaTooLong: string;
  notEnough: string;
  invalidSettings: string;
  hookRequired: string;
  storyRequired: string;
  scenesRequired: string;
  ruUnavailable: string;
}> = {
  ru: {
    demo: 'AI API не подключён. Сейчас используется демонстрационный режим.',
    providerFailed: (r) => `AI-провайдер вернул ошибку (${r}). Показан результат встроенного офлайн-движка.`,
    ideaRequired: 'Введите идею',
    ideaTooLong: 'Идея слишком длинная (максимум 2000 символов)',
    notEnough: 'Недостаточно данных для анализа. Опишите идею хотя бы парой слов.',
    invalidSettings: 'Некорректные настройки ролика',
    hookRequired: 'Сначала выберите хук',
    storyRequired: 'Для этого шага нужна готовая история',
    scenesRequired: 'Для этого шага нужны готовые сцены',
    ruUnavailable: 'Без подключённого AI промпты этого ролика нельзя перевести на русский — показаны английские.',
  },
  en: {
    demo: 'No AI API connected. Demo Mode is on.',
    providerFailed: (r) => `The AI provider failed (${r}). Showing the offline engine result instead.`,
    ideaRequired: 'Enter an idea',
    ideaTooLong: 'The idea is too long (max 2000 characters)',
    notEnough: 'Not enough to analyze. Describe the idea in at least a couple of words.',
    invalidSettings: 'Invalid reel settings',
    hookRequired: 'Select a hook first',
    storyRequired: 'This step needs a finished story',
    scenesRequired: 'This step needs finished scenes',
    ruUnavailable: 'Without a connected AI these prompts cannot be translated to Russian — showing English.',
  },
};
