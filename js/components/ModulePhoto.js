(function (DT) {
  'use strict';

  const { h } = DT.core.dom;

  /**
   * La photographie d'un module, pour la carte de l'écran Entraînement.
   * Image décorative : le nom, les verbes et l'état du module sont écrits juste à côté,
   * donc `alt` reste vide. Les fichiers sont des recadrages de la planche de l'académie.
   */
  const PHOTOS = {
    holdem: ['assets/module-holdem.webp', 860, 336],
    blackjack: ['assets/module-blackjack.webp', 860, 336],
    chips: ['assets/module-chips.webp', 860, 336],
    math: ['assets/module-math.webp', 860, 336],
    table: ['assets/module-table.webp', 860, 336],
    mixed: ['assets/module-mixed.webp', 720, 508],
  };

  /** @returns {HTMLImageElement|null} null tant qu'un module n'a pas sa photographie */
  function ModulePhoto(id) {
    const photo = PHOTOS[id];
    if (!photo) return null;
    const [src, width, height] = photo;
    return h('img', {
      class: 'tile__photo',
      src,
      width,
      height,
      alt: '',
      loading: 'lazy',
      decoding: 'async',
    });
  }

  DT.components.ModulePhoto = ModulePhoto;
  DT.components.ModulePhoto.PHOTOS = PHOTOS;
})(window.DT);
