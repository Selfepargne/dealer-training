(function (DT) {
  'use strict';

  const { h } = DT.core.dom;
  const { Icon } = DT.components;

  /**
   * Button or link styled as a button.
   * Pass `href` for navigation (renders <a>), `onClick` for actions.
   * A disabled link renders as a <button disabled> so it is never focus-trapped.
   */
  function Button({ label, variant = 'primary', size, href, onClick, arrow = false, icon, disabled = false, block = false, title, type = 'button', ...rest }) {
    const cls = ['btn', `btn--${variant}`, size && `btn--${size}`, block && 'btn--block'].filter(Boolean).join(' ');
    const content = [
      icon && Icon(icon, 'btn__icon'),
      h('span', null, label),
      arrow && Icon('arrow', 'btn__icon btn__icon--arrow'),
    ];

    if (href && !disabled) {
      return h('a', { class: cls, href, title, ...rest }, content);
    }
    return h('button', { class: cls, type, onClick, disabled, title, ...rest }, content);
  }

  function TextLink({ label, href, onClick }) {
    const tag = href ? 'a' : 'button';
    return h(tag, { class: 'text-link', href, onClick, type: href ? null : 'button' }, label, Icon('arrow'));
  }

  function Badge(label, variant) {
    return h('span', { class: `badge${variant ? ` badge--${variant}` : ''}` }, label);
  }

  function Kbd(key) {
    return h('kbd', { class: 'kbd' }, key);
  }

  DT.components.Button = Button;
  DT.components.TextLink = TextLink;
  DT.components.Badge = Badge;
  DT.components.Kbd = Kbd;
})(window.DT);
