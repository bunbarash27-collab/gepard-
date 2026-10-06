import { STYLE_PRESETS } from './lexicon';
import { STYLES_RU } from './lexicon.ru';
import type { ContinuityState, Lang, PromptLayer, ReelSettings, Scene } from './types';
import { capitalize, fmtSec, stripVague } from './util';

const clean = (s: string) => stripVague(s).replace(/\s*\.+$/, '');

const LABELS = {
  en: {
    frame: (f: string) => `Vertical ${f} frame.`,
    character: 'Character', clothing: 'Clothing', environment: 'Environment', details: 'visible details', composition: 'Composition', angle: 'Camera angle', lens: 'Lens',
    lighting: 'Lighting', dof: 'Depth of field', materials: 'Materials', textures: 'Textures', atmosphere: 'Atmosphere', palette: 'Color palette', style: 'Visual style',
    noText: 'No text, captions, logos or watermarks in the frame.',
    video: (f: string, d: string, subject: string) => `Vertical ${f} video, ${d} seconds. Start from the reference image of this scene: ${subject} — keep the same character, wardrobe, location, lighting and color palette.`,
    subjectMove: 'Subject movement', face: 'Facial movement', cameraMove: 'Camera movement', objectMove: 'Object movement', envMove: 'Environment movement', physical: 'Physical interaction',
    timing: 'Timing', transition: 'Transition', into: (s: string) => ` into the next shot (${s})`, ending: 'Ending frame',
    continuity: (c: ContinuityState) => `Continuity: ${clean(c.character)}; wearing ${clean(c.wardrobe)}. Camera style: ${clean(c.cameraStyle)}. Visual style: ${clean(c.visualStyle)}.`,
    physics: 'Realistic physics and natural motion blur; no morphing faces, no extra limbs, no on-screen text.',
  },
  ru: {
    frame: (f: string) => `Вертикальный кадр ${f}.`,
    character: 'Персонаж', clothing: 'Одежда', environment: 'Окружение', details: 'видимые детали', composition: 'Композиция', angle: 'Ракурс', lens: 'Объектив',
    lighting: 'Освещение', dof: 'Глубина резкости', materials: 'Материалы', textures: 'Фактуры', atmosphere: 'Атмосфера', palette: 'Цветовая палитра', style: 'Визуальный стиль',
    noText: 'Без текста, подписей, логотипов и водяных знаков в кадре.',
    video: (f: string, d: string, subject: string) => `Вертикальное видео ${f}, ${d} с. Начни с опорного изображения этой сцены: ${subject} — сохрани того же персонажа, одежду, локацию, освещение и палитру.`,
    subjectMove: 'Движение персонажа', face: 'Мимика', cameraMove: 'Движение камеры', objectMove: 'Движение объектов', envMove: 'Движение окружения', physical: 'Физическое взаимодействие',
    timing: 'Тайминг', transition: 'Переход', into: (s: string) => ` в следующий кадр (${s})`, ending: 'Финальный кадр',
    continuity: (c: ContinuityState) => `Непрерывность: ${clean(c.character)}; одежда: ${clean(c.wardrobe)}. Стиль камеры: ${clean(c.cameraStyle)}. Визуальный стиль: ${clean(c.visualStyle)}.`,
    physics: 'Реалистичная физика и естественное размытие движения; без искажённых лиц, лишних конечностей и текста на экране.',
  },
};

const photorealism = (settings: ReelSettings, lang: Lang) => (lang === 'ru' ? STYLES_RU[settings.style].photorealism : STYLE_PRESETS[settings.style].photorealism);

/** The prompt layer of a scene in the given language; English is the top-level layer. */
export function layerOf(scene: Scene, lang: Lang): PromptLayer | undefined {
  return lang === 'ru' ? scene.ru : scene;
}

/**
 * IMAGE PROMPT compiler. Continuity (character, wardrobe, location, palette, style) is injected from the
 * scene's CONTINUITY_STATE so every frame of the reel describes the same world.
 */
export function compileImagePrompt(scene: Scene, settings: ReelSettings, lang: Lang = 'en'): string {
  const layer = layerOf(scene, lang);
  if (!layer) return '';
  const { continuity: c, image: i } = layer;
  const t = LABELS[lang];
  return [
    `${t.frame(settings.format)} ${capitalize(clean(i.subject))}.`,
    `${t.character}: ${clean(c.character)}.`,
    `${t.clothing}: ${clean(c.wardrobe)}.`,
    `${t.environment}: ${clean(c.location)}; ${t.details}: ${c.objects.map(clean).join(', ')}. ${capitalize(clean(c.time))}, ${clean(c.weather)}.`,
    `${t.composition}: ${clean(i.composition)}.`,
    `${t.angle}: ${clean(i.cameraAngle)}. ${t.lens}: ${clean(i.lens)}.`,
    `${t.lighting}: ${clean(i.lighting ?? c.lighting)}.`,
    `${t.dof}: ${clean(i.depthOfField)}.`,
    `${t.materials}: ${clean(i.materials)}. ${t.textures}: ${clean(i.textures)}.`,
    `${t.atmosphere}: ${clean(i.atmosphere)}.`,
    `${t.palette}: ${clean(c.colorPalette)}.`,
    `${t.style}: ${clean(c.visualStyle)}. ${capitalize(clean(photorealism(settings, lang)))}.`,
    t.noText,
  ].join('\n');
}

/** VIDEO PROMPT compiler: animates the matching image prompt and ends on a frame the next scene can start from. */
export function compileVideoPrompt(scene: Scene, settings: ReelSettings, next?: Scene, lang: Lang = 'en'): string {
  const layer = layerOf(scene, lang);
  if (!layer) return '';
  const { continuity: c, video: v } = layer;
  const t = LABELS[lang];
  const dur = fmtSec(scene.end - scene.start);
  const nextLayer = next && layerOf(next, lang);
  return [
    t.video(settings.format, lang === 'ru' ? dur.replace('.', ',') : dur, clean(layer.image.subject)),
    `${t.subjectMove}: ${clean(v.subjectMovement)}.`,
    `${t.face}: ${clean(v.facialMovement)}.`,
    `${t.cameraMove}: ${clean(v.cameraMovement)}.`,
    `${t.objectMove}: ${clean(v.objectMovement)}.`,
    `${t.envMove}: ${clean(v.environmentMovement)}.`,
    `${t.physical}: ${clean(v.physicalInteraction)}.`,
    `${t.timing}: ${clean(v.timing)}.`,
    `${t.transition}: ${clean(v.transition)}${nextLayer ? t.into(clean(nextLayer.image.subject).slice(0, 90)) : ''}.`,
    `${t.ending}: ${clean(v.endingFrame)}.`,
    t.continuity(c),
    t.physics,
  ].join('\n');
}

/** Compiles prompts for every prompt layer the scenes have (English always, Russian when present). */
export function withPrompts(scenes: Scene[], settings: ReelSettings): Scene[] {
  return scenes.map((s, i) => ({
    ...s,
    imagePrompt: compileImagePrompt(s, settings, 'en'),
    videoPrompt: compileVideoPrompt(s, settings, scenes[i + 1], 'en'),
    ...(s.ru ? { ru: { ...s.ru, imagePrompt: compileImagePrompt(s, settings, 'ru'), videoPrompt: compileVideoPrompt(s, settings, scenes[i + 1], 'ru') } } : {}),
  }));
}

/** Prompt text for display/copy in the requested language, falling back to English. */
export function promptsFor(scene: Scene, lang: Lang): { image: string; video: string; lang: Lang } {
  const layer = lang === 'ru' && scene.ru?.imagePrompt ? scene.ru : scene;
  return { image: layer.imagePrompt, video: layer.videoPrompt, lang: layer === scene ? 'en' : 'ru' };
}

export function evolve(state: ContinuityState, patch: Partial<ContinuityState>): ContinuityState {
  return { ...state, ...patch, objects: patch.objects ? [...patch.objects] : [...state.objects] };
}
