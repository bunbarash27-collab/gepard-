import type { ContinuityState, ReelSettings, Scene } from './types';
import { STYLE_PRESETS } from './lexicon';
import { capitalize, fmtSec, stripVague } from './util';

const clean = (s: string) => stripVague(s).replace(/\s*\.+$/, '');

/**
 * IMAGE PROMPT compiler. Continuity (character, wardrobe, location, palette, style) is injected from the
 * scene's CONTINUITY_STATE so every frame of the reel describes the same world.
 */
export function compileImagePrompt(scene: Scene, settings: ReelSettings): string {
  const c = scene.continuity;
  const i = scene.image;
  const style = STYLE_PRESETS[settings.style];
  return [
    `Vertical ${settings.format} frame. ${capitalize(clean(i.subject))}.`,
    `Character: ${clean(c.character)}.`,
    `Clothing: ${clean(c.wardrobe)}.`,
    `Environment: ${clean(c.location)}; visible details: ${c.objects.map(clean).join(', ')}. ${capitalize(clean(c.time))}, ${clean(c.weather)}.`,
    `Composition: ${clean(i.composition)}.`,
    `Camera angle: ${clean(i.cameraAngle)}. Lens: ${clean(i.lens)}.`,
    `Lighting: ${clean(scene.lighting)}.`,
    `Depth of field: ${clean(i.depthOfField)}.`,
    `Materials: ${clean(i.materials)}. Textures: ${clean(i.textures)}.`,
    `Atmosphere: ${clean(i.atmosphere)}.`,
    `Color palette: ${clean(c.colorPalette)}.`,
    `Visual style: ${clean(c.visualStyle)}. ${clean(style.photorealism)}.`,
    'No text, captions, logos or watermarks in the frame.',
  ].join('\n');
}

/** VIDEO PROMPT compiler: animates the matching image prompt and ends on a frame the next scene can start from. */
export function compileVideoPrompt(scene: Scene, settings: ReelSettings, next?: Scene): string {
  const c = scene.continuity;
  const v = scene.video;
  const dur = fmtSec(scene.end - scene.start);
  return [
    `Vertical ${settings.format} video, ${dur} seconds. Start from the reference image of this scene: ${clean(scene.image.subject)} — keep the same character, wardrobe, location, lighting and color palette.`,
    `Subject movement: ${clean(v.subjectMovement)}.`,
    `Facial movement: ${clean(v.facialMovement)}.`,
    `Camera movement: ${clean(v.cameraMovement)}.`,
    `Object movement: ${clean(v.objectMovement)}.`,
    `Environment movement: ${clean(v.environmentMovement)}.`,
    `Physical interaction: ${clean(v.physicalInteraction)}.`,
    `Timing: ${clean(v.timing)}.`,
    `Transition: ${clean(v.transition)}${next ? ` into the next shot (${clean(next.image.subject).slice(0, 90)})` : ''}.`,
    `Ending frame: ${clean(v.endingFrame)}.`,
    `Continuity: ${clean(c.character)}; wearing ${clean(c.wardrobe)}. Camera style: ${clean(c.cameraStyle)}. Visual style: ${clean(c.visualStyle)}.`,
    'Realistic physics and natural motion blur; no morphing faces, no extra limbs, no on-screen text.',
  ].join('\n');
}

export function withPrompts(scenes: Scene[], settings: ReelSettings): Scene[] {
  return scenes.map((s, i) => ({ ...s, imagePrompt: compileImagePrompt(s, settings), videoPrompt: compileVideoPrompt(s, settings, scenes[i + 1]) }));
}

export function evolve(state: ContinuityState, patch: Partial<ContinuityState>): ContinuityState {
  return { ...state, ...patch, objects: patch.objects ? [...patch.objects] : [...state.objects] };
}
