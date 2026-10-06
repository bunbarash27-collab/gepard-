// Russian language pack. Written for natural spoken Russian rather than translated phrase by phrase.
// Hero actions are in the present tense, so they agree with any gender; pronouns come from the character's `g`.
import { CHARACTERS_RU, LOCATIONS_RU, STYLES_RU, WORLDS_RU } from '../lexicon.ru';
import { TRIGGERS } from '../lexicon';
import type { ParsedIdea } from '../parser';
import type { BeatName, HookType } from '../types';
import { capitalize as cap, fmtSec } from '../util';
import { BEAT_LABELS } from '../i18n';
import { firstPart, noDot, timingWith } from './common';
import type { Core, Ctx, HookText, SceneArgs, Texts } from './types';

const NONE_TEXT = '— (нет)';
const NONE_VO = '— (без закадрового голоса)';
export const secRu = (n: number) => fmtSec(n).replace('.', ',');
const timing = timingWith(secRu, ' с');

function use(x: Ctx) {
  const { p } = x;
  const c = CHARACTERS_RU[p.character.key] ?? CHARACTERS_RU.person;
  const l = LOCATIONS_RU[p.location.key] ?? LOCATIONS_RU.home;
  const w = WORLDS_RU[p.world.key] ?? WORLDS_RU.dinosaurs;
  const s = STYLES_RU[x.style];
  const pr = c.g === 'f' ? { она: 'она', её: 'её', ей: 'ей', нём: 'ней', ним: 'ней' } : { она: 'он', её: 'его', ей: 'ему', нём: 'нём', ним: 'ним' };
  const f = (t: string) =>
    t.replace(/\{frame\.(nom|gen|acc|ins)\}/g, (_, k: 'nom' | 'gen' | 'acc' | 'ins') => l.frame[k]).replace(/\{(она|её|ей|нём|ним)\}/g, (_, k: keyof typeof pr) => pr[k]);
  const g = (fem: string, masc: string) => (c.g === 'f' ? fem : masc);
  const trigger = p.triggerIdx >= 0 ? TRIGGERS[p.triggerIdx].ru : l.trigger;
  return { p, c, l, w, s, pr, f, g, R: cap(c.ref), trigger, creature: w.creature, reveal: f(w.reveal), sound0: firstPart(w.sound) };
}

const EMOTION: Record<BeatName, [string, string]> = {
  'COLD OPEN': ['Шок — «что я вижу?»', 'Шок — «стоп, что?»'],
  HOOK: ['Любопытство', 'Любопытство'],
  SETUP: ['Узнавание — «это же я»', 'Узнавание — «это же прямо я»'],
  ESCALATION: ['Тревога — что-то не так', 'Подозрение — что-то совсем не так'],
  TURN: ['Восторг и страх', 'Абсурдное неверие'],
  PAYOFF: ['Облегчение, затем восторг', 'Смех и разрядка'],
};

const PACING: Record<BeatName, string> = {
  'COLD OPEN': 'Быстро: меньше секунды — проблеск, а не объяснение.',
  HOOK: 'Быстро: первый кадр уже в движении, текст на экране с первого кадра, жёсткая склейка.',
  SETUP: 'Ровно: 2–3 коротких плана, естественный ритм, пока без музыки.',
  ESCALATION: 'Пауза: держим мелкие детали, фоновый звук стихает — тишина нагнетает напряжение.',
  TURN: 'Пик: самый мощный образ и самый громкий звук, самый длинный план ролика.',
  PAYOFF: 'Короткая пауза, затем финальный бит: секунда на доказательство перед склейкой.',
};
const PACING_VARIANT: Partial<Record<BeatName, string>> = {
  ESCALATION: 'Ускорение: каждый план короче предыдущего, звук постепенно нарастает.',
  TURN: 'Держим: даём зрителю рассмотреть новый мир — без склеек весь бит.',
  PAYOFF: 'Щелчок: один невозмутимый бит, затем жёсткая склейка в чёрное.',
};

const SHALLOW = 'малая, около f/2 — фон уходит в мягкое кремовое боке';
const CAPTION_SAFE = 'верхние 15% кадра оставлены свободными под текст';

function scene(x: Ctx, a: SceneArgs): Core {
  const { c, l, w, s, f, g, R, trigger, creature, reveal, sound0, pr } = use(x);
  const { beat, k, hook, cont, isLast, hasEsc } = a;
  const dur = beat.end - beat.start;
  const L = s.lens;
  const she = pr.она;

  if (beat.beat === 'HOOK') {
    const shock = hook.type === 'shock';
    const subject = {
      curiosity: `в центре кадра — ${l.frame.nom}, свет там чуть ярче, чем должен быть; на заднем плане приближается ${c.ref}`,
      shock: `${cap(reveal)}; вид изнутри ${l.short.gen}`,
      emotional: `${R} замирает с закрытыми глазами и устало выдыхает после долгого дня; впереди — ${l.short.nom}`,
      visual: `${R} в момент, когда ${she} ${trigger}; позади — ${l.frame.nom}`,
      story: `вид с телефона, оставленного ${l.short.in}, как на найденной записи: появляется ${c.ref}`,
    }[hook.type];
    return {
      purpose: { curiosity: 'Открыть вопрос, на который зритель захочет получить ответ', shock: 'Остановить скролл самым невозможным кадром', emotional: 'За одну секунду дать зрителю почувствовать усталость героя', visual: 'Зацепить одним физическим действием и мгновенной визуальной переменой', story: 'Подать ролик как доказательство того, что уже случилось' }[hook.type],
      visual: hook.openingShot,
      action: shock ? `${cap(reveal)}. Стоп-кадр, затем размытая перемотка назад.` : hook.type === 'visual' ? `${R} ${trigger}; свет за ${l.frame.ins} меняется за один кадр.` : `${R} подходит ближе, не подозревая, что сейчас случится.`,
      camera: shock ? `Сверхкрупный план, ${L.close}, статика, затем быстрая размытая перемотка` : hook.type === 'visual' ? `Один непрерывный план, ${L.wide}, на уровне глаз, медленный наезд` : `${cap(s.move)} к лицу, ${L.medium}, на уровне глаз`,
      lighting: cont.lighting,
      sound: shock ? `${cap(sound0)} на полной громкости, обрывается звуком перемотки плёнки` : `${cap(s.sound)}; один резкий удар на первом кадре`,
      onScreenText: hook.onScreenText || '— (без текста: хук держится на картинке)',
      voiceover: hook.type === 'emotional' || hook.type === 'story' ? hook.hook : NONE_VO,
      image: {
        subject,
        composition: `${shock ? `верхние две трети кадра занимает ${creature}, по краям — рамка ${l.frame.gen}` : `${R} в нижней средней трети, глаза на верхней линии третей, позади — ${l.frame.nom}`}; ${CAPTION_SAFE}`,
        cameraAngle: shock ? 'на уровне глаз, прямо через стекло' : 'на уровне глаз, лёгкий ракурс три четверти',
        lens: shock ? L.close : hook.type === 'visual' ? L.wide : L.medium,
        depthOfField: SHALLOW,
        materials: shock ? w.materials : l.materials,
        textures: shock ? w.textures : l.textures,
        atmosphere: shock ? w.atmosphere : 'обыденная, тихая, слишком спокойная',
      },
      video: {
        subjectMovement: shock ? `${cap(creature)} переносит вес и один раз моргает` : hook.type === 'visual' ? `${R} ${trigger}` : `${R} устало идёт вперёд, опустив глаза`,
        cameraMovement: shock ? 'статика, затем в последние 0,3 с быстрая размытая перемотка (эффект обратной перемотки)' : `${s.move} к лицу, к концу кадр примерно на 15% плотнее`,
        objectMovement: shock ? 'по стеклу плывёт туман' : `${l.objects[1]} — без движения; больше ничего не шевелится`,
        facialMovement: shock ? 'зрачок сужается, фокусируясь на объективе' : 'усталое моргание, короткий выдох через нос, плечи опускаются',
        environmentMovement: shock ? `${firstPart(w.weather)}; листва и частицы медленно дрейфуют` : 'фон неестественно неподвижен',
        physicalInteraction: shock ? 'тёплое дыхание затуманивает стекло снаружи' : `${cap(pr.её)} рука спокойно лежит; рядом — ${l.objects[0]}`,
        timing: shock ? timing(dur, 'держим невозможный кадр', 'размытая перемотка') : timing(dur, 'герой в движении', 'наезд, пока появляется текст'),
        transition: shock ? 'склейка через размытую перемотку' : 'жёсткая склейка в бит',
        endingFrame: shock ? 'смазанный кадр в середине перемотки' : `лицо ${c.refGen} плотным средним планом, позади — ${l.frame.nom}`,
      },
    };
  }

  if (beat.beat === 'SETUP') {
    const first = k === 0;
    const withTrigger = first && !hasEsc;
    return {
      purpose: first ? 'Показать героя и обычный мир' : 'Сделать рутину настоящей, чтобы слом ощущался сильнее',
      visual: first ? `${R} ${f(l.enter)}. ${cap(l.environment)}.` : `Крупные детали рутины: ${l.objects[0]}, ${l.objects[1]}.`,
      action: first ? `${R} ${f(l.enter)}${withTrigger ? `, затем ${trigger}` : ''}.` : `${R} ${f(l.routine)}.`,
      camera: first ? `Средне-общий план, ${L.wide}, на уровне глаз; ${s.move} вслед за ${pr.ним}` : `Врезки крупным планом, ${L.close}: руки, предметы, взгляд`,
      lighting: cont.lighting,
      sound: `Естественный звуковой фон (${l.short.in}); ${first ? 'шаги, шорох одежды' : 'мелкие шумы: щелчки, ткань, дыхание'}; без музыки`,
      onScreenText: NONE_TEXT,
      voiceover: NONE_VO,
      image: {
        subject: first ? `${R} ${f(l.enter)}` : `крупный план рук: ${she} ${f(l.routine)}`,
        composition: first ? `${R} в левой трети, глубина пространства ведёт взгляд вправо` : `руки и деталь (${l.objects[0]}) заполняют кадр, лицо мягко размыто на фоне`,
        cameraAngle: first ? 'на уровне глаз, чуть шире обычного' : 'лёгкий ракурс сверху',
        lens: first ? L.wide : L.close,
        depthOfField: first ? 'средняя, около f/4 — всё пространство читается' : SHALLOW,
        materials: l.materials,
        textures: l.textures,
        atmosphere: 'будничная, знакомая, тихая',
      },
      video: {
        subjectMovement: first ? `${R} ${f(l.enter)}${withTrigger ? `, затем ${trigger}` : ''}` : `${R} ${f(l.routine)}`,
        cameraMovement: first ? `${s.move}, камера следует за героем и останавливается` : 'статичная врезка с едва заметным дрейфом',
        objectMovement: first ? 'брошенная сумка падает и оседает' : `${l.objects[1]} слегка подрагивает`,
        facialMovement: 'нейтральное, уставшее, слегка рассеянное выражение',
        environmentMovement: 'обычная фоновая жизнь, ничего необычного',
        physicalInteraction: first ? 'тело расслабленно оседает на месте' : `пальцы касаются детали: ${l.objects[0]}`,
        timing: timing(dur, first ? 'вход' : 'рутинное действие', first ? 'устраивается на месте' : 'держим деталь'),
        transition: withTrigger ? 'звук триггера обрывается в мёртвую тишину — сразу к повороту' : 'склейка по движению',
        endingFrame: withTrigger ? `${R} замирает, позади — ${l.frame.nom}` : `${R} уже ${l.short.in}, спокойный кадр`,
      },
    };
  }

  if (beat.beat === 'ESCALATION') {
    const omen = f(w.omens[Math.min(k, 2)]);
    return {
      purpose: k === 0 ? 'Триггер: действие, которое ломает реальность, и первый знак' : 'Нарастание: знаки уже невозможно игнорировать',
      visual: k === 0 ? `${R} ${trigger}. Тишина. ${cap(omen)}.` : `${cap(omen)}.`,
      action: k === 0 ? `${R} ${trigger} и замечает: ${omen}. Хмурится, отмахивается.` : `${R} замирает, потом медленно оглядывается.`,
      camera: k === 0 ? `Врезка на деталь, ${L.close}, перевод фокуса на лицо` : `Медленный наезд на лицо, ${L.medium}`,
      lighting: cont.lighting,
      sound: k === 0 ? 'Звук триггера, затем весь фон пропадает — низкий, едва слышный гул' : `${cap(sound0)} — тихо, но всё ближе`,
      onScreenText: NONE_TEXT,
      voiceover: NONE_VO,
      image: {
        subject: k === 0 ? `${R} ${l.short.in} в момент, когда ${omen}` : `лицо ${c.refGen} застыло на полувзгляде, пока ${omen}`,
        composition: `деталь-знак резко на переднем плане, лицо ${c.refGen} мягко размыто за ней`,
        cameraAngle: 'на уровне глаз, плотно',
        lens: L.close,
        depthOfField: `${SHALLOW}; фокус на детали`,
        materials: l.materials,
        textures: l.textures,
        atmosphere: 'тихое напряжение, что-то не так',
      },
      video: {
        subjectMovement: k === 0 ? `${R} ${trigger} и замирает` : `${R} медленно поворачивает голову`,
        cameraMovement: k === 0 ? 'статичная врезка, затем перевод фокуса с детали на лицо' : 'очень медленный наезд',
        objectMovement: omen,
        facialMovement: k === 0 ? 'лёгкая хмурость, взгляд метнулся к детали и обратно' : 'глаза расширяются, дыхание задержано',
        environmentMovement: `свет смещается в сторону оттенка: ${firstPart(w.palette)}`,
        physicalInteraction: k === 0 ? 'рука всё ещё на ручке' : 'пальцы сжимаются',
        timing: timing(dur, 'триггер', 'тишина', omen),
        transition: 'пауза, затем резкая склейка на басовом ударе',
        endingFrame: `${R} смотрит в сторону: ${l.frame.nom}; лицо в профиль`,
      },
    };
  }

  if (beat.beat === 'TURN') {
    const reaction = f(w.reaction);
    return {
      purpose: k === 0 ? 'Поворот: показать невозможный мир' : 'Дать зрителю рассмотреть новый мир',
      visual: k === 0 ? `${cap(reveal)}. ${cap(w.environment)}.` : `${cap(reaction)}.`,
      action: k === 0 ? `${R} медленно оборачивается и видит это. Не двигается.` : `${R} вжимается в спинку, почти не дыша.`,
      camera: k === 0 ? `Через плечо, ${L.wide}, сквозь ${l.frame.acc}, медленный наезд` : `Двухплановый кадр, ${L.medium}: ${c.ref} на переднем плане, ${creature} за стеклом`,
      lighting: cont.lighting,
      sound: `${cap(w.sound)}; глубокое нарастание музыки${k === 0 ? ', пик на появлении' : ''}`,
      onScreenText: k === 0 ? '— (нет: картинка говорит сама)' : NONE_TEXT,
      voiceover: NONE_VO,
      image: {
        subject: k === 0 ? `вид через плечо изнутри ${l.short.gen}: ${reveal}` : `${R} не шевелится ${l.short.in}, пока ${reaction}`,
        composition: `плечо и силуэт головы ${c.refGen} в левом нижнем углу на переднем плане, ${creature} доминирует в кадре за ${l.frame.ins}`,
        cameraAngle: 'через плечо, чуть снизу, чтобы подчеркнуть масштаб',
        lens: k === 0 ? L.wide : L.medium,
        depthOfField: 'большая, около f/5.6 — резкие и герой, и мир',
        materials: `${l.materials}; снаружи: ${w.materials}`,
        textures: w.textures,
        atmosphere: w.atmosphere,
      },
      video: {
        subjectMovement: k === 0 ? `${R} медленно поворачивает голову и замирает` : `${R} откидывается назад и поднимает руки`,
        cameraMovement: k === 0 ? 'медленный наезд через плечо к стеклу' : 'статика — без движения, даём кадру подышать',
        objectMovement: k === 0 ? `${creature} приближается и заполняет весь обзор` : reaction,
        facialMovement: k === 0 ? 'рот чуть приоткрыт, зрачки расширены, полная неподвижность' : 'короткий дрожащий выдох, взгляд прикован к стеклу',
        environmentMovement: `${firstPart(w.weather)}; на фоне движутся ${w.objects[1]} и ${w.objects[2]}`,
        physicalInteraction: k === 0 ? 'стекло вибрирует от каждого движения снаружи' : reaction,
        timing: timing(dur, 'медленный поворот головы', 'образ заполняет стекло', 'держим полную картину'),
        transition: isLast ? 'склейка в чёрное' : 'жёсткая склейка в чёрное на 2 кадра',
        endingFrame: `${creature} заполняет весь вид за ${l.frame.ins}; ${c.ref} — крошечная фигура на переднем плане`,
      },
    };
  }

  // PAYOFF
  const proof = `${f(l.artifactPlace)} лежит ${w.artifact}`;
  return {
    purpose: k === 0 ? 'Развязка: всё как было — но с доказательством' : 'Финальный штрих: последний бит, ради которого пересматривают',
    visual: k === 0 ? `${R} снова ${l.short.in}, будто ничего не было. ${cap(proof)}.` : `${R} смотрит прямо в камеру.`,
    action: k === 0 ? `${R} зажмуривается, открывает глаза — всё как обычно. И тут замечает: ${proof}.` : `${R} смотрит в объектив; за кадром — ${sound0}.`,
    camera: k === 0 ? `Средний план, ${L.medium}, затем наклон камеры вниз к доказательству` : `Статичный крупный план, ${L.close}, по центру`,
    lighting: cont.lighting,
    sound: k === 0 ? 'Резко возвращается обычный фон; мягкий музыкальный акцент на доказательстве' : `Тишина, затем за кадром — ${sound0}`,
    onScreenText: k === 0 && !isLast ? NONE_TEXT : 'Стоп… это было по-настоящему?',
    voiceover: NONE_VO,
    image: {
      subject: k === 0 ? `${R} ${l.short.in} смотрит вниз: ${proof}` : `${R} смотрит прямо в объектив с невозмутимым лицом`,
      composition: k === 0 ? `лицо ${c.refGen} в верхней трети, находка (${w.artifact}) резко в нижней трети` : `центрированный симметричный крупный план; ${CAPTION_SAFE}`,
      cameraAngle: k === 0 ? 'на уровне глаз с наклоном вниз' : 'на уровне глаз, прямо',
      lens: k === 0 ? L.medium : L.close,
      depthOfField: SHALLOW,
      materials: l.materials,
      textures: `${l.textures}; ${firstPart(w.textures)}`,
      atmosphere: 'облегчение, затем тихое неверие',
    },
    video: {
      subjectMovement: k === 0 ? `${R} открывает глаза, выдыхает и замирает, глядя вниз` : `${R} медленно поворачивается к объективу`,
      cameraMovement: k === 0 ? 'статика, затем медленный наклон вниз к доказательству' : 'статика',
      objectMovement: k === 0 ? `${cap(w.artifact)} лежит неподвижно` : 'ничего не движется',
      facialMovement: k === 0 ? 'облегчение, полуулыбка, затем улыбка гаснет' : 'невозмутимый взгляд, одна бровь приподнята',
      environmentMovement: 'всё снова как обычно',
      physicalInteraction: k === 0 ? 'кончики пальцев касаются находки' : 'нет',
      timing: timing(dur, 'глаза открываются, облегчение', 'наклон к доказательству', 'держим доказательство'),
      transition: isLast ? 'жёсткая склейка в чёрное на звуке' : 'склейка по взгляду',
      endingFrame: isLast ? 'герой в той же композиции, что и в первом кадре, поэтому ролик естественно зацикливается' : `лицо ${c.refGen} крупно: момент раздумья`,
    },
  };
}

function improveIdea(p: ParsedIdea): string {
  const base = noDot(p.raw);
  const w = WORLDS_RU[p.world.key] ?? WORLDS_RU.dinosaurs;
  const lower = base.charAt(0).toLowerCase() + base.slice(1);
  let s = p.characterFound ? cap(base) : `${cap(CHARACTERS_RU.person.ref)}, девушка лет 28: ${lower}`;
  if (!p.twist) s += `, но в следующую секунду вокруг уже ${w.name}`;
  if (!p.conflict) s += '. Попытка вернуться назад проваливается — путь обратно исчез';
  return `${s}. В конце всё возвращается на место, но остаётся ${w.artifact} — доказательство, что это было на самом деле.`;
}

const heroLabel = (label: string) => label.split(' (')[0].toLowerCase();

export const ru: Texts = {
  lang: 'ru',
  none: { text: NONE_TEXT, vo: NONE_VO },
  improveIdea,

  analysis(x) {
    const { p, c, l, w, f, R, trigger, reveal, pr } = use(x);
    return {
      concept: p.twist
        ? `Ролик о сломе реальности. ${R} ${f(l.enter)} — совершенно обычная ситуация. Затем ${pr.она} ${trigger} — и ${p.worldFound ? `внезапно оказывается ${w.in}` : `случается поворот: «${p.twistClause}»`}. Всё видео держится на контрасте обыденного и невозможного.`
        : `Бытовая зарисовка: «${p.raw}». В таком виде поворота нет — зритель смотрит на рутину, и ничто её не нарушает.`,
      mainCharacter: `${c.label} — ${c.description}: ${c.appearance}; одежда: ${c.wardrobe}.${p.characterFound ? '' : ' В идее герой не указан, движок выбрал его по умолчанию — замените на кого-то конкретного.'}`,
      goal: p.conflict
        ? `Из идеи: «${p.conflictClause}».`
        : `${R} хочет ${l.goal}. Маленькая и понятная цель — у каждого зрителя был ровно такой момент.${p.twist ? ' После поворота цель меняется: вернуться к нормальной жизни.' : ''}`,
      conflict: p.conflict
        ? `Из идеи: «${p.conflictClause}».`
        : `Отсутствует — ${pr.ей} ничего не мешает. Предложение: ${f(l.obstacle)}; ${c.ref} хочет выбраться — и не может.`,
      surprise: p.worldFound
        ? `За ${l.frame.ins} — уже не привычная обстановка, а ${w.name}. Ключевой образ: ${reveal}.`
        : p.twistClause
          ? `«${p.twistClause}» — поворот есть, но у него пока нет конкретного образа.`
          : `В идее неожиданности нет. Предложение: за ${l.frame.ins} внезапно открывается ${w.name}.`,
      emotionalDirection: x.style === 'comedy'
        ? 'Узнавание («это же я») → растерянность → абсурдное нарастание → смех и разрядка.'
        : 'Спокойное узнавание → нарастающая тревога → восторг и страх в момент поворота → облегчение с подмигиванием в финале.',
      payoff: `${R} снова ${l.short.in}, будто ничего не было, — но ${f(l.artifactPlace)} лежит ${w.artifact}. Это было по-настоящему. Последний кадр повторяет первый, поэтому ролик зацикливается.`,
    };
  },

  strength(code, x) {
    const { p, c, l, w } = use(x);
    return {
      hero: `Понятный герой (${heroLabel(c.label)}) — зритель с первого кадра знает, за кем следить.`,
      location: `Конкретное знакомое место (${l.label.toLowerCase()}) — узнаётся мгновенно и читается с одного кадра.`,
      surprise: `Сильная визуальная неожиданность (${w.name}) — один образ, понятный даже без звука.`,
      twist: 'В идее есть поворот.',
      conflict: `Встроенный конфликт: «${p.conflictClause}».`,
    }[code];
  },

  weakness(code, x) {
    const { l, w, f, R, pr } = use(x);
    return {
      noHero: 'Нет конкретного героя. Определённый человек (возраст, внешность, настроение) делает первый кадр понятным меньше чем за секунду — движку пришлось выбрать героя по умолчанию.',
      noLocation: 'Нет конкретного места. Знакомая обстановка (машина, лифт, кухня) сразу задаёт зрителю ощущение «всё как обычно», которое поворот может разрушить.',
      noSurprise: `Нет неожиданности. Ничего непредсказуемого не происходит, поэтому после третьей секунды смотреть дальше незачем. Добавьте поворот, которого зритель не ждёт, — например, ${w.name}.`,
      notVisual: 'Поворот пока не визуальный. Назовите один конкретный образ, который зритель запомнит и перескажет друзьям.',
      noConflict: `Нет конфликта. ${R} ничего не добивается и ни во что не упирается, поэтому ставок нет: неожиданность происходит с героем, но сам герой ничего не делает. Дайте ${pr.ей} препятствие: ${f(l.obstacle)}.`,
      noEmotion: 'Нет эмоциональной цели. Решите, что зритель должен почувствовать в конце (смех, мурашки, восторг), — под это строится развязка.',
      tooShort: 'Слишком коротко для истории — это звучит как тема, а не как ситуация.',
    }[code];
  },

  hooks(x) {
    const { c, l, w, g, R, trigger, reveal, pr } = use(x);
    const out: Record<HookType, HookText> = {
      curiosity: {
        hook: `Следите за ${l.frame.ins}. ${R} пока ничего не замечает.`,
        whyItWorks: `Даёт зрителю задачу («следи») и информационный разрыв («что ${pr.она} упускает?»). Зритель остаётся, чтобы проверить, заметит ли он это раньше героя.`,
        openingShot: `Статичный кадр с ${l.frame.ins} в центре; свет там чуть ярче, чем должен быть. ${R} входит в кадр, ничего не подозревая.`,
        onScreenText: `Смотри на ${l.frame.acc}…`,
      },
      shock: {
        hook: `Начать с невозможного: ${reveal} — и резкая склейка на пять секунд назад.`,
        whyItWorks: 'Ролик начинается с самого невозможного кадра. Мозг не может пролистать то, что не может объяснить, а перемотка назад обещает объяснение.',
        openingShot: `${cap(reveal)}; вид изнутри ${l.short.gen}.`,
        onScreenText: '5 секунд назад…',
      },
      emotional: {
        hook: `${cap(pr.она)} просто ${g('хотела', 'хотел')} ${l.goal}. Но у вселенной были другие планы.`,
        whyItWorks: 'Начинается с чувства, знакомого всем: усталость и желание, чтобы всё было как обычно. Зритель примеряет на себя роль героя ещё до поворота, поэтому поворот бьёт лично по нему.',
        openingShot: `${R} замирает с закрытыми глазами и устало выдыхает после долгого дня — впереди ${l.short.nom}.`,
        onScreenText: `POV: ты просто хочешь ${l.goal}`,
      },
      visual: {
        hook: `Один непрерывный кадр: ${c.ref} ${trigger} — и в ту же секунду за ${l.frame.ins} вместо привычной картинки уже ${w.name}.`,
        whyItWorks: 'Одно физическое действие — и мгновенная огромная перемена. Работает без звука, а именно так вертикальные видео чаще всего смотрят впервые.',
        openingShot: `${R} ${trigger}; ${l.frame.nom} — прямо за ${pr.ним}.`,
        onScreenText: '',
      },
      story: {
        hook: `Мне никто не верит, но это правда случилось ${l.short.in}. Вот запись.`,
        whyItWorks: 'Подача «вот доказательство» превращает ролик в свидетельство уже начавшейся истории. Это договор со зрителем: досмотри — и увидишь сам.',
        openingShot: `Как будто найденная запись: телефон, оставленный ${l.short.in}, снимает, как приходит ${c.ref}.`,
        onScreenText: `Я наконец-то ${g('сняла', 'снял')} это на видео`,
      },
    };
    return out;
  },

  story: {
    beat(x, beat, k, hook, hasEsc) {
      const { l, w, f, R, trigger, reveal, sound0 } = use(x);
      switch (beat) {
        case 'COLD OPEN':
          return `Флешфорвард: ${reveal} — мгновенный проблеск, затем перемотка к началу.`;
        case 'HOOK':
          return hook.openingShot;
        case 'SETUP':
          return k === 0 ? `${R} ${f(l.enter)}${hasEsc ? '' : `, а затем ${trigger}`}.` : `${R} ${f(l.routine)}. Всё как обычно — даже скучно.`;
        case 'ESCALATION':
          if (k === 0) return `${R} ${trigger}. Секунда тишины. И вдруг ${f(w.omens[0])}.`;
          return k === 1 ? `${cap(f(w.omens[1]))}. ${R} замирает и оглядывается.` : `${cap(f(w.omens[2]))}. ${R} медленно оборачивается и смотрит на ${l.frame.acc}.`;
        case 'TURN':
          return k === 0 ? `${cap(reveal)}. Это больше не обычный мир — это ${w.name}.` : `${cap(f(w.reaction))}. ${R} боится даже вдохнуть.`;
        case 'PAYOFF':
          return k === 0 ? `${R} крепко зажмуривается — и всё возвращается на свои места. Кроме одного: ${f(l.artifactPlace)} лежит ${w.artifact}.` : `${R} смотрит прямо в камеру. За кадром — ${sound0}. Затемнение.`;
      }
    },
    emotion: (beat, comedy) => EMOTION[beat][comedy ? 1 : 0],
    pacing: (beat, variant) => (variant && PACING_VARIANT[beat]) || PACING[beat],
    notes: {
      shock: 'ХУК — это флешфорвард ПОВОРОТА, поэтому главный образ показан дважды: сначала как тизер, затем в контексте.',
      noEsc: '10 секунд не вмещают пять битов: РАЗВИТИЕ объединено с ЗАВЯЗКОЙ, чтобы ПОВОРОТ успел случиться до середины.',
      long: (d) => `При ${d} сек ЗАВЯЗКА и РАЗВИТИЕ разбиты на несколько планов, чтобы напряжение росло ступенями, а не одним скачком.`,
      classic: 'Классическая схема ХУК → ЗАВЯЗКА → РАЗВИТИЕ → ПОВОРОТ → РАЗВЯЗКА — этой идее перестройка не нужна.',
    },
    twistAdded: (x) => `Поворот добавлен движком (в идее его не было): ${use(x).w.name}.`,
    heroAdded: (x) => `Главный герой выбран движком (в идее не указан): ${heroLabel(use(x).c.label)}.`,
    title: (x) => `${use(x).l.label} → ${cap(use(x).w.name)}`,
    summary(x) {
      const { l, w, f, R, trigger, reveal, pr } = use(x);
      return `${R} ${f(l.enter)}, затем ${trigger}. Начинаются странности: ${f(w.omens[0])}. Потом ${reveal} — и ${pr.она} уже ${w.in}. В конце всё возвращается на свои места, но ${w.artifact} доказывает, что это было на самом деле.`;
    },
    overview: (h, t, pay) => `Быстрый хук (0–${secRu(h)} с) → ровная завязка → тишина перед поворотом → пик на ${secRu(t)} с → короткая пауза и развязка с ${secRu(pay)} с.`,
  },

  continuity: {
    base(x) {
      const { c, l, s } = use(x);
      return {
        character: `${c.description}; ${c.appearance}`,
        location: l.environment,
        objects: [...l.objects],
        wardrobe: c.wardrobe,
        lighting: l.lighting,
        time: l.time,
        weather: l.weather,
        cameraStyle: s.cameraStyle,
        visualStyle: s.visualStyle,
        colorPalette: `${l.palette}; цветокоррекция: ${s.grade}`,
      };
    },
    omenLighting: (base, x) => `${base}; постепенно проступает неестественный оттенок (${firstPart(use(x).w.palette)})`,
    other(x) {
      const { l, w, s } = use(x);
      return { location: `${w.environment}; всё это видно изнутри ${l.short.gen} — как будто кусок обычного мира перенесли сюда`, objects: [...l.objects.slice(0, 2), ...w.objects], lighting: w.lighting, time: w.time, weather: w.weather, colorPalette: `${w.palette}; цветокоррекция: ${s.grade}` };
    },
    artifact: (x) => {
      const { l, w, f } = use(x);
      return `${w.artifact} ${f(l.artifactPlace)}`;
    },
  },

  scene,

  stronger: {
    labels: {
      opening: 'Хук',
      curiosity: 'Разрыв любопытства',
      pacing: 'Темп',
      conflict: 'Конфликт',
      escalation: 'Эмоциональное усиление',
      surprise: 'Визуальная неожиданность',
      payoff: 'Развязка',
    },
    why: {
      opening: 'Зритель решает, остаться ли, примерно за секунду. Самый невозможный кадр в начале покупает внимание, которое нужно более спокойной завязке, а перемотка обещает объяснение.',
      curiosity: 'Утверждение можно пропустить, а вопрос без ответа — нет. Подпись говорит, куда смотреть, но не говорит, что там, — и зритель остаётся, чтобы закрыть этот разрыв.',
      pacing: 'На завязке зрители уходят чаще всего. Каждая секунда, отнятая у рутины и отданная повороту и развязке, приближает «вау» и даёт ему прозвучать дольше.',
      conflict: 'Неожиданность без сопротивления — это заставка. Когда герой пытается всё исправить и проигрывает, зритель начинает за него болеть — и визуальный трюк превращается в историю.',
      escalation: 'Зритель чувствует то, что показывает лицо. Реакция, которая нарастает заметными ступенями, и сердцебиение, обрывающееся в тишину, бьют сильнее одного удивлённого взгляда.',
      surprise: 'Появление работает, когда размер скрыт, а потом показан целиком. Отъезд от лица к полному масштабу даёт мозгу второе, ещё большее «вау».',
      payoff: 'Второй поворот после «облегчения» награждает тех, кто досмотрел, а последний кадр, переходящий в первый, превращает досмотры в пересмотры — самый сильный сигнал для ленты коротких видео.',
    },
    coldOpen(x) {
      const { s, reveal, sound0 } = use(x);
      return {
        purpose: 'Флешфорвард: показать невозможный кадр до всяких объяснений',
        visual: `${cap(reveal)} — проблеск на 1 секунду.`,
        action: `${cap(reveal)}. Стоп-кадр, затем размытая перемотка к началу.`,
        camera: `Сверхкрупный план, ${s.lens.close}, статика, затем хлёсткая размытая перемотка`,
        sound: `${cap(sound0)} на полной громкости, обрывается звуком перемотки плёнки`,
        onScreenText: 'Досмотри до конца…',
      };
    },
    coldImage(x) {
      const { l, s, reveal, creature } = use(x);
      return { subject: `${cap(reveal)}; вид изнутри ${l.short.gen}`, composition: `верхние две трети кадра занимает ${creature}; ${CAPTION_SAFE}`, lens: s.lens.close };
    },
    coldVideo: { cameraMovement: 'статика, затем в последние 0,3 с быстрая хлёсткая размытая перемотка (эффект обратной перемотки)', timing: '0–0,7 с держим невозможный кадр; 0,7–1 с размытая перемотка', transition: 'склейка через размытую перемотку в начальный кадр', endingFrame: 'смазанный кадр в середине перемотки' },
    openingBefore: (end, visual) => `0–${secRu(end)} с: ${visual}`,
    openingAfter: (x) => `0–1 с: флешфорвард — ${use(x).reveal}; размытая перемотка; затем исходное начало.`,
    caption(x, hook) {
      const { l, g, pr } = use(x);
      return hook === 'shock' ? `5 секунд назад ${pr.она} просто ${g('хотела', 'хотел')} ${l.goal}…` : `${cap(pr.она)} ещё не знает, что ждёт по ту сторону ${l.frame.gen}`;
    },
    onScreen: (t) => `Текст на экране: ${t}`,
    timeline: (scenes) => scenes.map((s) => `${BEAT_LABELS.ru[s.beat]} ${secRu(s.end - s.start)} с`).join(' · '),
    pacingTight: ' (длительности уже плотные; в завязке теперь склейки по движению с ускорением)',
    setupCameraSuffix: '; сокращено до главного действия',
    setupTransition: 'склейка по движению с лёгким ускорением',
    conflict(x) {
      const { p, l, f, R, creature, pr } = use(x);
      return { extra: p.conflict ? `${cap(creature)} замечает ${pr.её} — теперь угроза личная.` : `${R} пытается выбраться — ${f(l.obstacle)}.`, purpose: 'Конфликт: герой сопротивляется и проигрывает — появляются ставки' };
    },
    conflictPhysical: (x) => (x.p.conflict ? 'рука медленно тянется к замку' : 'рука снова и снова дёргает ручку — бесполезно'),
    escalationSteps: ['лёгкая хмурость, взгляд метнулся к детали и обратно', 'брови сходятся, дыхание становится поверхностным, нервное сглатывание', 'челюсть сжата, ноздри раздуваются, взгляд мечется между стеклом и дверью'],
    heartbeat: '; под фоном пробивается сердцебиение и постепенно ускоряется',
    turnFacial: 'три чётких шага: прищур, застывший взгляд, затем полное неверие с широко раскрытыми глазами; дыхание перехватывает, губы приоткрываются',
    turnSound: (x) => `Полсекунды полной тишины перед появлением, затем ${use(x).w.sound}; сердцебиение обрывается`,
    turnReaction: (t) => `Реакция в повороте: ${t}`,
    surpriseCamera(x) {
      const { l, creature } = use(x);
      return `Полсекунды плотно на лице, затем быстрый отъезд сквозь ${l.frame.acc}, открывающий полный масштаб: ${creature} возвышается над ${l.short.ins}`;
    },
    surpriseSpec(x) {
      const { l, creature } = use(x);
      return {
        composition: `контраст масштаба: ${l.short.nom} маленьким пятном в нижней трети, ${creature} нависает сверху и занимает верхние две трети`,
        cameraAngle: 'нижний ракурс снаружи, взгляд вверх мимо стекла',
        cameraMovement: `0,5 с плотно на лице, затем быстрый отъезд сквозь ${l.frame.acc} к общему плану, открывающему полный масштаб`,
      };
    },
    payoffAction: (x) => {
      const { c, sound0 } = use(x);
      return `Финальный бит: ${c.ref} медленно поднимает глаза — снаружи, совсем рядом, снова раздаётся тот же звук (${sound0}). Склейка в чёрное на звуке; последний кадр совпадает с первым, поэтому ролик зацикливается.`;
    },
    payoffEndingFrame: 'та же композиция и поза, что и в самом первом кадре ролика, для бесшовного цикла',
    payoffText: 'Стоп… это было по-настоящему?',
    storyPacing: (cold, t) => cap(`${cold ? 'флешфорвард на 1 секунду → ' : ''}быстрый хук → сжатая завязка → нарастание сердцебиения → пик на ${secRu(t)} с → развязка со вторым поворотом и циклом.`),
    message: 'Нечего улучшать — текущая версия уже достигла максимального результата. Попробуйте другой хук или большую длительность.',
  },
};
