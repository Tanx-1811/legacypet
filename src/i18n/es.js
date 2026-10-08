// Lines are strings or functions of `v` (see engine/speech.js for every variable).
const plural = (n, one, many) => (n === 1 ? one : many);

export default {
  code: 'es',
  species: {
    blob: 'Slime', cat: 'Gato', duck: 'Pato de goma', crab: 'Cangrejo',
    octopus: 'Pulpo', snake: 'Serpiente', cactus: 'Cactus',
    ninja: 'Zorro ninja', mecha: 'Mecha', dragon: 'Dragón espiritual', bunny: 'Conejo mágico',
    bat: 'Guardián nocturno', hero: 'Súper perrito',
  },
  traits: {
    adaptable: 'Adaptable', independent: 'Independiente', debugger: 'Depurador', molting: 'En muda',
    multitasker: 'Multitarea', patient: 'Paciente', drought: 'A prueba de sequía',
    shadowClone: 'Clon de sombra', reactor: 'Núcleo reactor', ancient: 'Poder ancestral', starlight: 'Luz estelar',
    vigilant: 'Vigilante', steel: 'Cuerpo de acero',
  },
  stages: { egg: 'Huevo', baby: 'Bebé', adult: 'Adulto', elder: 'Anciano' },
  kind: (stage, species) => `${species} ${stage.toLowerCase()}`,
  moods: {
    ecstatic: 'eufórico', happy: 'feliz', party: 'de fiesta', hungry: 'hambriento', sleepy: 'con sueño',
    sad: 'triste', sick: 'enfermo', zombie: 'no-muerto', hibernating: 'hibernando', egg: 'sin eclosionar',
  },
  titles: {
    ecstatic: 'el Radiante', happy: 'el Alegre', party: 'el Fiestero', hungry: 'el Hambriento',
    sleepy: 'el Dormilón', sad: 'el Solitario', sick: 'el Febril', zombie: 'el No-Muerto',
    hibernating: 'el Soñador', egg: 'el Por Nacer',
  },
  displayName: (name, title) => `${name} ${title}`,
  stats: { fullness: 'Saciedad', health: 'Salud', joy: 'Alegría', energy: 'Energía', hygiene: 'Higiene' },
  level: (n) => `Nv.${n}`,
  shiny: 'Brillante',
  noAchievements: 'Aún no hay trofeos. ¡Sigue publicando!',
  fed: (days) => {
    if (days < 1) return 'comió hoy';
    if (days < 2) return 'comió ayer';
    return `comió hace ${Math.floor(days)} días`;
  },
  achievements: {
    hatched: 'Eclosionado', lazarus: 'Resucitado', survivor: 'Superviviente', shiny: '¡Brillante!',
    streak7: 'En llamas', streak30: 'Cometa', centurion: 'Centurión', shipper: 'Lanzador',
    stars100: 'Estrella en ascenso', stars1k: 'Superestrella', team: 'Pandilla', spotless: 'Impecable',
    inboxZero: 'Bandeja vacía', elder: 'Sabio anciano',
    superForm: 'Forma súper', responder: 'Primera respuesta', anniversary: 'Aniversario',
  },
  lines: {
    revived: [(v) => `¡¡ESTOY VIVO!! Gracias por volver a ${v.repoName} 💚`, 'Cereeebros... ¿commits frescos? ¡Me siento VIVO!'],
    hatched: [(v) => `*crac* ¡Hola, mundo! ¡Soy ${v.name}! 🐣`, '¡Salí del cascarón! ¡Dame commits, porfa!'],
    birthday: [
      (v) => `¡${v.repoName} cumple ${v.years} ${plural(v.years, 'año', 'años')} hoy! 🎂`,
      (v) => `¡Feliz cumple a nosotros! ${v.years} ${plural(v.years, 'año', 'años')} de código 🎂`,
    ],
    release: [(v) => `¡Salió ${v.tag}! ¡A festejar! 🎉`, (v) => `¡Nueva versión ${v.tag}! Que vuele el confeti 🎊`],
    holiday: {
      halloween: ['¿Truco o trato? Yo prefiero commits 🎃', '¡Época de sustos! Mi sombrero es feature, no bug 🎃'],
      halloweenZombie: ['Halloween es MI día. Igual un commit no vendría mal 🎃'],
      christmas: ['Por Navidad solo quiero un CI en verde 🎄', '¡Feliz Merge-vidad! 🎄'],
      newyear: ['¡Año nuevo, commits nuevos! 🎆', 'Propósito: menos TODOs, más tests 🎆'],
      tet: ['¡Feliz Año Nuevo Lunar! Sobres rojos = PRs mergeados 🧧', 'Chúc mừng năm mới! Que tu CI siga en verde 🧧'],
      programmers: ['¡Feliz Día del Programador! Día 256 = 0x100 🎉'],
    },
    ciFailing: [(v) => `Me duele la pancita... "${v.check}" está fallando 🤒`, (v) => `El CI está en rojo. ¿Alguien revisa "${v.check}"?`],
    noCi: ['¿Sin CI? Nunca he ido al médico 🩺'],
    issueNudge: [
      (v) => `Psst... el issue #${v.issue} lleva ${v.issueDays} días sin respuesta`,
      (v) => `#${v.issue} está solito. ${v.issueDays} días sin respuesta 👀`,
    ],
    treat: [(v) => `@${v.treatUser} me dio una golosina (#${v.treatPr}) 🍪`, (v) => `¡Gracias @${v.treatUser} por el snack en #${v.treatPr}!`],
    streak: [(v) => `¡Racha de ${v.streak} días con commits! Imparable 🔥`],
    aura: [
      '¡PODER AL MÁXIMO! Una semana entera de dicha ✨',
      'Y esta ni siquiera es mi forma final 💥',
      (v) => `${v.auraDays} días de pura alegría. ¡Estoy brillando! ✨`,
    ],
    // Signature lines, mixed in on good days.
    species: {
      ninja: ['*puf* ¡Técnica secreta: commits clonados! 🍥', 'Un buen ninja nunca deja un TODO atrás 🥷'],
      mecha: ['Sistemas en verde. ¡Mecha, despega! 🤖', 'Reactor al 100%. Listo para desplegar 🚀'],
      dragon: ['Junta siete builds en verde y pide un deseo 🐉', 'Los pergaminos antiguos dicen: haz tests 📜'],
      bunny: ['¡Por el poder del CI en verde... transfórmate! ✨', '¡Poder del pull request, a brillar! 🌙'],
      bat: ['Patrullo los issues para que tú duermas 🦇', 'Soy el guardián que este repo merece 🦇'],
      hero: ['¡Arriba, arriba y a desplegar! 🦸', '¿Es un ave? ¿Un avión? ¡No, un build en verde! ✈️'],
    },
    moods: {
      ecstatic: ['El. Mejor. Maintainer. Del mundo. 💖', 'CI en verde, commits frescos, issues felices. ¡Dicha!', (v) => `${v.commits7} commits esta semana. ¡Estoy llenito!`],
      happy: ['Ñam ñam, ¡gracias por los commits!', (v) => `La vida es bella en ${v.repoName}.`, 'Cada commit es un snack. ¡Sigue así!'],
      party: ['¡Modo fiesta! 🎉', '¡Confeti por todas partes!'],
      hungry: [
        (v) => `${v.days} días sin commits... me comería hasta un typo`,
        'Qué hambre... hasta un retoque al README me sirve',
        (v) => `Mi platito lleva ${v.days} días vacío 🥺`,
      ],
      sleepy: ['Semana tranquila... *bostezo*', 'Despiértame cuando hagas push 💤'],
      sad: [(v) => `${v.stale} issues se sienten ignorados... yo también`, '¿Alguien hace triage? Me siento solito'],
      sick: ['*cof cof* ...tests... fallando...'],
      zombie: ['Cereeebros... digo, commiiits...', (v) => `Comí hace ${v.days} días. He visto cosas.`, '¿Alguien... sigue... manteniendo esto?'],
      hibernating: ['Este repo está archivado. Hibernando... Zzz', 'Archivado y en paz. Gracias por todo 💤'],
      egg: [
        (v) => `*bamboleo* ¡${plural(v.toHatch, 'Falta', 'Faltan')} ${v.toHatch} ${plural(v.toHatch, 'commit', 'commits')} para nacer!`,
        '*toc toc* ¿Hay alguien ahí fuera?',
      ],
    },
  },
  command: {
    pat: ['*meneo feliz* ¡Gracias por la caricia! 💕', 'Las caricias molan. Los commits, más 😋', (v) => `¡${v.name} también te quiere! 💖`],
    checkup: 'Chequeo',
    commands: 'Comandos',
    help: 'Háblame en cualquier issue o pull request:',
    usage: {
      status: 'cómo me siento y por qué',
      pat: 'dame una caricia',
      checkup: 'solo el chequeo',
      help: 'esta lista',
    },
  },
  park: {
    title: (owner) => `Parque de mascotas de ${owner}`,
    summary: (n, health, care) => `${n} ${plural(n, 'mascota', 'mascotas')} · salud del parque ${health}% · ${care ? `${care} ${plural(care, 'necesita', 'necesitan')} cuidados` : 'todas están bien'}`,
  },
  checkup: {
    fed: (d) => (d < 1 ? 'Comió hoy. ¡Sigue así!' : `Último commit hace ${d} ${plural(d, 'día', 'días')}.`),
    feed: (d) => `${d} días desde el último commit. Haz push de lo que sea, aunque sea un typo, para alimentarlo.`,
    ciPassing: 'El CI está en verde en la rama principal.',
    ciFailing: (names) => `El CI está fallando (${names}). Arréglalo para bajarle la fiebre.`,
    ciPending: 'El CI aún se está ejecutando en el último commit.',
    noCi: 'No se encontró CI. Añade un workflow de GitHub Actions para que tu mascota pueda ir al médico.',
    unanswered: (n, issue, days) => `${n} ${plural(n, 'issue de la comunidad espera', 'issues de la comunidad esperan')} una primera respuesta. El más antiguo es #${issue} (${days} días).`,
    stale: (n) => `${n} ${plural(n, 'issue o PR lleva', 'issues o PRs llevan')} más de 30 días sin actividad. Revísalos o ciérralos.`,
    issuesFine: 'Los issues y pull requests están bien atendidos.',
    noRelease: 'Aún no hay ninguna versión. Publicar una arma la fiesta 🎉',
    release: (tag, d) => `Última versión ${tag}, hace ${d} ${plural(d, 'día', 'días')}.`,
    hygiene: (score) => `El perfil de comunidad está al ${score}%. Añade lo que falte: README, licencia, CONTRIBUTING o código de conducta.`,
    hygieneFull: 'El perfil de comunidad está al 100%. ¡Impecable!',
    streak: (n) => `Racha de ${n} días con commits. ¡No la rompas!`,
    archived: 'Este repo está archivado, así que tu mascota hiberna en paz.',
  },
  diary: {
    title: (name) => `# 📔 Diario de ${name}`,
    intro: (repo) => `Escrito cada día por la mascota de **${repo}**. Lo más reciente primero.`,
    day: (n) => `Día ${n}`,
    ate: (n) => `comió ${n} ${plural(n, 'commit', 'commits')}`,
    fasted: 'hoy no comió nada',
    treat: (user, pr) => `recibió una golosina de @${user} (#${pr})`,
    unlocked: (list) => `desbloqueó ${list}`,
  },
};
