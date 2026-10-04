/**
 * Deterministic template engine used in Demo Mode (and for the bundled demo project).
 * It produces the same data shapes that real AI providers must return.
 */
import { detectRisks, HEALTH_RE, isRisky } from './compliance';
import { pickProfile, type CategoryProfile } from './profiles';
import type {
  AdAngle,
  AngleType,
  GenContext,
  GeneratorSettings,
  Platform,
  ProductAnalysis,
  ProductInput,
  ProductLock,
  Scene,
  SocialPackage,
  ViralChange,
  ViralResult,
  VisualStyle,
  VoiceSettings,
} from './types';
import { SPEEDS, TONES, PLATFORMS } from './options';
import { cap, formatPrice, lines, lowerFirst, sentence, stripDot, uid, wordCount, totalDuration } from './util';

export const PRODUCT_LOCK_PHRASE = 'preserve the exact product design and packaging from the reference image';

const productText = (p: ProductInput) => `${p.name} ${p.category}`;
const qName = (p: ProductInput) => {
  const n = p.name.trim() || 'Товар';
  return /[«»"]/.test(n) ? n : `«${n}»`;
};

function safeBenefits(p: ProductInput): string[] {
  return lines(p.benefits).filter((b) => !isRisky(b));
}

// ───────────────────────────── Analysis ─────────────────────────────

export function analyzeProduct(p: ProductInput): ProductAnalysis {
  const profile = pickProfile(productText(p));
  const benefits = safeBenefits(p);
  const specs = lines(p.specs).filter((s) => !isRisky(s));
  const risks = [
    ...detectRisks(p.name, 'Название'),
    ...lines(p.benefits).flatMap((b) => detectRisks(b, 'Преимущества')),
    ...lines(p.specs).flatMap((s) => detectRisks(s, 'Характеристики')),
  ];
  const mainBenefit = benefits[0] ?? specs[0] ?? profile.desire;
  const second = benefits[1] ?? specs[0];
  const price = formatPrice(p.price);

  const rules = [
    'Не обещать гарантированный или «100%» результат',
    'Не использовать «лучший», «№1» и другие превосходные степени без подтверждения',
    'Показывать товар таким, какой он есть: без изменения упаковки, цвета и комплектации',
  ];
  if (HEALTH_RE.test(productText(p))) {
    rules.push('Не заявлять лечебный эффект: товар не является лекарственным средством');
    rules.push('Добавить дисклеймер: «Не является лекарственным средством. Перед использованием ознакомьтесь с инструкцией»');
  }
  for (const r of lines(p.restrictions)) rules.push(`Запрет продавца: ${r}`);

  return {
    name: p.name.trim() || 'Без названия',
    category: p.category.trim() || 'Не указана',
    audience: p.audience.trim() || profile.audience,
    pain: profile.pain,
    desire: profile.desire,
    mainBenefit: cap(mainBenefit),
    sellingPoint: second && second !== mainBenefit
      ? `${cap(stripDot(mainBenefit))} + ${lowerFirst(stripDot(second))}`
      : `${cap(stripDot(mainBenefit))} — без лишних сложностей`,
    objections: profile.objections,
    reasonsNow: [
      price ? `Понятная цена: ${price}` : 'Цену и наличие можно проверить в карточке Ozon',
      'Доставка Ozon в пункт выдачи или до двери',
      'Отзывы и рейтинг покупателей видны в карточке до покупки',
    ],
    risks,
    rules,
  };
}

// ───────────────────────────── Angles ─────────────────────────────

export function generateAngles(p: ProductInput, a: ProductAnalysis): AdAngle[] {
  const pr = pickProfile(productText(p));
  const N = qName(p);
  const mk = (type: AngleType, v: Omit<AdAngle, 'id' | 'type' | 'audience'>, audience = a.audience): AdAngle => ({
    id: `angle_${type}`,
    type,
    audience,
    ...v,
  });
  return [
    mk('pain', {
      title: 'Узнаваемая проблема',
      hook: pr.painQuestion,
      idea: `Показываем знакомую ситуацию: ${lowerFirst(stripDot(pr.problemRu))}. Затем — ${N} как простое решение. Финал: ${lowerFirst(stripDot(pr.desire))}.`,
      emotion: 'Узнавание → облегчение',
      whyItWorks: 'Зритель узнаёт себя в первые 2 секунды. Проблема делает предложение личным, а решение снимает напряжение.',
    }),
    mk('result', {
      title: 'Сначала результат',
      hook: `${stripDot(pr.resultLine)}. Показываю, как.`,
      idea: `Открываем ролик финальной картинкой: ${lowerFirst(stripDot(pr.resultRu))}. Потом отматываем назад и показываем путь к ней с ${N}.`,
      emotion: 'Желание → уверенность',
      whyItWorks: 'Результат в первом кадре вызывает вопрос «как?», и зритель досматривает, чтобы узнать ответ.',
    }),
    mk('emotion', {
      title: 'История из жизни',
      hook: 'Иногда мелочь меняет больше, чем кажется',
      idea: `${sentence(pr.emotionRu)} ${N} появляется как маленький, но важный шаг к тому, что дорого героям.`,
      emotion: 'Тепло, сопереживание, надежда',
      whyItWorks: 'Истории запоминаются лучше перечня характеристик и вызывают желание поделиться роликом.',
    }),
    mk('humor', {
      title: 'Абсурдная ситуация',
      hook: 'Когда решаешь проблему как умеешь 😅',
      idea: `${sentence(pr.humorRu)} Резкая пауза — и в кадре ${N}: всё оказывается намного проще.`,
      emotion: 'Смех, узнавание, лёгкость',
      whyItWorks: 'Юмор снижает рекламный барьер. Абсурдное преувеличение реальной проблемы вызывает реакцию «это же я».',
    }, `${a.audience}; особенно аудитория TikTok и Reels 18–35 лет`),
    mk('expert', {
      title: 'Объясняем простым языком',
      hook: 'Почему так происходит? Объясняю коротко',
      idea: `${sentence(pr.expertRu)} Показываем, как устроен ${N} и для кого он подходит.`,
      emotion: 'Доверие, ясность',
      whyItWorks: 'Понятное объяснение без громких обещаний повышает доверие и отвечает на возражения до покупки.',
    }, `${a.audience}; те, кто сравнивает варианты перед покупкой`),
  ];
}

// ───────────────────────────── Prompt engine ─────────────────────────────

interface StylePreset {
  camera: string;
  lens: string;
  aperture: string;
  lighting: string;
  grade: string;
  realism: string;
  visual: string;
  motion: string;
  dof: string;
}

export const STYLE_PRESETS: Record<VisualStyle, StylePreset> = {
  cinematic: {
    camera: 'cinema camera on a gimbal',
    lens: '35mm anamorphic',
    aperture: 'f/1.8',
    lighting: 'motivated low-key lighting, soft key from practical lamps, subtle warm rim light separating subject from background',
    grade: 'teal-and-amber cinematic grade, subtle 35mm film grain',
    realism: 'photorealistic, shot on ARRI Alexa Mini LF',
    visual: 'cinematic commercial',
    motion: 'smooth gimbal moves and slow push-ins',
    dof: 'shallow depth of field, creamy oval bokeh in the background',
  },
  ugc: {
    camera: 'handheld smartphone',
    lens: '26mm smartphone wide',
    aperture: 'f/1.8',
    lighting: 'natural available window light, slightly uneven like a real home video',
    grade: 'true-to-life colors, no heavy grading, light smartphone sharpening',
    realism: 'authentic smartphone footage, shot on iPhone, 4K 30fps',
    visual: 'realistic UGC customer review',
    motion: 'handheld with natural micro-shake, selfie-style framing',
    dof: 'deep depth of field with the subject and product both sharp',
  },
  commercial: {
    camera: 'motion-control slider rig',
    lens: '50mm and 100mm macro',
    aperture: 'f/5.6',
    lighting: 'clean three-point studio light: large softbox key at 45°, white bounce fill, strip-light rim defining product edges',
    grade: 'crisp high-clarity commercial grade with accurate product colors',
    realism: 'photorealistic product photography, shot on Sony FX3',
    visual: 'premium product commercial',
    motion: 'precise slider moves and slow turntable rotation',
    dof: 'medium depth of field, product fully in focus, background softly defocused',
  },
  funny: {
    camera: 'handheld camera with snap zooms',
    lens: '24mm wide',
    aperture: 'f/2.8',
    lighting: 'bright high-key lighting, even and punchy, no harsh shadows',
    grade: 'saturated cheerful colors',
    realism: 'photorealistic sitcom look',
    visual: 'comedic sketch',
    motion: 'snap zooms, whip pans and comedic freeze-frame pauses',
    dof: 'deep depth of field so the gag in the background stays readable',
  },
  luxury: {
    camera: 'dolly with slow-motion capture',
    lens: '85mm',
    aperture: 'f/1.4',
    lighting: 'dramatic chiaroscuro: single hard key light, deep shadows, specular highlights on glossy surfaces',
    grade: 'rich deep blacks with champagne and gold tones',
    realism: 'photorealistic high-end editorial commercial, 120fps slow motion',
    visual: 'luxury editorial',
    motion: 'very slow dolly moves and 120fps slow motion',
    dof: 'very shallow depth of field, razor-thin focus plane on the product',
  },
  expert: {
    camera: 'locked-off tripod camera',
    lens: '35mm',
    aperture: 'f/2.8',
    lighting: 'soft key light from 45°, gentle fill, warm practical lights in the background',
    grade: 'neutral clean grade that feels trustworthy',
    realism: 'photorealistic explainer / talking-head look',
    visual: 'expert explainer with clean space for on-screen graphics',
    motion: 'static framing with occasional slow push-in',
    dof: 'moderate depth of field, background softly blurred',
  },
  viral: {
    camera: 'handheld action camera rig',
    lens: '24mm wide',
    aperture: 'f/2.0',
    lighting: 'punchy contrasty light with colored accent practicals in the background',
    grade: 'vivid high-contrast colors',
    realism: 'photorealistic, crisp 4K 60fps',
    visual: 'fast-paced short-form edit',
    motion: 'fast push-ins, speed ramps and whip-pan transitions',
    dof: 'medium depth of field with fast rack focus',
  },
};

export function buildProductLock(p: ProductInput): ProductLock {
  const hasReference = Boolean(p.imageDataUrl);
  const appearance = p.appearance.trim();
  const attributes = ['shape and proportions', 'colors', 'logo', 'product name and label text', 'packaging', 'key design elements', 'layout of elements', 'distinctive visual details'];
  const described = appearance ? ` Product appearance (from the seller): "${appearance}".` : '';
  const clause = `${PRODUCT_LOCK_PHRASE} — keep the same ${attributes.join(', ')}. Do not redesign, recolor, simplify or invent new packaging; do not add or remove text.${described}`;
  return { hasReference, appearance, attributes, clause };
}

interface Shot {
  shot: string;
  subject: string;
  composition: string;
  productVisible: boolean;
  placement: string;
  cameraMove: string;
  subjectMove: string;
  objectMove: string;
  interaction: string;
  transition: string;
  ending: string;
}

interface Beat {
  goal: string;
  action: string;
  onScreen: string;
  voiceover: string;
  sound: string;
  shot: Shot;
}

interface PromptCtx {
  product: ProductInput;
  profile: CategoryProfile;
  style: StylePreset;
  lock: ProductLock;
}

function promptCtx(product: ProductInput, settings: GeneratorSettings): PromptCtx {
  return {
    product,
    profile: pickProfile(productText(product)),
    style: STYLE_PRESETS[settings.style],
    lock: buildProductLock(product),
  };
}

const productRef = (c: PromptCtx) => `the product "${c.product.name.trim() || 'product'}" (exact item from the reference photo)`;

export function buildImagePrompt(c: PromptCtx, s: Shot): string {
  const { style, profile } = c;
  return [
    `Vertical 9:16 photorealistic frame, ${s.shot}.`,
    `Subject: ${s.subject}.`,
    `Characters (keep identical in every scene): ${profile.character}.`,
    s.productVisible ? `Product placement: ${productRef(c)}, ${s.placement}.` : 'Product: not shown in this frame.',
    `Environment: ${profile.env}, ${profile.timeOfDay}.`,
    `Composition: ${s.composition}; keep the top 15% and bottom 20% of the frame free of key details for captions and platform UI.`,
    `Camera: ${style.camera}, ${style.lens} lens, ${style.aperture}, eye-level unless stated otherwise.`,
    `Lighting: ${style.lighting}.`,
    `Materials and textures: ${profile.materials}.`,
    `Colors: ${profile.palette}; ${style.grade}.`,
    `Depth of field: ${style.dof}.`,
    `Realism: ${style.realism}; natural skin texture, anatomically correct hands.`,
    `Visual style: ${style.visual}.`,
    s.productVisible ? `Product lock: ${c.lock.clause}` : '',
    'Avoid: extra logos, invented text, distorted packaging, watermarks, extra fingers.',
  ].filter(Boolean).join('\n');
}

export function buildVideoPrompt(c: PromptCtx, s: Shot, duration: number, startFrame?: string): string {
  const { style, profile } = c;
  const t1 = Math.max(0.5, Math.round(duration * 0.3 * 10) / 10);
  const t2 = Math.max(t1 + 0.5, Math.round(duration * 0.8 * 10) / 10);
  return [
    `${duration}-second vertical 9:16 video, ${style.realism}, ${s.shot}.`,
    startFrame
      ? `Starting frame: continues seamlessly from the previous shot's ending frame — ${startFrame}.`
      : `Starting frame: ${s.subject}, in ${profile.env}, ${profile.timeOfDay}.`,
    `Characters (identical across scenes): ${profile.character}.`,
    `Camera movement: ${s.cameraMove}; ${style.motion}.`,
    `Subject movement: ${s.subjectMove}.`,
    `Object movement: ${s.objectMove}.`,
    `Physical interaction: ${s.interaction}; realistic weight, contact shadows and natural motion blur.`,
    `Timing: 0–${t1}s establish the action; ${t1}–${t2}s ${s.interaction}; ${t2}–${duration}s settle on the ending frame.`,
    `Lighting and color: ${style.lighting}; ${style.grade}.`,
    `Transition: ${s.transition}.`,
    `Ending frame: ${s.ending}.`,
    s.productVisible ? `Product lock: ${c.lock.clause}` : 'Product is not visible in this shot.',
  ].join('\n');
}

// ───────────────────────────── Beats ─────────────────────────────

type BeatId = 'HOOK' | 'PROBLEM' | 'STORY' | 'EXPLAIN' | 'TWIST' | 'REVEAL' | 'DEMO' | 'DETAIL' | 'RESULT' | 'PUNCHLINE' | 'OBJECTION' | 'OFFER' | 'CTA';

/** Scene order per angle with keep-priority (1 = always kept when the video is short). */
const SEQUENCES: Record<AngleType, [BeatId, number][]> = {
  pain: [['HOOK', 1], ['PROBLEM', 4], ['REVEAL', 2], ['DEMO', 3], ['DETAIL', 7], ['RESULT', 5], ['OBJECTION', 8], ['OFFER', 6], ['CTA', 1]],
  result: [['HOOK', 1], ['PROBLEM', 5], ['REVEAL', 2], ['DEMO', 3], ['DETAIL', 6], ['RESULT', 4], ['OBJECTION', 8], ['OFFER', 7], ['CTA', 1]],
  emotion: [['HOOK', 1], ['STORY', 4], ['PROBLEM', 7], ['REVEAL', 2], ['DEMO', 5], ['RESULT', 3], ['DETAIL', 8], ['OFFER', 6], ['CTA', 1]],
  humor: [['HOOK', 1], ['PROBLEM', 5], ['TWIST', 2], ['REVEAL', 4], ['DEMO', 3], ['PUNCHLINE', 6], ['DETAIL', 8], ['OFFER', 7], ['CTA', 1]],
  expert: [['HOOK', 1], ['EXPLAIN', 2], ['REVEAL', 3], ['DEMO', 4], ['DETAIL', 5], ['OBJECTION', 6], ['RESULT', 7], ['OFFER', 8], ['CTA', 1]],
};

export const SCENE_COUNT: Record<number, number> = { 10: 3, 15: 4, 20: 5, 30: 6, 45: 7, 60: 8 };

const LINK_HINT: Record<Platform, string> = {
  reels: 'ссылка в шапке профиля',
  tiktok: 'ссылка в профиле',
  shorts: 'ссылка в описании',
  vk: 'ссылка под видео',
};

function buildBeat(id: BeatId, ctx: GenContext): Beat {
  const { product: p, analysis: a, angle, settings } = ctx;
  const pr = pickProfile(productText(p));
  const N = qName(p);
  const benefits = safeBenefits(p);
  const specs = lines(p.specs).filter((s) => !isRisky(s));
  const b1 = stripDot(benefits[0] ?? a.mainBenefit);
  const b2 = stripDot(benefits[1] ?? specs[0] ?? b1);
  const price = formatPrice(p.price);
  const hero = 'the product held in a hand at chest height, label facing the camera, occupying about 35% of the frame';

  switch (id) {
    case 'HOOK': {
      const byAngle: Record<AngleType, Pick<Beat, 'action' | 'onScreen' | 'voiceover'> & { subject: string; productVisible: boolean }> = {
        pain: { action: pr.problemRu, onScreen: pr.painQuestion, voiceover: pr.painQuestion, subject: pr.problemEn, productVisible: false },
        result: { action: `${pr.resultRu}. Товар стоит на переднем плане`, onScreen: angle.hook, voiceover: angle.hook, subject: pr.resultEn, productVisible: true },
        emotion: { action: pr.emotionRu, onScreen: angle.hook, voiceover: `${sentence(angle.hook)}`, subject: pr.emotionEn, productVisible: false },
        humor: { action: pr.humorRu, onScreen: angle.hook, voiceover: 'Мы все через это проходили…', subject: pr.humorEn, productVisible: false },
        expert: { action: `Автор смотрит в камеру и держит ${N} в руке`, onScreen: angle.hook, voiceover: `${pr.painQuestion} Объясню простыми словами.`, subject: 'the main character looks straight into the camera, holding the product at chest height', productVisible: true },
      };
      const h = byAngle[angle.type];
      return {
        goal: 'HOOK',
        action: h.action,
        onScreen: h.onScreen,
        voiceover: h.voiceover,
        sound: 'Первые 0,5 сек — реальный звук ситуации без музыки, затем вступает ритм',
        shot: {
          shot: 'medium close-up',
          subject: h.subject,
          composition: 'character on the central vertical axis, face in the upper third',
          productVisible: h.productVisible,
          placement: 'in the foreground on the left third, sharp, label facing the camera',
          cameraMove: 'quick push-in from medium shot to close-up during the first second',
          subjectMove: 'a clear readable reaction in the first second: eyes, eyebrows and shoulders move',
          objectMove: 'subtle motion in the background (fabric, steam or light flicker) keeps the frame alive',
          interaction: h.subject,
          transition: 'hard cut on the peak of the reaction',
          ending: 'close-up of the character at the peak of the emotion',
        },
      };
    }
    case 'PROBLEM':
      return {
        goal: angle.type === 'result' ? 'BEFORE' : 'PROBLEM',
        action: angle.type === 'result' ? `Флешбэк «до». ${pr.problemRu}` : `Серия крупных планов, усиливающих проблему. ${pr.problemRu}`,
        onScreen: angle.type === 'result' ? 'А было так…' : stripDot(pr.pain),
        voiceover: angle.type === 'result' ? `А раньше было так. ${sentence(pr.pain)}` : sentence(pr.pain),
        sound: 'Нарастающий раздражающий звук ситуации, музыка приглушена',
        shot: {
          shot: 'sequence of extreme close-ups',
          subject: pr.problemEn,
          composition: 'tight detail framing, slightly off-center, negative space on the side of the frame',
          productVisible: false,
          placement: '',
          cameraMove: 'slow handheld drift with a small rack focus between details',
          subjectMove: 'tired, frustrated micro-gestures: rubbing eyes, sighing, turning away',
          objectMove: 'background elements reinforce the problem (clock hands, light flicker)',
          interaction: pr.problemEn,
          transition: angle.type === 'result' ? 'quick rewind effect back to the present' : 'match cut on the hand movement into the next scene',
          ending: 'the character turns towards the side of the frame where the product will appear',
        },
      };
    case 'STORY':
      return {
        goal: 'STORY',
        action: pr.emotionRu,
        onScreen: stripDot(pr.pain),
        voiceover: `${sentence(pr.pain)} И к этому почему-то привыкаешь.`,
        sound: 'Тихое фортепиано, атмосферный звук комнаты',
        shot: {
          shot: 'medium wide shot',
          subject: pr.emotionEn,
          composition: 'character placed on the right third, lots of space around to emphasise loneliness',
          productVisible: false,
          placement: '',
          cameraMove: 'very slow lateral dolly from left to right',
          subjectMove: 'slow, thoughtful movement, a long look',
          objectMove: 'soft curtain movement, dust in the light beam',
          interaction: pr.emotionEn,
          transition: 'slow cross-dissolve of 8 frames',
          ending: 'the character takes a breath and looks towards the camera',
        },
      };
    case 'EXPLAIN':
      return {
        goal: 'EXPLAIN',
        action: 'Автор объясняет, рядом простая анимированная схема из 2–3 пунктов',
        onScreen: 'Коротко о главном',
        voiceover: sentence(pr.expertRu),
        sound: 'Нейтральная фоновая музыка, мягкие «клики» на появлении пунктов',
        shot: {
          shot: 'medium shot',
          subject: 'the main character explains calmly to the camera, gesturing with an open hand',
          composition: 'character on the left third, clean space on the right two-thirds for graphics',
          productVisible: false,
          placement: '',
          cameraMove: 'static, then a gentle push-in on the key sentence',
          subjectMove: 'natural explanatory gestures, nods',
          objectMove: 'none; background stays calm',
          interaction: 'the character counts points on their fingers',
          transition: 'cut on the gesture towards the product',
          ending: 'the character points at the empty space on the right where the product will appear',
        },
      };
    case 'TWIST':
      return {
        goal: 'TWIST',
        action: `Стоп-кадр. Персонаж замечает ${N} и замирает`,
        onScreen: 'Стоп. Есть же нормальный способ',
        voiceover: 'Стоп. А можно было просто…',
        sound: 'Скретч пластинки, тишина на 0,3 сек',
        shot: {
          shot: 'freeze frame then snap zoom to close-up',
          subject: 'the main character freezes mid-gesture and slowly turns their head to the product',
          composition: 'character on the left, product on the right, eyeline connecting them',
          productVisible: true,
          placement: 'on the right third, sharp, catching a highlight',
          cameraMove: 'freeze for 6 frames, then a fast snap zoom onto the product',
          subjectMove: 'eyebrows rise, mouth opens in realisation',
          objectMove: 'the product catches a glint of light',
          interaction: 'the character reaches for the product',
          transition: 'whip pan following the hand',
          ending: 'close-up of the hand gripping the product',
        },
      };
    case 'REVEAL':
      return {
        goal: 'PRODUCT REVEAL',
        action: `В кадре появляется ${N}: крупный план упаковки`,
        onScreen: p.name.trim() || 'Новинка на Ozon',
        voiceover: `Знакомьтесь — ${N}. ${sentence(b1)}`,
        sound: 'Звуковой акцент (whoosh) на появлении товара, музыка становится светлее',
        shot: {
          shot: 'hero close-up of the product',
          subject: `a hand places the product on a surface in the scene`,
          composition: 'product dead center, occupying about 40% of the frame, horizon level',
          productVisible: true,
          placement: 'centered on the surface, front of the packaging facing the camera',
          cameraMove: 'slow 15° orbit around the product with a slight push-in',
          subjectMove: 'the hand releases the product and exits the frame',
          objectMove: 'the product settles with a tiny natural bounce; light glides across its surface',
          interaction: 'the hand sets the product down gently with visible contact shadow',
          transition: 'match cut on the product into the next scene',
          ending: 'the product alone in the frame, label perfectly readable',
        },
      };
    case 'DEMO':
      return {
        goal: 'DEMO',
        action: pr.usageRu,
        onScreen: cap(b1),
        voiceover: b2 && b2 !== b1 ? `${sentence(b1)} ${sentence(b2)}` : sentence(b1),
        sound: 'Реальные звуки использования товара (ASMR-слой) поверх ритма',
        shot: {
          shot: 'over-the-shoulder medium close-up',
          subject: pr.usageEn,
          composition: 'hands and product in the center, face partially visible at the top edge',
          productVisible: true,
          placement: hero,
          cameraMove: 'slow push-in towards the hands',
          subjectMove: 'confident unhurried hand movements',
          objectMove: 'the product moves naturally in the hands without changing shape',
          interaction: pr.usageEn,
          transition: 'cut on action',
          ending: 'the product in use, held steady for a beat',
        },
      };
    case 'DETAIL':
      return {
        goal: 'DETAIL',
        action: 'Макро: материалы и детали товара',
        onScreen: cap(b2),
        voiceover: sentence(specs[0] ?? b2),
        sound: 'Тихие тактильные звуки (щелчок, шорох материала)',
        shot: {
          shot: 'macro close-up',
          subject: 'macro details of the product surface, edges and materials',
          composition: 'product detail filling 70% of the frame, diagonal composition',
          productVisible: true,
          placement: 'filling most of the frame in macro, logo partly visible',
          cameraMove: 'slow slider move left to right with rack focus across the details',
          subjectMove: 'a fingertip gently touches the surface',
          objectMove: 'light slowly travels across the texture',
          interaction: 'the fingertip presses lightly, the material reacts realistically',
          transition: 'focus pull to blur, then cut',
          ending: 'sharp macro of the logo area of the product',
        },
      };
    case 'RESULT':
      return {
        goal: 'RESULT',
        action: pr.resultRu,
        onScreen: pr.resultLine,
        voiceover: `${sentence(a.desire)} Ради этого всё и затевалось.`,
        sound: 'Музыка раскрывается, облегчённый выдох',
        shot: {
          shot: 'medium wide shot',
          subject: pr.resultEn,
          composition: 'balanced symmetrical composition, the product visible on the side',
          productVisible: true,
          placement: 'visible but secondary on the right side of the frame, in focus',
          cameraMove: 'slow pull-back revealing the calm scene',
          subjectMove: 'relaxed body language, a genuine smile',
          objectMove: 'soft light change, gentle background motion',
          interaction: pr.resultEn,
          transition: 'soft cut to the product',
          ending: 'the calm scene with the product visible on the side',
        },
      };
    case 'PUNCHLINE':
      return {
        goal: 'PUNCHLINE',
        action: `${pr.resultRu}. Персонаж с довольным видом убирает «костыли» из первой сцены`,
        onScreen: 'Без драмы. Без героизма.',
        voiceover: 'Без драмы. Без героизма. Просто удобно.',
        sound: 'Комичный звуковой акцент и короткий смешок',
        shot: {
          shot: 'medium shot',
          subject: `${pr.resultEn}, the props from the opening gag are tossed aside`,
          composition: 'character centered, discarded props in the foreground',
          productVisible: true,
          placement: 'in the character\'s hand or right next to them',
          cameraMove: 'snap zoom out',
          subjectMove: 'smug satisfied look straight into the camera',
          objectMove: 'the discarded props fall out of frame',
          interaction: 'the character tosses the old props away and keeps the product',
          transition: 'hard cut',
          ending: 'the character winks at the camera with the product',
        },
      };
    case 'OBJECTION': {
      const obj = stripDot(a.objections[0] ?? 'А вдруг не подойдёт');
      return {
        goal: 'OBJECTION',
        action: 'Персонаж отвечает на частое сомнение, показывая товар',
        onScreen: `«${obj}»?`,
        voiceover: `Думаете: «${obj}»? Загляните в характеристики и отзывы в карточке — там всё по-честному.`,
        sound: 'Короткая пауза в музыке на вопросе',
        shot: {
          shot: 'medium close-up',
          subject: 'the main character raises an eyebrow, then shows the product to the camera',
          composition: 'character slightly right of center, product on the left third',
          productVisible: true,
          placement: hero,
          cameraMove: 'static, with a small push-in on the answer',
          subjectMove: 'skeptical look turning into a reassuring nod',
          objectMove: 'the product turns 30° to show its side',
          interaction: 'the character rotates the product in hand to show it from several sides',
          transition: 'cut on the nod',
          ending: 'the character holds the product steady facing the camera',
        },
      };
    }
    case 'OFFER':
      return {
        goal: 'OFFER',
        action: `${N} на однотонном фоне, рядом плашка с ценой`,
        onScreen: price ? `${price} — на Ozon` : 'Уже на Ozon',
        voiceover: `${N} уже на Ozon${price ? ` — ${price}` : ''}.`,
        sound: 'Яркий звуковой акцент на появлении цены',
        shot: {
          shot: 'clean packshot',
          subject: 'the product alone on a seamless backdrop',
          composition: 'product centered in the lower half, empty upper half reserved for the price badge',
          productVisible: true,
          placement: 'center of the lower half, front facing, perfectly lit',
          cameraMove: 'slow 20° turntable rotation',
          subjectMove: 'none',
          objectMove: 'the product rotates slowly on a turntable',
          interaction: 'soft light sweep across the packaging',
          transition: 'quick zoom-through into the final frame',
          ending: 'front-facing packshot with clean space above it',
        },
      };
    case 'CTA': {
      const link = LINK_HINT[settings.platform];
      return {
        goal: 'CTA',
        action: `Финальный кадр: ${N} крупно, плашка «${settings.cta}»`,
        onScreen: `${settings.cta} → ${link}`,
        voiceover: `${sentence(settings.cta)} ${cap(link)}.`,
        sound: 'Финальный аккорд, короткий звуковой логотип',
        shot: {
          shot: 'hero packshot',
          subject: 'the product held in a hand towards the camera, with the main character smiling softly out of focus',
          composition: 'product in the center, CTA space in the lower third above the platform UI',
          productVisible: true,
          placement: 'centered, front of the packaging facing the camera, occupying about 45% of the frame',
          cameraMove: 'slow push-in ending in a stable hold',
          subjectMove: 'the character gives a small nod',
          objectMove: 'the product stays still and sharp',
          interaction: 'the hand presents the product to the camera',
          transition: 'hold the last frame for 0.5s (loop-friendly)',
          ending: 'stable hero frame of the product with space for the CTA badge',
        },
      };
    }
  }
}

function beatToScene(beat: Beat, ctx: GenContext, duration: number, startFrame?: string): Scene {
  const c = promptCtx(ctx.product, ctx.settings);
  return {
    id: uid('scene'),
    goal: beat.goal,
    duration,
    action: cap(stripDot(beat.action)),
    onScreenText: beat.onScreen,
    voiceover: beat.voiceover,
    camera: `${cap(beat.shot.shot)} · ${c.style.lens} · ${c.style.aperture} · ${beat.shot.cameraMove}`,
    lighting: `${cap(c.style.lighting)} (${c.profile.timeOfDay})`,
    sound: beat.sound,
    imagePrompt: buildImagePrompt(c, beat.shot),
    videoPrompt: buildVideoPrompt(c, beat.shot, duration, startFrame),
    endingFrame: beat.shot.ending,
  };
}

function distribute(total: number, n: number): number[] {
  if (n === 1) return [total];
  const hook = 3;
  const cta = total >= 45 ? 4 : 3;
  if (n === 2) return [hook, total - hook];
  const mid = total - hook - cta;
  const base = Math.floor(mid / (n - 2));
  const rest = mid - base * (n - 2);
  return [hook, ...Array.from({ length: n - 2 }, (_, i) => base + (i < rest ? 1 : 0)), cta];
}

export function generateScript(ctx: GenContext): Scene[] {
  const seq = SEQUENCES[ctx.angle.type];
  const n = SCENE_COUNT[ctx.settings.duration] ?? 5;
  const keepMax = [...seq].map(([, p]) => p).sort((x, y) => x - y)[n - 1];
  let chosen = seq.filter(([, p]) => p <= keepMax);
  // Equal priorities can overshoot the target count; drop the lowest-priority extras from the end.
  while (chosen.length > n) {
    const worst = chosen.reduce((w, cur, i) => (cur[1] >= chosen[w][1] ? i : w), 0);
    chosen = chosen.filter((_, i) => i !== worst);
  }
  const durations = distribute(ctx.settings.duration, chosen.length);
  return chosen.map(([id], i) => beatToScene(buildBeat(id, ctx), ctx, durations[i]));
}

/** Rebuilds prompts for every scene after a Product Lock or style change, keeping user text edits. */
export function refreshLockInPrompt(prompt: string, lock: ProductLock): string {
  const re = /Product lock: .*$/m;
  if (re.test(prompt)) return prompt.replace(re, `Product lock: ${lock.clause}`);
  return prompt;
}

export function createBlankScene(ctx: GenContext): Scene {
  const scene = beatToScene(buildBeat('DEMO', ctx), ctx, 3);
  return { ...scene, goal: 'NEW SCENE' };
}

// ───────────────────────────── Continue story ─────────────────────────────

export function continueStory(ctx: GenContext, scenes: Scene[]): Scene {
  const last = scenes[scenes.length - 1];
  const used = new Set(scenes.map((s) => s.goal));
  const seq = SEQUENCES[ctx.angle.type].map(([id]) => id).filter((id) => id !== 'HOOK' && id !== 'CTA');
  const next = seq.find((id) => !used.has(id) && !used.has(id === 'REVEAL' ? 'PRODUCT REVEAL' : id)) ?? 'DETAIL';
  const beat = buildBeat(next, ctx);
  const c = promptCtx(ctx.product, ctx.settings);
  const continuity = last
    ? `Continuity with scene ${String(scenes.length).padStart(2, '0')}: same characters and wardrobe (${c.profile.character}), same location (${c.profile.env}), same time of day (${c.profile.timeOfDay}), same ${c.style.lens} lens, lighting and color grade; keep screen direction and eyeline so the cut feels natural.`
    : '';
  const scene = beatToScene(beat, ctx, 3, last?.endingFrame);
  return {
    ...scene,
    goal: `CONTINUE · ${beat.goal}`,
    action: last ? `Продолжение: начинается с последнего кадра сцены ${String(scenes.length).padStart(2, '0')}. ${scene.action}` : scene.action,
    imagePrompt: continuity ? `${scene.imagePrompt}\n${continuity}` : scene.imagePrompt,
    videoPrompt: continuity ? `${scene.videoPrompt}\n${continuity}` : scene.videoPrompt,
  };
}

// ───────────────────────────── Make it viral ─────────────────────────────

const VIRAL_HOOKS: Record<AngleType, string> = {
  pain: 'Если это про вас — досмотрите 👇',
  result: 'Вот как это выглядит в жизни 👀',
  emotion: 'Мы почти смирились. А потом…',
  humor: 'Я правда думал(а), что это норма 😅',
  expert: 'Об этом редко говорят — объясняю',
};

export function makeViral(ctx: GenContext, scenes: Scene[]): ViralResult {
  if (!scenes.length) return { scenes, changes: [] };
  const out = scenes.map((s) => ({ ...s }));
  const changes: ViralChange[] = [];
  const hook = out[0];

  const newHook = VIRAL_HOOKS[ctx.angle.type];
  changes.push({ area: 'Hook', before: hook.onScreenText, after: newHook });
  const oldVo = hook.voiceover;
  hook.onScreenText = newHook;
  hook.voiceover = sentence(newHook.replace(/[👇👀😅]/gu, '').trim());
  changes.push({ area: 'Voiceover хука', before: oldVo, after: hook.voiceover });

  if (hook.duration > 2 && out.length > 1) {
    const shortest = out.slice(1, -1).reduce((m, s) => (s.duration < m.duration ? s : m), out[1]);
    changes.push({ area: 'Первые 1–3 секунды', before: `Хук ${hook.duration} сек, вступление с плавным движением камеры`, after: `Хук 2 сек: холодный старт с движением в первом кадре, текст появляется на 0,2 сек; освободившееся время отдано сцене «${shortest.goal}»` });
    shortest.duration += hook.duration - 2;
    hook.duration = 2;
  } else {
    changes.push({ area: 'Первые 1–3 секунды', before: 'Вступление с плавным движением камеры', after: 'Холодный старт: движение с первого кадра, текст появляется на 0,2 сек' });
  }
  hook.videoPrompt = `Cold open: the action is already in progress on frame 1 — no static intro; a 0.3s snap zoom lands on the subject; on-screen text appears at 0.2s.\n${hook.videoPrompt}`;

  const pr = pickProfile(productText(ctx.product));
  const conflict = 'Visual conflict: split composition — the left half shows the problem in cold blue light, the right half hints at the calm result in warm amber light; a hard vertical edge between them.';
  hook.imagePrompt = `${hook.imagePrompt}\n${conflict}`;
  changes.push({ area: 'Визуальный конфликт', before: 'Одна ситуация в кадре', after: `Контраст «проблема ↔ результат» в одном кадре: холодный свет против тёплого (${stripDot(pr.problemRu).toLowerCase()} / ${stripDot(pr.resultRu).toLowerCase()})` });

  if (out.length > 2) {
    const s2 = out[1];
    const before = s2.onScreenText;
    s2.onScreenText = `${stripDot(before)} — но есть нюанс 👀`;
    changes.push({ area: 'Curiosity gap', before, after: s2.onScreenText });
  }

  const avg = Math.round((totalDuration(out) / out.length) * 10) / 10;
  for (const s of out.slice(1, -1)) {
    s.videoPrompt += '\nPacing: cut on action every 1.5–2s inside the shot; speed ramp 100% → 40% → 100% on the key interaction.';
    s.camera += ' · speed ramp';
  }
  changes.push({ area: 'Pacing', before: `Средняя длина сцены ${avg} сек, плавные склейки`, after: 'Склейки на действии каждые 1,5–2 сек внутри сцен, speed ramp на ключевом моменте' });

  const soundBefore = out.map((s) => s.sound).join(' → ');
  out.forEach((s, i) => {
    if (i === 0) s.sound = 'Тишина 0,3 сек → резкий звуковой акцент на хуке';
    else if (i === out.length - 1) s.sound = 'Короткий звуковой логотип и щелчок на CTA';
    else if (/RESULT|PUNCHLINE/.test(s.goal)) s.sound = 'Drop бита и облегчённый выдох — эмоциональная кульминация';
    else s.sound = `Нарастающий бит (уровень ${i}/${out.length - 2}) + реальные звуки действия`;
  });
  changes.push({ area: 'Эмоциональная динамика', before: soundBefore, after: 'Тишина → нарастание → кульминация (drop) → чёткий финал' });

  const cta = out[out.length - 1];
  if (out.length > 1) {
    const link = LINK_HINT[ctx.settings.platform];
    const before = cta.onScreenText;
    cta.onScreenText = `${ctx.settings.cta} 👉 ${link}. Сохраните, чтобы не потерять`;
    cta.voiceover = `${sentence(ctx.settings.cta)} ${cap(link)}. Сохраните видео, чтобы не потерять.`;
    changes.push({ area: 'CTA', before, after: cta.onScreenText });
  }
  return { scenes: out, changes };
}

// ───────────────────────────── Voiceover ─────────────────────────────

export function buildVoiceover(scenes: Scene[], voice: VoiceSettings) {
  const text = scenes.map((s) => s.voiceover.trim()).filter(Boolean).join('\n');
  const words = wordCount(text);
  const speed = SPEEDS.find((s) => s.id === voice.speed)!;
  const tone = TONES.find((t) => t.id === voice.tone)!;
  const est = Math.round((words / speed.wps) * 10) / 10;
  const total = totalDuration(scenes);
  const direction = `Голос: ${voice.voice === 'female' ? 'женский' : 'мужской'}, тон ${tone.label} — ${tone.direction}. Темп ${speed.label} (${speed.rate}).`;
  return { text, words, estSeconds: est, totalSeconds: total, fits: est <= total, direction };
}

// ───────────────────────────── Social package ─────────────────────────────

export function generateSocial(ctx: GenContext): SocialPackage {
  const { product: p, analysis: a, angle, settings } = ctx;
  const pr = pickProfile(productText(p));
  const N = qName(p);
  const benefits = safeBenefits(p).slice(0, 3);
  const price = formatPrice(p.price);
  const link = LINK_HINT[settings.platform];
  const hook = angle.hook;
  const cta = `${settings.cta} — ${link}`;
  const bullets = (benefits.length ? benefits : [a.mainBenefit]).map((b) => `✔️ ${cap(stripDot(b))}`).join('\n');

  const platformTag: Record<Platform, string[]> = {
    reels: ['#reels', '#reelsrussia'],
    tiktok: ['#tiktok', '#рекомендации'],
    shorts: ['#shorts', '#youtubeshorts'],
    vk: ['#вкклипы', '#клипы'],
  };
  let nameTag = '#';
  for (const w of p.name.toLowerCase().replace(/[^a-zа-яё0-9\s]+/gi, ' ').split(/\s+/).filter(Boolean)) {
    if ((nameTag + w).length > 25) break;
    nameTag += w;
  }
  if (nameTag === '#') nameTag = '#товар';
  const hashtags = Array.from(new Set([
    '#ozon', '#озон', '#находкиozon', '#товарыozon', nameTag,
    ...pr.hashtags, ...platformTag[settings.platform], '#обзор', '#покупки', '#полезныепокупки',
  ])).slice(0, 15);

  const cat = a.category.toLowerCase();
  const keywords = Array.from(new Set([
    p.name.trim().toLowerCase(),
    `${p.name.trim().toLowerCase()} купить`,
    `${p.name.trim().toLowerCase()} ozon`,
    `${cat} ozon`,
    `${cat} отзывы`,
    `${cat} недорого`,
    `${p.name.trim().toLowerCase()} отзывы`,
  ])).filter((k) => k.length > 2);

  const disclaimer = HEALTH_RE.test(productText(p)) ? '\n\nНе является лекарственным средством. Перед использованием ознакомьтесь с инструкцией.' : '';
  const caption = `${hook}\n\n${sentence(a.pain)} Мы нашли простое решение — ${N}.\n\n${bullets}\n\n${price ? `Цена на Ozon: ${price}. ` : ''}${cta} 👆${disclaimer}`;

  return {
    caption,
    hook,
    cta,
    hashtags,
    keywords,
    variations: [
      { id: 'A', label: 'Aggressive sales', caption: `🔥 ${hook.toUpperCase()}\n\n${N} — ${lowerFirst(stripDot(a.sellingPoint))}.\n${bullets}\n\n${price ? `Всего ${price} на Ozon. ` : ''}Не откладывайте: ${cta.toLowerCase()} 👆${disclaimer}` },
      { id: 'B', label: 'Natural UGC', caption: `Честно, долго сомневалась, брать ли ${N}. ${sentence(a.pain)}\nВ итоге заказала на Ozon — делюсь впечатлениями в видео. Главное для меня: ${lowerFirst(stripDot(a.mainBenefit))}.\nГде купить? ${cap(link)} 🙌${disclaimer}` },
      { id: 'C', label: 'Soft recommendation', caption: `Если вам знакомо «${lowerFirst(stripDot(a.pain))}», посмотрите на ${N}. ${sentence(a.mainBenefit)}\nСохраните, чтобы не потерять, а подробности — ${link}.${disclaimer}` },
    ],
  };
}

export const PLATFORM_LABEL = Object.fromEntries(PLATFORMS.map((p) => [p.id, p.label])) as Record<Platform, string>;
