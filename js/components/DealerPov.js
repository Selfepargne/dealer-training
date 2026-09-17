/*
  DealerPov — the dealer's view, shared by every exercise that shows a table.
  The student sits in the dealer's seat: the dealer's place at the bottom of the screen, the table in front,
  tilted away over the dealer's shoulder, the players around it, the centre of the table (board, pot) in front of the dealer.

    scene({ …})    the table and its layers; each exercise only brings its own content
    place(angle)   where something sits around the table, from its angle in the table layout of the module
                   (0° = the dealer, then clockwise from the dealer's left). Returns CSS custom properties only:
                     --px  −1 (left) … 1 (right)
                     --py  −1 (far side, opposite the dealer) … 1 (dealer's side)
    side(angle)    'far' · 'side' · 'near' — which side of the table a place is on (for the layout of a place)
    compact()      true on a phone: the scene is stacked (far players · centre · near players · dealer) instead of a ring,
                   because six places with their chips never fit around a 358 px ring. Same reading, adapted composition.

  Presentation only. Seats, button, blinds, cards, bets and board come from the question and its rules;
  nothing is ever read back from these coordinates.
*/
(function (DT) {
  'use strict';

  const { h } = DT.core.dom;

  const radians = (angle) => (angle * Math.PI) / 180;

  function place(angle) {
    const r = radians(angle);
    return { '--px': (-Math.sin(r)).toFixed(4), '--py': Math.cos(r).toFixed(4) };
  }

  function side(angle) {
    const py = Math.cos(radians(angle));
    return py < -0.2 ? 'far' : py > 0.2 ? 'near' : 'side';
  }

  /** Phones: the ring becomes rows. Read once per question, so a rotation is picked up on the next one. */
  const compact = () => typeof matchMedia === 'function' && matchMedia('(max-width: 600px)').matches;

  /** Reading order of a stacked scene: the far players, the centre of the table, the near players, then the dealer. */
  const ROW = { far: 1, centre: 2, side: 1, near: 3, dealer: 4 };

  /** The dealer's place: what lies in front of the dealer (optional), the chip rack at the edge of the table, a discreet label. */
  function dealerPlace(content) {
    const rack = [100, 50, 25, 10, 5, 1].map((value) => h('span', { class: `pov-rack__tube chip--d${value}` }));
    return h('div', { class: 'pov-dealer' },
      content,
      h('div', { class: 'pov-dealer__place' },
        h('div', { class: 'pov-rack', 'aria-hidden': 'true' }, rack),
        h('span', { class: 'pov-dealer__label' }, DT.i18n.t('dealer.dealerSeat'))));
  }

  /**
   * @param {object} options
   *   className  classes of the exercise (its own sizes and pieces)
   *   dataset    data attributes of the root
   *   layout     'ring' — places positioned around the table (place()) · 'rows' — players on the far side, centre, dealer
   *   shape      'oval' · 'halfmoon' (a table with the dealer on the straight side)
   *   centre     the centre of the table: board, pot, labels
   *   seats      the players' places (ring: elements with class pov-seat and a place() style)
   *   layers     things on the table between the centre and the places: bets (pov-on-bets), dealer button (pov-on-rail)
   *   dealer     what lies in front of the dealer, above the rack (optional)
   *   below      under the table, before the question (legend, pay tables)
   *   stack      false keeps the ring on phones (small places, e.g. a showdown); by default a ring is stacked on phones
   */
  function scene({ className = '', dataset, layout = 'ring', shape = 'oval', centre, seats = [], layers = [], dealer, below, stack = true }) {
    const stacked = stack && layout === 'ring' && compact();
    const centreBox = centre && h('div', { class: 'pov-centre' }, centre);
    const dealerBox = dealerPlace(dealer);
    if (stacked) {
      // Rows on a phone: each place keeps its real side of the table, the reading order stays the dealer's one
      seats.forEach((el) => el.style.setProperty('--row', ROW[Number(el.style.getPropertyValue('--py')) < -0.2 ? 'far' : 'near']));
      if (centreBox) centreBox.style.setProperty('--row', ROW.centre);
      dealerBox.style.setProperty('--row', ROW.dealer);
    }
    return h('div', { class: `pov pov--${layout} pov--${shape}${stacked ? ' pov--stacked' : ''} ${className}`, dataset },
      h('div', { class: 'pov-scene' },
        h('div', { class: 'pov-table', 'aria-hidden': 'true' }, h('div', { class: 'pov-felt' })),
        layout === 'rows' && h('div', { class: 'pov-players' }, seats),
        centreBox,
        layers,
        layout === 'ring' && seats,
        dealerBox),
      below);
  }

  DT.components.DealerPov = { scene, place, side, compact };
})(window.DT);
