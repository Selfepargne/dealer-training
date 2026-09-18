/*
  Décoration — la pluie dorée du fond et le hero photographique.   Lancer :  node tests/decor.test.js

  1. Le niveau de chaque écran : les exercices n'ont rien, le tableau de bord a le plus.
  2. La couche : un nombre fixe d'enseignes et de grains, aucune donnée, aucun clic, aucun focus clavier.
  3. La matière : un trait d'or (pas une surface), lent, varié, et toujours la même composition.
  4. Les règles de la feuille de style : masquée sur les exercices, figée si l'on demande moins
     d'animation, et seulement transform et opacity animés.
  5. Le hero : la photographie est décorative, mais le prénom, la date et le module restent vivants.
*/
const fs = require('fs');
const path = require('path');

global.window = { DT: { translations: {}, core: {}, data: {}, components: {}, exercises: {}, views: {} } };
global.navigator = { language: 'fr-FR' };
global.document = { documentElement: {} };

/** Un élément minimal : on garde sa balise, ses props et ses enfants. */
const h = (tag, props, ...children) => ({ tag, props: props || {}, children: children.flat(Infinity).filter((c) => c != null && c !== false) });
window.DT.core.dom = { h };
require('../js/components/GoldenSuits.js');

const Suits = window.DT.components.GoldenSuits;
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const size = (p) => fs.statSync(path.join(__dirname, '..', p)).size;

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, error: e.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function equal(a, b, msg) { assert(JSON.stringify(a) === JSON.stringify(b), `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

const items = (layer) => layer.children.filter((c) => /suits__item/.test(c.props.class));
const grains = (layer) => layer.children.filter((c) => /suits__grain/.test(c.props.class));

// ---------------------------------------------------------------------------
// 1. Un niveau par écran
// ---------------------------------------------------------------------------

test('Chaque écran a son niveau, et un exercice n’en a aucun', () => {
  equal(Suits.levelFor('/dashboard'), 'hero', 'le tableau de bord est la vitrine');
  equal(Suits.levelFor('/training'), 'normal', 'entraînement');
  equal(Suits.levelFor('/training/holdem'), 'normal', 'la page d’un module');
  equal(Suits.levelFor('/challenges'), 'lively', 'défis');
  equal(Suits.levelFor('/progress'), 'calm', 'progression');
  equal(Suits.levelFor('/settings'), 'still', 'réglages');
  equal(Suits.levelFor('/stats'), 'subtle', 'statistiques (pas encore construit)');
  equal(Suits.levelFor('/leaderboard'), 'subtle', 'classement (pas encore construit)');
  equal(Suits.levelFor('/resources'), 'calm', 'ressources (pas encore construit)');
  // Exercices et sessions : rien du tout
  ['/train/holdem', '/train/blackjack', '/train/daily'].forEach((p) => equal(Suits.levelFor(p), 'none', `aucune décoration sur ${p}`));
  // Un écran inconnu reste calme plutôt que vide ou chargé
  ['/whatever', '', '/'].forEach((p) => equal(Suits.levelFor(p), 'calm', `écran inconnu ${p}`));
});

// ---------------------------------------------------------------------------
// 2. La couche
// ---------------------------------------------------------------------------

const VARS = ['--x', '--size', '--duration', '--delay', '--drift', '--spin', '--dim', '--way'];

test('La couche : des enseignes, des grains, invisibles pour les technologies d’assistance, jamais cliquables', () => {
  const layer = Suits();
  equal(layer.props.class, 'suits', 'la couche');
  equal(layer.props['aria-hidden'], 'true', 'masquée aux lecteurs d’écran');
  equal(items(layer).length, Suits.COUNT, `${Suits.COUNT} enseignes au plus`);
  equal(grains(layer).length, Suits.GRAINS, `${Suits.GRAINS} grains`);
  assert(Suits.COUNT <= 16, 'une poignée d’enseignes, pas une averse');
  assert(Suits.GRAINS <= 40, 'de la poussière, pas de la neige');

  items(layer).forEach((item, i) => {
    assert(['♠', '♥', '♦', '♣'].includes(item.children[0]), `enseigne ${i + 1} : l’une des quatre`);
    assert(item.tag === 'span' && !item.props.href && !item.props.onClick && item.props.tabindex == null, `enseigne ${i + 1} : décorative`);
    VARS.forEach((v) => assert(item.props.style[v] != null, `enseigne ${i + 1} : ${v} présent`));
  });
  grains(layer).forEach((g, i) => {
    equal(g.children.length, 0, `grain ${i + 1} : aucun contenu`);
    VARS.concat(['--halo']).forEach((v) => assert(g.props.style[v] != null, `grain ${i + 1} : ${v} présent`));
  });
  // Les quatre enseignes apparaissent toutes
  equal([...new Set(items(layer).map((c) => c.children[0]))].sort(), ['♠', '♣', '♥', '♦'].sort(), 'les quatre enseignes');
});

test('La matière : un trait d’or, lent, varié, et qui entre toujours dans le champ', () => {
  const layer = Suits();
  const num = (el, v) => parseFloat(el.props.style[v]);

  items(layer).forEach((item, i) => {
    const px = num(item, '--size');
    const seconds = num(item, '--duration');
    const dim = num(item, '--dim');
    assert(px >= 16 && px <= 76, `enseigne ${i + 1} : taille lisible (${px}px)`);
    assert(seconds >= 50, `enseigne ${i + 1} : lente (${seconds}s)`);
    // Un contour, pas une surface : il lui faut plus d'opacité qu'un glyphe plein, jamais l'opacité totale
    assert(dim >= 0.4 && dim <= 0.95, `enseigne ${i + 1} : un trait discret (${dim})`);
    assert(num(item, '--delay') <= 0, `enseigne ${i + 1} : déjà en route`);
    assert(Math.abs(num(item, '--spin')) <= 10, `enseigne ${i + 1} : quelques degrés seulement`);
    // Celle qui descend doit entrer par le haut, sinon elle ne traverserait jamais l'écran
    const down = item.props.style['--way'] === '-1';
    equal(/suits__item--down/.test(item.props.class), down, `enseigne ${i + 1} : le sens et le point de départ s’accordent`);
  });

  grains(layer).forEach((g, i) => {
    assert(num(g, '--size') <= 4, `grain ${i + 1} : un grain, pas un point (${num(g, '--size')}px)`);
    assert(num(g, '--duration') >= 50, `grain ${i + 1} : lent`);
    assert(g.props.style['--way'] === '1', `grain ${i + 1} : la poussière monte`);
  });

  const sizes = new Set(items(layer).map((item) => num(item, '--size')));
  const dims = new Set(items(layer).map((item) => num(item, '--dim')));
  assert(sizes.size >= 8 && dims.size >= 8, `tailles variées (${sizes.size}) et opacités variées (${dims.size})`);
  const ways = new Set(items(layer).map((item) => item.props.style['--way']));
  equal([...ways].sort(), ['-1', '1'], 'les deux sens');
  assert(items(layer).some((item) => /suits__item--far/.test(item.props.class)), 'quelques-unes au loin, au trait plus fin');
});

test('La même composition à chaque chargement, et aucune donnée métier', () => {
  equal(Suits().children.map((c) => c.props.style), Suits().children.map((c) => c.props.style), 'les mêmes enseignes');
  // Le composant ne lit ni les données enregistrées ni la progression
  delete window.DT.core.state;
  delete window.DT.core.progression;
  equal(Suits().children.length, Suits.COUNT + Suits.GRAINS, 'construite sans aucune donnée');
  equal(Suits.length, 0, 'la couche ne prend aucun argument d’un écran');
  const src = read('js/components/GoldenSuits.js');
  assert(!/DT\.core\.state|DT\.core\.progression|data\.stats|\bskills\b/.test(src), 'le composant ne lit aucune donnée métier');
});

// ---------------------------------------------------------------------------
// 3. Où elle est utilisée, et les règles de la feuille de style
// ---------------------------------------------------------------------------

test('Construite une fois par le cadre, et par aucun écran : un exercice ne peut pas en hériter', () => {
  const shell = read('js/components/Shell.js');
  equal((shell.match(/GoldenSuits\(\)/g) || []).length, 1, 'une seule couche, construite par le cadre');
  assert(/dataset\.decor = GoldenSuits\.levelFor\(path\)/.test(shell), 'le niveau vient de la route');
  for (const file of fs.readdirSync(path.join(__dirname, '..', 'js', 'views'))) {
    const src = read(path.join('js', 'views', file));
    assert(!/GoldenSuits|suits__item|'suits'/.test(src), `${file} n’ajoute pas de décoration de son côté`);
  }
  // L'écran d'exercice et les tables ne parlent jamais de décoration
  ['js/views/session.js', 'js/modules/holdem/holdem.js', 'js/modules/holdem/dealer-view.js', 'js/modules/holdem/ultimate-view.js', 'js/components/DealerPov.js']
    .forEach((f) => assert(!/suits|decor/.test(read(f)), `${f} reste sans décoration`));
});

test('La feuille de style : éteinte sur les exercices, figée si l’on demande moins d’animation, et peu coûteuse', () => {
  const css = read('css/decor.css');
  assert(/\[data-decor="none"\] \.suits \{ display: none; \}/.test(css), 'aucune décoration sur un écran d’exercice');
  assert(/@media \(prefers-reduced-motion: reduce\)/.test(css), 'la préférence système est respectée');
  assert(/html\[data-motion="reduced"\] \.suits__item/.test(css), 'le réglage Mouvement de l’application est respecté');
  assert(/pointer-events: none/.test(css), 'la couche ne prend jamais un clic');
  // Seuls transform et opacity bougent : aucun calcul de mise en page, aucun repeint de la page
  const frames = css.slice(css.indexOf('@keyframes suit-drift'), css.indexOf('/* ---- How many suits'));
  const moved = [...frames.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
  equal([...new Set(moved)].sort(), ['opacity', 'transform'], 'l’animation ne bouge que transform et opacity');
  // Aucune image, aucune vidéo, aucune bibliothèque extérieure dans la décoration
  assert(!/url\(|\.png|\.jpg|\.webp|video/.test(css), 'aucune image et aucune vidéo dans la feuille de décoration');
  // Chaque taille d'écran a son compte
  ['(max-width: 1179px)', '(max-width: 767px)'].forEach((q) => assert(css.includes(q), `moins d’enseignes à ${q}`));
  // Les utilitaires de mise en page de l'application ne sont jamais redéfinis ici
  const classes = new Set([...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(^|[\s,>])\.([a-zA-Z][\w-]*)/gm)].map((m) => m[2]));
  ['stack', 'row', 'grid', 'grid-2', 'view', 'panel', 'btn'].forEach((c) => assert(!classes.has(c), `.${c} n’est jamais redéfini par la décoration`));
});

test('La palette de l’application : l’or vient des variables, pas de couleurs nouvelles', () => {
  const css = read('css/decor.css');
  // La partie « pluie » ne connaît que les variables : le hero, lui, est une photographie
  // et a besoin de ses noirs et de son blanc de titre.
  const rain = css.slice(0, css.indexOf('Le hero du tableau de bord'));
  equal([...rain.matchAll(/#[0-9a-f]{3,8}/gi)].map((m) => m[0]), [], 'la pluie n’introduit aucune couleur');
  assert(/var\(--gold\)/.test(rain) && /var\(--accent-lo\)/.test(rain), 'l’or vif et le bronze de la palette');
  assert(/var\(--gold-hi\)/.test(css) && /var\(--gold-line\)/.test(css), 'le hero et les chiffres utilisent le même or');
});

// ---------------------------------------------------------------------------
// 4. Le hero photographique
// ---------------------------------------------------------------------------

test('Le hero : la photographie est décorative, le prénom, la date et le module restent vivants', () => {
  const view = read('js/views/dashboard.js');
  // L'image est posée par le tableau de bord, avec ses dimensions (pas de saut de mise en page)
  assert(/class: 'hero__photo'/.test(view), 'la photographie est dans le hero');
  assert(/srcset:/.test(view) && /sizes:/.test(view), 'deux largeurs servies selon l’écran');
  assert(/width: 1600/.test(view) && /height: 641/.test(view), 'les dimensions sont déclarées');
  assert(/alt: ''/.test(view), 'image décorative : son texte est réécrit en HTML juste après');
  assert(/hero__veil/.test(view), 'le voile éteint le texte imprimé dans la photographie');
  // Ce que la photographie montre en dur doit rester dynamique dans la page
  assert(/fmt\.longDate\(\)/.test(view), 'la date est celle du jour');
  assert(/data\.profile\.name/.test(view), 'le prénom est celui du profil');
  assert(/t\(`modules\.\$\{target\}\.name`\)/.test(view), 'le module est celui de la prochaine session');
  assert(/t\('app\.motto'\)/.test(view), 'la devise vient des traductions');

  // Les deux fichiers existent et restent légers : c'est la seule image lourde de l'application
  ['assets/hero-table-1600.webp', 'assets/hero-table-1100.webp'].forEach((f) => {
    assert(fs.existsSync(path.join(__dirname, '..', f)), `${f} est livré`);
    assert(size(f) < 160 * 1024, `${f} reste léger (${Math.round(size(f) / 1024)} Ko)`);
  });
  // Et l'application ne charge pas le PNG d'origine
  assert(!/hero-table\.png/.test(view + read('index.html')), 'le PNG d’origine n’est pas servi');
});

test('Les vignettes de modules : une photographie par discipline, légère et décorative', () => {
  const src = read('js/components/ModulePhoto.js');
  const view = read('js/views/training.js');
  // Chaque module de l'écran Entraînement a sa photographie
  const ids = [...read('js/data/modules.js').matchAll(/\{ id: '(\w+)', index:/g)].map((m) => m[1]);
  assert(ids.length >= 6, `les modules sont lus (${ids.length})`);
  ids.forEach((id) => assert(new RegExp(`^\\s+${id}: \\[`, 'm').test(src), `${id} a sa photographie`));

  // Les fichiers sont livrés et restent légers : une carte n'est pas un hero
  // Seul le tableau des modules compte ici : les scènes (le défi du jour) sont vérifiées plus bas
  const start = src.indexOf('const PHOTOS = {');
  const photos = src.slice(start, src.indexOf('};', start));
  const files = [...photos.matchAll(/'(assets\/[\w.-]+\.webp)'/g)].map((m) => m[1]);
  assert(files.length === ids.length, `${ids.length} fichiers référencés`);
  files.forEach((f) => {
    assert(fs.existsSync(path.join(__dirname, '..', f)), `${f} est livré`);
    assert(size(f) < 64 * 1024, `${f} reste léger (${Math.round(size(f) / 1024)} Ko)`);
  });

  // Décoratives : le nom, les verbes et l'état du module sont écrits à côté
  assert(/alt: ''/.test(src), 'image décorative');
  assert(/loading: 'lazy'/.test(src), 'chargée seulement quand elle approche');
  assert(/width,\n\s+height,/.test(src), 'dimensions déclarées : aucun saut de mise en page');
  // La composition dessinée reste le repli si un module n'a pas de photographie
  assert(/photo \|\| ModuleArt\(m\.id\)/.test(view), 'repli sur la composition dessinée');
  // Le défi du jour de l'onglet Défis a sa photographie, avec le même repli
  const challenges = read('js/views/challenges.js');
  assert(/ScenePhoto('daily', 'daily__photo') || ModuleArt('holdem')/.test(challenges), 'le défi du jour a sa photographie, et son repli');
  assert(fs.existsSync(path.join(__dirname, '..', 'assets/challenge-daily.webp')), 'la photographie du défi est livrée');
  assert(size('assets/challenge-daily.webp') < 80 * 1024, 'et reste légère');
  // Le composant est chargé avant les écrans qui s'en servent
  const html = read('index.html');
  assert(html.indexOf('ModulePhoto.js') < html.indexOf('js/views/'), 'chargé avant les écrans');
});

const failed = results.filter((r) => !r.ok);
results.forEach((r) => console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n    ${r.error}`}`));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
