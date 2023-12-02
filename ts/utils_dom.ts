/**
 * Various dom manipulation utils that have followed me around.
 */
const DIRECT_ATTRIBUTE_MAP: {[name: string]: string} = {
  cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing',
  colspan: 'colSpan',
  frameborder: 'frameBorder',
  height: 'height',
  maxlength: 'maxLength',
  nonce: 'nonce',
  role: 'role',
  rowspan: 'rowSpan',
  type: 'type',
  usemap: 'useMap',
  valign: 'vAlign',
  width: 'width',
};

const RGX_NUMERIC_STYLE_UNIT = 'px';
const RGX_NUMERIC_STYLE = /^((max|min)?(width|height)|margin|padding|(margin|padding)?(left|top|bottom|right)|fontsize|borderwidth)$/i;
const RGX_DEFAULT_VALUE_PROP = /input|textarea|select/i;


function localAssertNotFalsy<T>(input?: T|null, errorMsg = `Input is not of type.`) : T {
  if (input == null) {
    throw new Error(errorMsg);
  }
  return input;
}


const RGX_STRING_VALID = '[a-z0-9_-]';
const RGX_TAG = new RegExp(`^([a-z]${RGX_STRING_VALID}*)(\\.|\\[|\\#|$)`, 'i');
const RGX_ATTR_ID = new RegExp(`#(${RGX_STRING_VALID}+)`, 'gi');
const RGX_ATTR_CLASS = new RegExp(`(^|\\S)\\.([a-z0-9_\\-\\.]+)`, 'gi');
const RGX_STRING_CONTENT_TO_SQUARES = '(.*?)(\\[|\\])';
const RGX_ATTRS_MAYBE_OPEN = new RegExp(`\\[${RGX_STRING_CONTENT_TO_SQUARES}`, 'gi');
const RGX_ATTRS_FOLLOW_OPEN = new RegExp(`^${RGX_STRING_CONTENT_TO_SQUARES}`, 'gi');

export function createText(text: string) {
  return document.createTextNode(text);
}

export function createElement<T extends HTMLElement>(selectorOrText: string, attributes: {[name: string]: any}|null = null) {
  let selector = selectorOrText.replace(/[\r\n]\s*/g, '');
  let tag = getSelectorTag(selector);
  if (!tag) {
    tag = 'div';
  }
  const element = document.createElement(tag);
  selector = selector.replace(RGX_TAG, '$2');
  // Turn id and clasname into [attr]s that can be nested
  selector = selector.replace(RGX_ATTR_ID, '[id="$1"]');
  // selector = selector.replace(RGX_ATTR_CLASS, '$1[class="$2"]');
  selector = selector.replace(RGX_ATTR_CLASS, (match, p1, p2) => `${p1}[class="${p2.replace(/\./g, ' ')}"]`);

  const attrs = getSelectorAttributes(selector);
  if (attrs) {
    attrs.forEach((attr: string) => {
      let matches = attr.substring(1, attr.length - 1).split('=');
      let key = localAssertNotFalsy(matches.shift());
      let value: string  = matches.join('=');
      if (value === undefined) {
        setAttribute(element, key, true);
      } else {
        value = value.replace(/^['"](.*)['"]$/, '$1');
        setAttribute(element, key, value);
      }
    });
  }
  if (attributes) {
    setAttributes(element, attributes);
  }
  return element as T;
}

export function getSelfOrParent(element: HTMLElement, selector: string|Element|HTMLElement, parent: HTMLElement|null = null) : HTMLElement|null {
  // If we passed an element to check for, then add add an id, if there isn't one,
  // and set the selector to find it.
  let selectorElement;
  if (selector instanceof Element){
    selectorElement = selector;
    if (!selector.id){
      selectorElement.id = Date.now().toString(36);
    }
    selector = `#${selectorElement.id}`;
  }

  parent = parent || document.documentElement;
  let els = $$(selector, parent);
  let el: HTMLElement|null = element;
  let found = null;
  do {
    if (els.includes(el)) {
      found = el;
    }
  } while((el = el.parentElement) && el !== parent && found === null);
  // If we set a new id on the element, remove it
  if (selectorElement) {
    selectorElement.removeAttribute('id');
  }
  return found;
}

function getSelectorTag(str: string) {
  return tryMatch(str, RGX_TAG);
}

function getSelectorAttributes(selector: string) {
  RGX_ATTRS_MAYBE_OPEN.lastIndex = 0;
  let attrs: string[] = [];
  let result;
  while (result = RGX_ATTRS_MAYBE_OPEN.exec(selector)) {
    let attr = result[0];
    if (attr.endsWith(']')) {
      attrs.push(attr);
    } else {
      attr = result[0]
          + getOpenAttributesRecursive(selector.substr(RGX_ATTRS_MAYBE_OPEN.lastIndex), 2);
      RGX_ATTRS_MAYBE_OPEN.lastIndex += (attr.length - result[0].length);
      attrs.push(attr);
    }
  }
  return attrs;
}


function getOpenAttributesRecursive(selectorSubstring: string, openCount: number) {
  let matches = selectorSubstring.match(RGX_ATTRS_FOLLOW_OPEN);
  let result = '';
  if (matches && matches.length) {
    result = matches[0];
    openCount += result.endsWith(']') ? -1 : 1;
    if (openCount > 0) {
      result += getOpenAttributesRecursive(selectorSubstring.substr(result.length), openCount);
    }
  }
  return result;
}

function tryMatch(str: string, rgx: RegExp, index = 1) {
  let found = '';
  try {
    found = str.match(rgx)?.[index] || '';
  } catch (e) {
    found = '';
  }
  return found;
}

export function setAttributes(element: HTMLElement, data: {[name: string]: any}) {
  let attr;
  for (attr in data) {
    if (data.hasOwnProperty(attr)) {
      setAttribute(element, attr, data[attr]);
    }
  }
}

function getChild(value: any) : HTMLElement|DocumentFragment|Text|null {
  if (value instanceof Node) {
    return value as HTMLElement;
  }
  if (typeof value === 'string') {
    if (value.match(/<.*?>.*?<\/[a-z0-9]+>/)) {
      return document.createRange().createContextualFragment(value);
    }
    if (getSelectorTag(value)) {
      return createElement(value);
    }
    return createText(value);
  }
  if (value && typeof value.toElement === 'function') {
    return value.toElement() as HTMLElement;
  }
  return null;
}


export function setAttribute(element: HTMLElement, attribute: string, value: any) {
  const isRemoving = value == null;

  if (attribute === 'default') {
    attribute = RGX_DEFAULT_VALUE_PROP.test(element.nodeName) ? 'value' : 'text';
  }

  if (attribute === 'text') {
    empty(element).appendChild(createText(value != null ? String(value) : ''));

  } else if (attribute === 'html') {
    empty(element).innerHTML += value != null ? String(value) : '';

  } else if (attribute == 'style') {
    element.style.cssText = isRemoving ? '' : (value != null ? String(value) : '');

  } else if (attribute == 'events') {
    for (const [key, fn] of Object.entries(value as {[key: string]: (e: Event) => void})) {
      addEvent(element, key, fn);
    }

  } else if (attribute === 'parent') {
    value.appendChild(element);

  } else if (attribute === 'child' || attribute === 'children') {
    // Try to handle an array, like [li,li,li]. Not nested brackets, though
    if (typeof value === 'string' && /^\[[^\[\]]+\]$/.test(value)) {
      const parseable = value.replace(/^\[([^\[\]]+)\]$/, '["$1"]').replace(/,/g, '","');
      try {
        const parsed = JSON.parse(parseable);
        value = parsed;
      } catch(e) {
        console.error(e);
      }
    }

    let children = value instanceof Array ? value : [value];
    for (let child of children) {
      child = getChild(child);
      if (child instanceof Node) {
        if (element instanceof HTMLTemplateElement) {
          element.content.appendChild(child);
        } else {
          element.appendChild(child);
        }
      }
    }

  } else if (attribute == 'for') {
    (element as HTMLLabelElement).htmlFor = value != null ? String(value) : '';
    if (isRemoving) {
      // delete (element as HTMLLabelElement).htmlFor;
      element.removeAttribute('for');
    }

  } else if (attribute === 'class' || attribute === 'className' || attribute === 'classes') {
    element.className = isRemoving ? '' : Array.isArray(value) ? value.join(' ') : String(value);

  } else if (['checked', 'disabled', 'readonly', 'required', 'selected'].includes(attribute)) {
      // Could be input, button, etc. We are not discriminate.
      (element as HTMLInputElement)[attribute as 'checked'] = !!value;

  } else if (DIRECT_ATTRIBUTE_MAP.hasOwnProperty(attribute)) {
    if (isRemoving) {
      element.removeAttribute(DIRECT_ATTRIBUTE_MAP[attribute]!);
    } else {
      element.setAttribute(DIRECT_ATTRIBUTE_MAP[attribute]!, String(value));
    }

  } else if (isRemoving) {
    element.removeAttribute(attribute);

  } else {
    let oldVal = element.getAttribute(attribute);
    if (oldVal !== value) {
      element.setAttribute(attribute, String(value));
    }
  }
}

function addEvent(element: HTMLElement, key: string, fn: (e:Event) => void) {
  element.addEventListener(key, fn);
}

function setStyles(element: HTMLElement, styles: {[name: string]: string|number}|null = null) {
  if (styles) {
    for (let name in styles) {
      setStyle(element, name, styles[name]!);
    }
  }
  return element;
}

function setStyle(element: HTMLElement, name: string, value: string|number|null) {
  // Note: Old IE uses 'styleFloat'
  name = (name.indexOf('float') > -1 ? 'cssFloat' : name);
  // Camelcase
  if (name.indexOf('-') != -1) {
    name = name.replace(/-\D/g, (match) => {
      return match.charAt(1).toUpperCase();
    });
  }
  if (value == String(Number(value)) && RGX_NUMERIC_STYLE.test(name)) {
    value = value + RGX_NUMERIC_STYLE_UNIT;
  }
  if (name === 'display' && typeof value !== 'string') {
    value = !!value ? null : 'none';
  }
  (element.style as any)[name] = value === null ? null : String(value);
  return element;
};

function empty(element: HTMLElement) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
  return element;
}