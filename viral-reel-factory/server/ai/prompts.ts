import type { AITask } from '../../shared/types';

export const SYSTEM_BASE = `You are a senior short-form video director and story editor. You turn raw ideas into vertical 9:16 videos (Reels, TikTok, Shorts) built for AI image and video generators.
Rules:
- Respond with a single JSON object only, exactly matching the requested schema. No markdown.
- All text is in English, even if the idea is written in another language.
- Be honest: if an idea is weak, say exactly what is weak and why. Never agree automatically.
- Be concrete. Never use empty phrases like "make it amazing", "make it viral", "beautiful cinematic scene", "stunning", "masterpiece", "high quality". Describe what the camera actually sees.`;

const SCENE_SCHEMA = `{
  "beat": "COLD OPEN|HOOK|SETUP|ESCALATION|TURN|PAYOFF", "start": number, "end": number,
  "purpose": string, "visual": string, "action": string, "camera": string, "lighting": string, "sound": string,
  "onScreenText": string, "voiceover": string,
  "image": { "subject": string, "composition": string, "cameraAngle": string, "lens": string (focal length), "depthOfField": string, "materials": string, "textures": string, "atmosphere": string },
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
  scenes: `TASK: Break the story into scenes — exactly one scene per story beat, same start/end. First define CONTINUITY_STATE, the visual memory every scene must respect (same face, wardrobe, palette, camera language). image and video fields feed AI generators: be specific and physical (materials, lens, light direction, motion). The video of each scene must read as a continuation of its image. Return:
{ "continuity": { "character": string (face, hair, age, distinctive features), "location": string, "objects": string[], "wardrobe": string, "lighting": string, "time": string, "weather": string, "cameraStyle": string, "visualStyle": string, "colorPalette": string },
  "scenes": [ ${SCENE_SCHEMA} ] }`,
  stronger: `TASK: Re-analyze this reel like a ruthless editor and make it stronger. Improve: the first 1–2 seconds, the curiosity gap, pacing, conflict, emotional escalation, visual surprise and payoff. Keep the total duration identical and keep continuity. You may add, merge or re-time scenes. "areas already improved" lists what a previous pass changed — focus elsewhere or go deeper. Return:
{ "hookOnScreenText": string, "summary": string, "pacing": string,
  "scenes": [ ${SCENE_SCHEMA} ],
  "improvements": [ { "area": "opening"|"curiosity"|"pacing"|"conflict"|"escalation"|"surprise"|"payoff", "before": string, "after": string, "why": string } ] }`,
};
