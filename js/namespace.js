/**
 * Global namespace. Every file registers itself on this object,
 * which keeps the app dependency-free and runnable from file://.
 */
window.DT = {
  translations: {}, // js/i18n/fr.js, js/i18n/en.js
  core: {},         // helpers: dom, format, storage, state, progression…
  data: {},         // static lists: modules, ranks, achievements
  components: {},   // reusable pieces of interface
  exercises: {},    // one entry per trainable module (js/modules/*)
  views: {},        // one entry per screen
};
