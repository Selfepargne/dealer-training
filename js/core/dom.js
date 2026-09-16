(function (DT) {
  'use strict';

  /**
   * Hyperscript-style element factory.
   *   h('a', { class: 'x', href: '#/', onClick: fn }, 'label', childNode)
   * Text is always inserted as text nodes; `html` is for trusted constants only.
   */
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value == null || value === false) continue;
        if (key === 'class') el.className = value;
        else if (key === 'text') el.textContent = value;
        else if (key === 'html') el.innerHTML = value;
        else if (key === 'style' && typeof value === 'object') {
          for (const [prop, v] of Object.entries(value)) {
            if (prop.startsWith('--')) el.style.setProperty(prop, v);
            else el.style[prop] = v;
          }
        }
        else if (key === 'dataset') Object.assign(el.dataset, value);
        else if (key.startsWith('on') && typeof value === 'function') {
          el.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (value === true) el.setAttribute(key, '');
        else el.setAttribute(key, String(value));
      }
    }
    append(el, children);
    return el;
  }

  function append(parent, children) {
    for (const child of [children].flat(Infinity)) {
      if (child == null || child === false) continue;
      parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return parent;
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  function announce(message) {
    const region = document.getElementById('announcer');
    if (!region) return;
    region.textContent = '';
    // Next frame so screen readers register the change.
    requestAnimationFrame(() => { region.textContent = message; });
  }

  let toastTimer = null;
  function toast(message) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = h('div', { class: 'toast', role: 'status' });
      document.body.appendChild(el);
    }
    el.textContent = message;
    requestAnimationFrame(() => el.classList.add('is-visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2400);
  }

  DT.core.dom = { h, append, clear, announce, toast };
})(window.DT);
