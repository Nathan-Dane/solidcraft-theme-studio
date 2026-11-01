export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (name === 'class') node.className = value;
    else if (name === 'text') node.textContent = value;
    else if (name.startsWith('on') && typeof value === 'function') node.addEventListener(name.slice(2), value);
    else if (name === 'value') node.value = value;
    else if (name === 'checked') node.checked = !!value;
    else if (name === 'disabled') node.disabled = !!value;
    else node.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children.flat()) if (child !== undefined && child !== null) node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  return node;
}
export const button = (text, action, className = 'button small') => el('button', { type: 'button', class: className, onclick: action }, text);
export const field = (label, control, help) => {
  const id = control.id || `field-${crypto.randomUUID()}`; control.id = id;
  if (help) control.setAttribute('aria-describedby', `${id}-help`);
  return el('div', { class: 'field' }, el('label', { for: id }, label), control, help ? el('p', { class: 'field-help', id: `${id}-help` }, help) : null);
};
export const heading = (eyebrow, title, copy) => el('div', { class: 'section-heading' }, el('span', { class: 'eyebrow' }, eyebrow), el('h2', { id: 'editor-title', tabindex: '-1' }, title), el('p', {}, copy));
