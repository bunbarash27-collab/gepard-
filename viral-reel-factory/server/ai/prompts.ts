import type { AITask, Lang } from '../../shared/types';

const LANGUAGE_NAME: Record<Lang, string> = { ru: 'Russian', en: 'English' };

/** System prompt for narrative tasks. `language` drives narrative; generator-facing fields stay English. */
export function systemPrompt(language: Lang): string {
  const name = LANGUAGE_NAME[language];
  return `You are a senior short-form video director and story editor. You turn raw ideas into vertical 9:16 videos (Reels, TikTok, Shorts) built for AI image and video generators.
Language contract (language = "${language}"):
- Narrative language = ${name}. Write ALL narrative text in ${name}: concept, analysis, critique and recommendations, hooks and why they work, story, emotional arc, pacing, scene purpose / visual / action / camera / lighting / sound, on-screen text and voiceover.${
    language === 'ru'
      ? '\n- Write natural, modern Russian. Voiceover and on-screen text must sound like live speech written by a native speaker, never a literal translation from English.'
      : ''
  }
- Generator-facing fields ("image", "video", "continuity", "continuityChanges") are ALWAYS in English, whatever the narrative language.
- "improvedIdea" uses the same language the user's idea is written in.
- Enum values (beat names, hook types, tempo, verdict, improvement areas) stay exactly as written in the schema.
Rules:
- Respond with a single JSON object only, exactly matching the requested schema. No markdown.
- Be honest: if an idea is weak, say exactly what is weak and why. Never agree automatically.
- Be concrete. Never use empty phrases like "make it amazing", "make it viral", "beautiful cinematic scene", "stunning", "masterpiece", "high quality". Describe what the camera actually sees.`;
}

/** System prompt for the prompt-language task: rewrites generator-facing fields into Russian. */
export const PROMPT_TRANSLATOR = `You localize prompts for AI image and video generators into Russian.
- Respond with a single JSON object only, exactly matching the requested schema. No markdown.
- Keep every concrete visual instruction: focal lengths, f-stops, camera and lens names, timings, colors, materials. Do not add, drop or soften details.
- Use natural professional Russian film vocabulary (наезд, отъезд, крупный план, глубина резкости). Camera brand names may stay in Latin script.`;

const SCENE_SCHEMA = `{
  "beat": "COLD OPEN|HOOK|SETUP|ESCALATION|TURN|PAYOFF", "start": number, "end": number,
  "purpose": string, "visual": string, "action": string, "camera": string, "lighting": string, "sound": string,
  "onScreenText": string, "voiceover": string,
  "image": { "subject": string, "composition": string, "cameraAngle": string, "lens": string (focal length), "depthOfField": string, "lighting": string, "materials": string, "textures": string, "atmosphere": string },
  "video": { "subjectMovement": string, "cameraMovement": string, "objectMovement": string, "facialMovement": string, "environmentMovement": string, "physicalInteraction": string, "timing": string (second-by-second), "transition": string, "endingFrame": string },
  "continuityChanges": { optional subset of "location", "objects" (string[]), "lighting", "time", "weather", "colorPalette" — only what changes in this scene }
}`;

export const TASK_INSTRUCTIONS: Record<AITask, string> = {
  analyze: `TASK: Analyze the idea before anything is written. Return:
{ "concept": string, "mainCharacter": string (who, age, look, wardrobe), "goal": string, "conflict": string, "surprise": string, "emotionalDirection": string, "payoff": string,
  "score": integer 1-10, "verdict": "strong"|"needs-work"|"weak", "strengths": string[], "weaknesses": string[] (specific, blunt), "improvedIdea": string (same language as the input idea; omit only if there are no weaknesses) }`,
  hooks: `TASK: Write 5 genuinely different hooks for the first 1–2 seconds, one per type: curiosity, shock, emotional, visual, story. Return:
{ "hooks": [ { "type": "curiosity"|"shock"|"emotional"|"visual"|"story", "hook": string, "whyItWorks": string, "openingShot": string (what the viewer sees in the first 2 seconds), "onScreenText": string (short, may be empty) } ] }`,
  story: `TASK: Write the dramaturgy for the selected hook. Default structure HOOK → SETUP → ESCALATION → TURN → PAYOFF, but change it if that makes this story stronger (and say why in structureNote). Beats must cover exactly 0..duration seconds. Return:
{ "title": string, "summary": string, "structureNote": string, "emotionalArc": string, "pacing": string, "additions": string[] (elements you had to add because the idea lacked them),
  "beats": [ { "beat": "HOOK|SETUP|ESCALATION|TURN|PAYOFF|COLD OPEN", "start": number, "end": number, "description": string, "emotion": string (viewer emotion), "tempo": "fast"|"pause"|"peak"|"steady", "pacing": string } ] }`,
  scenes: `TASK: Break the story into scenes — exactly one scene per story beat, same start/end. Scene start/end must run contiguously from 0 and end exactly at settings.duration seconds: the scene durations sum to exactly the selected duration and no scene lies beyond it. First define CONTINUITY_STATE, the visual memory every scene must respect (same face, wardrobe, palette, camera language). image and video fields feed AI generators: be specific and physical (materials, lens, light direction, motion). The video of each scene must read as a continuation of its image. Return:
{ "continuity": { "character": string (face, hair, age, distinctive features), "location": string, "objects": string[], "wardrobe": string, "lighting": string, "time": string, "weather": string, "cameraStyle": string, "visualStyle": string, "colorPalette": string },
  "scenes": [ ${SCENE_SCHEMA} ] }`,
  stronger: `TASK: Re-analyze this reel like a ruthless editor and make it stronger. Improve: the first 1–2 seconds, the curiosity gap, pacing, conflict, emotional escalation, visual surprise and payoff. Keep the total duration exactly equal to settings.duration (scenes contiguous from 0, none beyond it) and keep continuity. You may add, merge or re-time scenes. "areas already improved" lists what a previous pass changed — focus elsewhere or go deeper. Return:
{ "hookOnScreenText": string, "summary": string, "pacing": string,
  "scenes": [ ${SCENE_SCHEMA} ],
  "improvements": [ { "area": "opening"|"curiosity"|"pacing"|"conflict"|"escalation"|"surprise"|"payoff", "before": string, "after": string, "why": string } ] }`,
  prompts: `TASK: Translate the generator-facing layer of every scene into Russian. Keep the same keys and the same scene order. Return:
{ "scenes": [ { "image": { same keys as input }, "video": { same keys as input }, "continuity": { same keys as input, "objects" stays a string[] } } ] }`,
};
