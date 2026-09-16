(function (DT) {
  'use strict';

  const { h } = DT.core.dom;

  const SUITS = {
    s: { symbol: '♠', red: false },
    h: { symbol: '♥', red: true },
    d: { symbol: '♦', red: true },
    c: { symbol: '♣', red: false },
  };

  /**
   * Playing card. `code` = rank + suit, e.g. 'As', 'Th', '7d'.
   * The text variation selector (U+FE0E) stops suits turning into emoji.
   */
  function Card({ code, size = 'md', faceDown = false }) {
    const t = DT.i18n.t;
    const sizeClass = size === 'md' ? '' : ` pcard--${size}`;
    if (faceDown) {
      return h('span', { class: `pcard pcard--back${sizeClass}`, role: 'img', 'aria-label': t('cards.faceDown') });
    }
    const rank = code[0].toUpperCase();
    const suitKey = code[1].toLowerCase();
    const suit = SUITS[suitKey];
    const shownRank = rank === 'T' ? '10' : rank;
    const glyph = suit.symbol + '︎';
    const corner = (extra = '') =>
      h('span', { class: `pcard__corner${extra}`, 'aria-hidden': 'true' },
        h('span', { class: 'pcard__rank' }, shownRank),
        h('span', { class: 'pcard__csuit' }, glyph));

    return h(
      'span',
      {
        class: `pcard${suit.red ? ' pcard--red' : ''}${sizeClass}`,
        role: 'img',
        'aria-label': t('cards.name', { rank: t(`cards.ranks.${rank}`), suit: t(`cards.suits.${suitKey}`) }),
        dataset: { card: rank + suitKey },
      },
      corner(),
      h('span', { class: 'pcard__pip', 'aria-hidden': 'true' }, glyph),
      corner(' pcard__corner--br')
    );
  }

  DT.components.Card = Card;
})(window.DT);
