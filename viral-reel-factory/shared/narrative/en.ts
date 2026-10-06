// English language pack (the original Phase 1 wording).
import { STYLE_PRESETS } from '../lexicon';
import { fill, type ParsedIdea } from '../parser';
import type { BeatName, HookType } from '../types';
import { capitalize as cap, fmtSec } from '../util';
import { firstPart, noDot, timingWith } from './common';
import type { Core, Ctx, HookText, SceneArgs, Texts } from './types';

const NONE_TEXT = '— (none)';
const NONE_VO = '— (no voiceover)';
const timing = timingWith(fmtSec, 's');

function use(x: Ctx) {
  const { p } = x;
  const { character: c, location: l, world: wd } = p;
  return { p, c, l, wd, f: (s: string) => fill(s, p), R: cap(c.ref), style: STYLE_PRESETS[x.style] };
}

const EMOTION: Record<BeatName, [string, string]> = {
  'COLD OPEN': ['Shock — "what am I looking at?"', 'Shock — "wait, what?"'],
  HOOK: ['Curiosity', 'Curiosity'],
  SETUP: ['Recognition — "that\'s me"', 'Recognition — "that\'s so me"'],
  ESCALATION: ['Unease — something is off', 'Suspicion — something is very off'],
  TURN: ['Awe and fear', 'Absurd disbelief'],
  PAYOFF: ['Relief, then delight', 'Laugh-out-loud release'],
};

const PACING: Record<BeatName, string> = {
  'COLD OPEN': 'Fast: under a second, a glimpse — not an explanation.',
  HOOK: 'Fast: first frame already in motion, text on screen from frame 1, hard cut out.',
  SETUP: 'Steady: 2–3 quick shots, natural rhythm, no music yet.',
  ESCALATION: 'Pause: hold on small details while ambient sound drops — silence builds tension.',
  TURN: 'Peak: the biggest image and the loudest sound, longest hold of the video.',
  PAYOFF: 'Short pause, then the final beat: one-second hold on the proof before the cut.',
};
const PACING_VARIANT: Partial<Record<BeatName, string>> = {
  ESCALATION: 'Accelerating: each cut shorter than the last, sound design creeping up.',
  TURN: 'Hold: let the viewer take in the new world — no cuts for the whole beat.',
  PAYOFF: 'Snap: a single deadpan beat, then hard cut to black.',
};

function scene(x: Ctx, a: SceneArgs): Core {
  const { p } = x;
  const style = STYLE_PRESETS[x.style];
  const { beat, k, hook, cont, isLast, hasEsc } = a;
  const { character: c, location: l, world: wd } = p;
  const f = (s: string) => fill(s, p);
  const R = cap(c.ref);
  const dur = beat.end - beat.start;
  const L = style.lens;
  const creature = firstPart(wd.creature);
  const shallow = 'shallow, around f/2 — background falls into soft, creamy bokeh';
  const captionSafe = 'top 15% of the frame left clean for on-screen text';

  if (beat.beat === 'HOOK') {
    const shock = hook.type === 'shock';
    const subject = {
      curiosity: `${cap(l.frame)} centered in the frame and glowing slightly too bright, ${c.ref} approaching in the background`,
      shock: `${cap(f(wd.reveal))}, seen from inside ${l.short}`,
      emotional: `${R} pausing with ${c.their} eyes closed, exhaling after a long day, about to step into ${l.short}`,
      visual: `${R} mid-motion as ${c.they} ${f(p.trigger)}, ${l.frame} framed behind ${c.them}`,
      story: `found-footage view from a phone propped up in ${l.short}: ${c.ref} arriving`,
    }[hook.type];
    return {
      purpose: { curiosity: 'Open a question the viewer needs answered', shock: 'Stop the scroll with the most impossible image first', emotional: 'Make the viewer feel the hero\'s exhaustion in one second', visual: 'Hook with one physical action and an instant visual change', story: 'Frame the video as proof of something that already happened' }[hook.type],
      visual: hook.openingShot,
      action: shock ? `${cap(f(wd.reveal))}. Freeze, then a rewind blur.` : hook.type === 'visual' ? `${R} ${f(p.trigger)}; the light through ${l.frame} flips in a single frame.` : `${R} approaches ${l.short}, unaware of what is coming.`,
      camera: shock ? `Extreme close-up on a ${L.close}, locked off, then a fast reverse blur` : hook.type === 'visual' ? `One unbroken shot on a ${L.wide}, eye-level, slow push-in` : `${cap(style.move)} toward the face on a ${L.medium}, eye-level`,
      lighting: cont.lighting,
      sound: shock ? `${cap(firstPart(wd.sound))} at full volume, cut off by a tape-rewind zip` : `${cap(style.sound)}; one sharp hit on the first frame`,
      onScreenText: hook.onScreenText || '— (no text: the image carries the hook)',
      voiceover: hook.type === 'emotional' || hook.type === 'story' ? hook.hook : NONE_VO,
      image: {
        subject,
        composition: `${shock ? `${cap(creature)} fills the upper two-thirds, the edge of ${l.frame} frames it` : `${R} in the lower-middle third, eyes on the upper rule-of-thirds line, ${l.frame} behind`}; ${captionSafe}`,
        cameraAngle: shock ? 'eye-level, straight-on through the glass' : 'eye-level, slight three-quarter angle',
        lens: shock ? L.close : hook.type === 'visual' ? L.wide : L.medium,
        depthOfField: shallow,
        materials: shock ? wd.materials : l.materials,
        textures: shock ? wd.textures : l.textures,
        atmosphere: shock ? wd.atmosphere : 'ordinary, quiet, a little too still',
      },
      video: {
        subjectMovement: shock ? `${cap(creature)} shifts its weight and blinks once` : hook.type === 'visual' ? `${R} ${f(p.trigger)}` : `${R} walks toward ${l.short}, tired, eyes down`,
        cameraMovement: shock ? 'locked off, then a fast reverse whip-blur (rewind effect) in the last 0.3 s' : `slow ${style.move} toward the face, ending about 15% tighter`,
        objectMovement: shock ? 'mist drifts across the glass' : `the ${l.objects[1]} sits still; nothing else moves`,
        facialMovement: shock ? 'the pupil contracts as it focuses on the lens' : 'a tired blink, a small exhale through the nose, shoulders drop',
        environmentMovement: shock ? `${firstPart(wd.weather)}; foliage and particles drift slowly` : 'the background is eerily still',
        physicalInteraction: shock ? 'warm breath fogs the outside of the glass' : `${c.their} hand rests on the ${l.objects[0]}`,
        timing: shock ? timing(dur, 'hold on the impossible image', 'rewind blur') : timing(dur, 'establish the hero in motion', 'push in as the text lands'),
        transition: shock ? 'rewind-blur smash cut' : 'hard cut on the beat',
        endingFrame: shock ? 'motion-blurred frame mid-rewind' : `${R}'s face in a tight medium close-up, ${l.frame} behind`,
      },
    };
  }

  if (beat.beat === 'SETUP') {
    const first = k === 0;
    const withTrigger = first && !hasEsc;
    return {
      purpose: first ? 'Establish the hero and the normal world' : 'Make the routine feel real so the break hurts more',
      visual: first ? `${R} ${f(l.enter)}. ${cap(l.environment)}.` : `Close details of the routine: the ${l.objects.slice(0, 2).join(', the ')}.`,
      action: first ? `${R} ${f(l.enter)}${withTrigger ? `, then ${f(p.trigger)}` : ''}.` : `${R} ${f(l.routine)}.`,
      camera: first ? `Medium-wide on a ${L.wide}, eye-level, ${style.move} following ${c.them} in` : `Insert close-ups on a ${L.close}: hands, objects, a glance`,
      lighting: cont.lighting,
      sound: `Natural room tone of ${l.short}; ${first ? 'footsteps, rustle of clothing' : 'small foley: clicks, fabric, breathing'}; no music`,
      onScreenText: NONE_TEXT,
      voiceover: NONE_VO,
      image: {
        subject: first ? `${R} ${f(l.enter)}` : `close-up of ${c.their} hands as ${c.they} ${f(l.routine)}`,
        composition: first ? `${R} on the left third, the depth of ${l.short} leading the eye to the right` : `hands and the ${l.objects[0]} fill the frame, ${c.their} face soft in the background`,
        cameraAngle: first ? 'eye-level, slightly wide' : 'slight top-down angle',
        lens: first ? L.wide : L.close,
        depthOfField: first ? 'moderate, around f/4 — the whole interior readable' : shallow,
        materials: l.materials,
        textures: l.textures,
        atmosphere: 'mundane, familiar, quiet',
      },
      video: {
        subjectMovement: first ? `${R} ${f(l.enter)}${withTrigger ? `, then ${f(p.trigger)}` : ''}` : `${R} ${f(l.routine)}`,
        cameraMovement: first ? `${style.move} that follows ${c.them} and settles` : 'static insert with a tiny drift',
        objectMovement: first ? `${c.their} bag lands and slumps` : `the ${l.objects[1]} jiggles slightly`,
        facialMovement: 'neutral, tired, slightly distracted',
        environmentMovement: 'normal background activity, nothing unusual',
        physicalInteraction: first ? `${c.their} body sinks into the seat` : `fingers touch the ${l.objects[0]}`,
        timing: timing(dur, first ? 'entrance' : 'routine action', first ? 'settle into position' : 'hold on the detail'),
        transition: withTrigger ? 'the trigger sound cuts into dead silence — straight into the turn' : 'match cut on movement',
        endingFrame: withTrigger ? `${R} perfectly still, ${l.frame} behind ${c.them}` : `${R} settled in ${l.short}, a calm frame`,
      },
    };
  }

  if (beat.beat === 'ESCALATION') {
    const omen = f(wd.omens[Math.min(k, 2)]);
    return {
      purpose: k === 0 ? 'Trigger: the action that breaks reality, and the first sign' : 'Escalate: the signs get impossible to ignore',
      visual: k === 0 ? `${R} ${f(p.trigger)}. Silence. ${cap(omen)}.` : `${cap(omen)}.`,
      action: k === 0 ? `${R} ${f(p.trigger)}, then notices: ${omen}. Frowns, dismisses it.` : `${R} freezes, then slowly looks around.`,
      camera: k === 0 ? `Insert on the detail with a ${L.close}, rack focus to ${c.their} face` : `Slow push-in on ${c.their} face on a ${L.medium}`,
      lighting: cont.lighting,
      sound: k === 0 ? 'The trigger sound, then all ambience drops out — a low, barely audible rumble' : `${cap(firstPart(wd.sound))}, faint, getting closer`,
      onScreenText: NONE_TEXT,
      voiceover: NONE_VO,
      image: {
        subject: k === 0 ? `${R} in ${l.short} at the moment ${omen}` : `${R}'s face frozen mid-glance as ${omen}`,
        composition: `the omen detail sharp in the foreground, ${c.ref}'s face soft behind it`,
        cameraAngle: 'eye-level, tight',
        lens: L.close,
        depthOfField: `${shallow}; focus on the detail`,
        materials: l.materials,
        textures: l.textures,
        atmosphere: 'quiet tension, something is wrong',
      },
      video: {
        subjectMovement: k === 0 ? `${R} ${f(p.trigger)}, then stops` : `${R} turns ${c.their} head slowly`,
        cameraMovement: k === 0 ? 'static insert, then a rack focus from the detail to the face' : 'very slow push-in',
        objectMovement: omen,
        facialMovement: k === 0 ? 'a small frown, eyes flick to the detail and back' : 'eyes widen, breath held',
        environmentMovement: `the light shifts toward ${firstPart(wd.palette)}`,
        physicalInteraction: k === 0 ? `${c.their} hand still on the handle` : 'fingers tighten',
        timing: timing(dur, 'trigger', 'silence', omen),
        transition: 'hold, then a sharp cut on a bass hit',
        endingFrame: `${R} looking toward ${l.frame}, face in profile`,
      },
    };
  }

  if (beat.beat === 'TURN') {
    const reveal = f(wd.reveal);
    return {
      purpose: k === 0 ? 'The turn: reveal the impossible world' : 'Let the viewer take in the new world',
      visual: k === 0 ? `${cap(reveal)}. ${cap(wd.environment)}.` : `${cap(f(wd.reaction))}.`,
      action: k === 0 ? `${R} slowly turns and sees it. Doesn't move.` : `${R} presses back into the seat, barely breathing.`,
      camera: k === 0 ? `Over-the-shoulder on a ${L.wide} through ${l.frame}, slow push-in` : `Two-shot on a ${L.medium}: ${c.ref} in the foreground, ${creature} behind the glass`,
      lighting: cont.lighting,
      sound: `${cap(wd.sound)}; a deep score swell${k === 0 ? ' peaking on the reveal' : ''}`,
      onScreenText: k === 0 ? '— (none: the image speaks)' : NONE_TEXT,
      voiceover: NONE_VO,
      image: {
        subject: k === 0 ? `over-the-shoulder view from inside ${l.short}: ${reveal}` : `${R} frozen in ${l.short} while ${f(wd.reaction)}`,
        composition: `${c.ref}'s shoulder and head silhouette in the lower-left foreground, ${creature} dominating the frame through ${l.frame}`,
        cameraAngle: 'over-the-shoulder, slightly low to exaggerate scale',
        lens: k === 0 ? L.wide : L.medium,
        depthOfField: 'deep, around f/5.6 — both the hero and the world are sharp',
        materials: `${l.materials}; outside: ${wd.materials}`,
        textures: wd.textures,
        atmosphere: wd.atmosphere,
      },
      video: {
        subjectMovement: k === 0 ? `${R} turns ${c.their} head slowly and freezes` : `${R} leans back, hands lifting off the ${l.objects[0]}`,
        cameraMovement: k === 0 ? 'slow push-in over the shoulder toward the glass' : 'locked off — no movement, let it breathe',
        objectMovement: k === 0 ? `${creature} moves closer, filling ${l.frame}` : f(wd.reaction),
        facialMovement: k === 0 ? 'mouth opens slightly, pupils dilate, total stillness' : 'a tiny, shaky exhale, eyes locked on the glass',
        environmentMovement: `${firstPart(wd.weather)}; ${wd.objects.slice(1).join(' and ')} move in the background`,
        physicalInteraction: k === 0 ? 'the glass vibrates with each movement outside' : f(wd.reaction),
        timing: timing(dur, 'slow turn of the head', 'the reveal fills the glass', 'hold on the full image'),
        transition: isLast ? 'cut to black' : 'hard cut to black for 2 frames',
        endingFrame: `${creature} filling ${l.frame}, ${c.ref} small in the foreground`,
      },
    };
  }

  // PAYOFF
  const artifact = `${wd.artifact} ${f(l.artifactPlace)}`;
  return {
    purpose: k === 0 ? 'Payoff: back to normal — with proof it was real' : 'Button: one last beat that makes viewers rewatch',
    visual: k === 0 ? `${R} back in ${l.short} as if nothing happened. ${cap(artifact)}.` : `${R} looks straight into the lens.`,
    action: k === 0 ? `${R} squeezes ${c.their} eyes shut, opens them — normal. Then sees ${artifact}.` : `${R} stares into the lens; off-screen, ${firstPart(wd.sound)}.`,
    camera: k === 0 ? `Medium on a ${L.medium}, then a tilt down to the proof` : `Static close-up on a ${L.close}, centered`,
    lighting: cont.lighting,
    sound: k === 0 ? 'Normal room tone returns abruptly; a soft musical sting on the proof' : `Silence, then ${firstPart(wd.sound)} off-screen`,
    onScreenText: k === 0 && !isLast ? NONE_TEXT : 'Wait… it was real?',
    voiceover: NONE_VO,
    image: {
      subject: k === 0 ? `${R} in ${l.short}, looking down at ${artifact}` : `${R} looking straight into the lens, deadpan`,
      composition: k === 0 ? `${c.ref}'s face in the upper third, ${wd.artifact} sharp in the lower third` : `centered close-up, symmetrical; ${captionSafe}`,
      cameraAngle: k === 0 ? 'eye-level, tilting down' : 'eye-level, straight on',
      lens: k === 0 ? L.medium : L.close,
      depthOfField: shallow,
      materials: l.materials,
      textures: `${l.textures}; ${firstPart(wd.textures)}`,
      atmosphere: 'relief, then quiet disbelief',
    },
    video: {
      subjectMovement: k === 0 ? `${R} opens ${c.their} eyes, exhales, then freezes looking down` : `${R} slowly turns to the lens`,
      cameraMovement: k === 0 ? 'static, then a slow tilt down to the proof' : 'locked off',
      objectMovement: k === 0 ? `${wd.artifact} lies still` : 'nothing moves',
      facialMovement: k === 0 ? 'relief, a half-smile, then the smile drops' : 'deadpan stare, one eyebrow raised',
      environmentMovement: 'everything normal again',
      physicalInteraction: k === 0 ? `${c.their} fingertips touch the ${firstPart(wd.artifact).replace(/^an? /, '')}` : 'none',
      timing: timing(dur, 'eyes open, relief', 'tilt to the proof', 'hold on the proof'),
      transition: isLast ? 'hard cut to black on the sound' : 'cut on the look',
      endingFrame: isLast ? 'the hero framed like the opening shot, so the loop restarts naturally' : `${R}'s face, thinking`,
    },
  };

}

function improveIdea(p: ParsedIdea): string {
  const base = noDot(p.raw);
  const wd = p.world;
  const lower = base.charAt(0).toLowerCase() + base.slice(1);
  let s = p.characterFound ? cap(base) : `A woman in her late 20s: ${lower}`;
  if (!p.twist) s += `, but a second later the world around is ${wd.label}`;
  if (!p.conflict) s += '. Trying to get back fails — the way back is gone';
  return `${s}. In the end everything snaps back to normal, except ${wd.artifact} — proof it really happened.`;
}

export const en: Texts = {
  lang: 'en',
  none: { text: NONE_TEXT, vo: NONE_VO },
  improveIdea,

  analysis(x) {
    const { p, c, l, wd, f, R } = use(x);
    return {
      concept: p.twist
        ? `Reality-break short: ${c.ref} ${f(l.enter)} — a completely ordinary ${l.label.toLowerCase()} moment — then ${f(p.trigger)} and ${p.worldFound ? `is suddenly in ${wd.label}` : `the twist hits: «${p.twistClause}»`}. The whole video runs on the contrast between the mundane and the impossible.`
        : `Slice-of-life moment: «${p.raw}». As written there is no turn — the viewer watches a routine and nothing breaks it.`,
      mainCharacter: `${c.label} — ${c.description}, ${c.appearance}; wearing ${c.wardrobe}.${p.characterFound ? '' : ' Not defined in the idea; the engine picked a default — replace it with someone specific.'}`,
      goal: p.conflict
        ? `From the idea: «${p.conflictClause}».`
        : `${R} wants to ${f(l.goal)}. Small and relatable — every viewer has had this exact moment.${p.twist ? ' After the turn the goal flips: get back to normal.' : ''}`,
      conflict: p.conflict
        ? `From the idea: «${p.conflictClause}».`
        : `Missing — nothing stands in ${c.their} way. Suggested: ${f(l.obstacle)}; ${c.ref} wants out and can't get out.`,
      surprise: p.worldFound
        ? `${cap(l.frame)} no longer shows the usual surroundings: ${wd.label}. Key image: ${f(wd.reveal)}.`
        : p.twistClause
          ? `«${p.twistClause}» — the turn exists but has no concrete image yet.`
          : `None in the idea. Suggested: ${l.frame} suddenly opens onto ${wd.label}.`,
      emotionalDirection: x.style === 'comedy'
        ? 'Recognition ("that\'s me") → confusion → absurd escalation → laugh-out-loud release.'
        : 'Calm familiarity → creeping unease → awe and fear at the reveal → relief with a wink at the end.',
      payoff: `${R} snaps back to ${l.short} as if nothing happened — but ${wd.artifact} lies ${f(l.artifactPlace)}. It was real. The last frame mirrors the first so the video loops.`,
    };
  },

  strength(code, x) {
    const { p, c, l, wd } = use(x);
    return {
      hero: `Clear hero (${c.label.split(' (')[0].toLowerCase()}) — the viewer knows who to watch from frame one.`,
      location: `Concrete, familiar location (${l.label.toLowerCase()}) — instantly relatable and readable in one frame.`,
      surprise: `Strong visual surprise (${wd.label}) — one image that explains itself with the sound off.`,
      twist: 'There is a turn in the idea.',
      conflict: `Built-in conflict: «${p.conflictClause}».`,
    }[code];
  },

  weakness(code, x) {
    const { c, l, wd, f, R } = use(x);
    return {
      noHero: 'No defined main character. A specific person (age, look, mood) makes the first frame readable in under a second — the engine had to pick a default.',
      noLocation: 'No concrete location. A familiar place (car, elevator, kitchen) gives the viewer an instant "this is normal" baseline that the twist can break.',
      noSurprise: `No surprise. Nothing unexpected happens, so there is no reason to keep watching past second 3. Add a turn the viewer can't predict — e.g. ${wd.label}.`,
      notVisual: 'The twist is not visual yet. Name one concrete image the viewer will remember and describe to friends.',
      noConflict: `No conflict. ${R} never wants anything that gets blocked, so there are no stakes — the surprise happens to the hero, but the hero does nothing about it. Give ${c.them} an obstacle: ${f(l.obstacle)}.`,
      noEmotion: 'No emotional target. Decide what the viewer should feel at the end (laugh, chills, awe) — the payoff is designed around it.',
      tooShort: 'Too short to carry a story — it reads as a topic, not a situation.',
    }[code];
  },

  hooks(x) {
    const { p, c, l, wd, f, R } = use(x);
    const out: Record<HookType, HookText> = {
      curiosity: {
        hook: `Watch ${l.frame}. ${R} hasn't noticed yet.`,
        whyItWorks: `Gives the viewer a job ("watch this") and an information gap ("what is ${c.they} missing?"). People stay to find out whether they spot it before ${c.they} does.`,
        openingShot: `Static shot centered on ${l.frame}, slightly too bright; ${c.ref} walks into frame, unaware.`,
        onScreenText: `Watch ${l.frame}…`,
      },
      shock: {
        hook: `Open on the impossible: ${f(wd.reveal)} — then smash-cut to five seconds earlier.`,
        whyItWorks: 'Starts on the single most impossible image of the video. The brain can\'t scroll past what it can\'t explain, and the rewind promises the explanation.',
        openingShot: `${cap(f(wd.reveal))}, seen from inside ${l.short}.`,
        onScreenText: '5 seconds earlier…',
      },
      emotional: {
        hook: `${R} just wanted to ${f(l.goal)}. The universe had other plans.`,
        whyItWorks: 'Starts with a feeling everyone shares — tired, wanting normal. Viewers project themselves onto the hero before the twist, so the twist lands on them personally.',
        openingShot: `${R} pauses, eyes closed, exhaling after a long day — about to step into ${l.short}.`,
        onScreenText: `POV: you just want to ${f(l.goal)}`,
      },
      visual: {
        hook: `One unbroken shot: ${c.ref} ${f(p.trigger)} — and the world through ${l.frame} flips from ${firstPart(l.palette)} to ${firstPart(wd.palette)}.`,
        whyItWorks: 'One physical action, one instant and enormous visual change. Works with the sound off — which is how most vertical video is first seen.',
        openingShot: `${R} mid-motion as ${c.they} ${f(p.trigger)}, ${l.frame} framed behind ${c.them}.`,
        onScreenText: '',
      },
      story: {
        hook: `Nobody believes what happened to ${c.ref} in ${l.short}. Here's the footage.`,
        whyItWorks: '"Proof" framing turns the video into testimony from a story already in progress — a contract with the viewer: stay to the end and you\'ll see it.',
        openingShot: `Found-footage look: a phone propped up in ${l.short} records ${c.ref} arriving.`,
        onScreenText: 'I finally caught it on camera',
      },
    };
    return out;
  },

  story: {
    beat(x, beat, k, hook, hasEsc) {
      const { p, c, l, wd, f, R } = use(x);
      switch (beat) {
        case 'COLD OPEN':
          return `Flash-forward: ${f(wd.reveal)} — a split-second glimpse, then a rewind to the start.`;
        case 'HOOK':
          return hook.openingShot;
        case 'SETUP':
          return k === 0 ? `${R} ${f(l.enter)}${hasEsc ? '' : ` and ${f(p.trigger)}`}.` : `${R} ${f(l.routine)}. Everything is normal — almost boring.`;
        case 'ESCALATION':
          if (k === 0) return `${R} ${f(p.trigger)}. A beat of silence. Then ${f(wd.omens[0])}.`;
          return k === 1 ? `${cap(f(wd.omens[1]))}. ${R} freezes and looks around.` : `${cap(f(wd.omens[2]))}. ${R} slowly turns toward ${l.frame}.`;
        case 'TURN':
          return k === 0 ? `${cap(f(wd.reveal))}. ${R} is no longer in the normal world — this is ${wd.label}.` : `${cap(f(wd.reaction))}. ${R} doesn't dare to breathe.`;
        case 'PAYOFF':
          return k === 0 ? `${R} squeezes ${c.their} eyes shut — and everything snaps back to normal. Except ${wd.artifact} ${f(l.artifactPlace)}.` : `${R} looks straight into the lens. Off-screen: ${firstPart(wd.sound)}. Cut to black.`;
      }
    },
    emotion: (beat, comedy) => EMOTION[beat][comedy ? 1 : 0],
    pacing: (beat, variant) => (variant && PACING_VARIANT[beat]) || PACING[beat],
    notes: {
      shock: 'The HOOK is a flash-forward of the TURN, so the reveal is shown twice: once as a teaser, once in context.',
      noEsc: '10 seconds cannot hold five beats: ESCALATION is merged into SETUP so the TURN still lands before the midpoint.',
      long: (d) => `At ${d} sec, SETUP and ESCALATION are split into several shots so tension grows in steps instead of one jump.`,
      classic: 'Classic HOOK → SETUP → ESCALATION → TURN → PAYOFF — this idea needs no restructuring.',
    },
    twistAdded: (x) => `Twist added by the engine (the idea had none): ${x.p.world.label}.`,
    heroAdded: (x) => `Main character picked by the engine (not defined in the idea): ${x.p.character.label.toLowerCase()}.`,
    title: (x) => `${x.p.location.label} → ${cap(x.p.world.label)}`,
    summary(x) {
      const { p, c, l, wd, f } = use(x);
      return `${cap(c.ref)} ${f(l.enter)}, then ${f(p.trigger)}. Small things start going wrong — ${f(wd.omens[0])}. Then ${f(wd.reveal)}: ${c.they} is in ${wd.label}. In the end ${c.they} snaps back to normal, but ${wd.artifact} proves it was real.`;
    },
    overview: (h, t, pay) => `Fast hook (0–${h}s) → steady setup → silence before the turn → peak at ${fmtSec(t)}s → short pause and payoff at ${fmtSec(pay)}s.`,
  },

  continuity: {
    base(x) {
      const { c, l, style } = use(x);
      return {
        character: `${c.description}; ${c.appearance}`,
        location: l.environment,
        objects: [...l.objects],
        wardrobe: c.wardrobe,
        lighting: l.lighting,
        time: l.time,
        weather: l.weather,
        cameraStyle: style.cameraStyle,
        visualStyle: style.visualStyle,
        colorPalette: `${l.palette}; grade: ${style.grade}`,
      };
    },
    omenLighting: (base, x) => `${base}, with an unnatural ${firstPart(x.p.world.palette)} tint creeping in`,
    other(x) {
      const { l, wd, style } = use(x);
      return { location: `${wd.environment}, seen from inside ${l.short}, which sits in the middle of it impossibly out of place`, objects: [...l.objects.slice(0, 2), ...wd.objects], lighting: wd.lighting, time: wd.time, weather: wd.weather, colorPalette: `${wd.palette}; grade: ${style.grade}` };
    },
    artifact: (x) => `${x.p.world.artifact} ${fill(x.p.location.artifactPlace, x.p)}`,
  },

  scene,

  stronger: {
    labels: {
      opening: 'First 1–2 seconds',
      curiosity: 'Curiosity gap',
      pacing: 'Pacing',
      conflict: 'Conflict',
      escalation: 'Emotional escalation',
      surprise: 'Visual surprise',
      payoff: 'Payoff',
    },
    why: {
      opening: 'Viewers decide whether to stay in about one second. Showing the most impossible image first buys the attention the slower setup needs, and the rewind promises an explanation.',
      curiosity: 'A statement can be ignored; an unanswered question can\'t. The caption names exactly where to look but withholds what is there — the viewer stays to close the gap.',
      pacing: 'Setup is where viewers leave. Every second taken from the routine and given to the turn and payoff moves the "wow" earlier and lets it breathe longer.',
      conflict: 'Surprise without resistance is a screensaver. When the hero tries to undo it and fails, the viewer starts rooting for them — that turns a visual trick into a story.',
      escalation: 'Viewers feel what the face shows. A reaction that builds in visible steps — with a heartbeat that cuts to silence — makes the reveal hit harder than a single surprised look.',
      surprise: 'A reveal works by withholding the size of the thing, then showing it all at once. Pulling back from the face to the full scale gives the brain a second, bigger "wow".',
      payoff: 'A second twist after the "relief" beat rewards viewers who stayed, and a last frame that loops into the first turns completions into rewatches — the strongest signal for short-video feeds.',
    },
    coldOpen(x) {
      const { wd, f, style } = use(x);
      return {
        purpose: 'Flash-forward: show the impossible image before anything is explained',
        visual: `${cap(f(wd.reveal))} — a 1-second glimpse.`,
        action: `${cap(f(wd.reveal))}. Freeze, then a rewind blur back to the start.`,
        camera: `Extreme close-up on a ${style.lens.close}, locked off, then a reverse whip-blur`,
        sound: `${cap(firstPart(wd.sound))} at full volume, cut by a tape-rewind zip`,
        onScreenText: 'Wait for it…',
      };
    },
    coldImage(x) {
      const { l, wd, f, style } = use(x);
      return { subject: `${cap(f(wd.reveal))}, seen from inside ${l.short}`, composition: `${cap(firstPart(wd.creature))} fills the upper two-thirds; top 15% left clean for text`, lens: style.lens.close };
    },
    coldVideo: { cameraMovement: 'locked off, then a fast reverse whip-blur (rewind effect) in the last 0.3 s', timing: '0–0.7s hold on the impossible image; 0.7–1s rewind blur', transition: 'rewind-blur smash cut into the opening shot', endingFrame: 'motion-blurred frame mid-rewind' },
    openingBefore: (end, visual) => `0–${fmtSec(end)}s: ${visual}`,
    openingAfter: (x) => `0–1s: flash-forward — ${fill(x.p.world.reveal, x.p)}; rewind blur; then the original opening.`,
    caption(x, hook) {
      const { c, l, f } = use(x);
      return hook === 'shock' ? `5 seconds earlier, ${c.they} was just trying to ${f(l.goal)}…` : `${cap(c.they)} has no idea what's on the other side of ${l.frame}`;
    },
    onScreen: (t) => `On-screen text: ${t}`,
    timeline: (scenes) => scenes.map((s) => `${s.beat} ${fmtSec(s.end - s.start)}s`).join(' · '),
    pacingTight: ' (durations already tight; setup now uses speed-ramped match cuts)',
    setupCameraSuffix: '; trimmed to the essential action',
    setupTransition: 'match cut on movement with a slight speed ramp',
    conflict(x) {
      const { p, c, l, wd, f, R } = use(x);
      return { extra: p.conflict ? `${cap(firstPart(wd.creature))} notices ${c.them} — the threat is now personal.` : `${R} tries to get out — ${f(l.obstacle)}.`, purpose: 'Conflict: the hero fights back and loses — stakes' };
    },
    conflictPhysical: (x) => (x.p.conflict ? `${x.p.character.their} hand slowly moves to the lock` : `${x.p.character.their} hand yanks the handle again and again; it doesn't give`),
    escalationSteps: ['a small frown, eyes flick to the detail and back', 'brows pull together, breath turns shallow, a nervous swallow', 'jaw tightens, nostrils flare, eyes dart between the glass and the door'],
    heartbeat: '; a heartbeat creeps in under the ambience, getting faster',
    turnFacial: 'three clear steps: a squint, a frozen stare, then full wide-eyed disbelief; breath catches, lips part',
    turnSound: (x) => `Half a second of total silence before the reveal, then ${x.p.world.sound}; the heartbeat stops`,
    turnReaction: (t) => `Turn reaction: ${t}`,
    surpriseCamera(x) {
      const { c, l, wd } = use(x);
      return `Start tight on ${c.their} face for half a second, then a fast pull-back out through ${l.frame} revealing the full scale: ${firstPart(wd.creature)} dwarfs ${l.short}`;
    },
    surpriseSpec(x) {
      const { l, wd } = use(x);
      const creature = firstPart(wd.creature);
      return {
        composition: `scale contrast: ${l.short} small in the lower third, ${creature} towering over it and filling the upper two-thirds`,
        cameraAngle: 'low angle from outside, looking up past the glass',
        cameraMovement: `0.5 s tight on the face, then a fast pull-back out through ${l.frame} to a wide shot that reveals the full scale`,
      };
    },
    payoffAction: (x) => `Final beat: ${x.p.character.ref} slowly looks up — the same ${firstPart(x.p.world.sound)} sounds again, right outside. Cut to black on the sound; the last frame matches the first so the video loops.`,
    payoffEndingFrame: 'identical framing and pose to the very first frame of the reel, for a seamless loop',
    payoffText: 'Wait… it was real?',
    storyPacing: (cold, t) => `${cold ? '1-second flash-forward → ' : ''}fast hook → compressed setup → heartbeat build → peak at ${fmtSec(t)}s → payoff with a second twist and a loop.`,
    message: 'Every strength check already passes — no further structural improvements found. Try another hook or a longer duration.',
  },
};
