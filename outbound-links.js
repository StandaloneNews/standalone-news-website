(() => {
  const note = document.createElement('span');
  note.id = 'outbound-new-tab-note';
  note.textContent = 'Opens in a new tab.';
  note.hidden = true;
  document.body.append(note);

  const siteHosts = new Set(['standalonenews.com', 'www.standalonenews.com']);
  const previous = new WeakMap();

  function isExternal(link) {
    if (link.hasAttribute('download')) return false;
    try {
      const url = new URL(link.href);
      return (url.protocol === 'http:' || url.protocol === 'https:')
        && url.origin !== location.origin && !siteHosts.has(url.hostname);
    } catch {
      return false;
    }
  }

  function updateLink(link) {
    const state = previous.get(link);
    if (!isExternal(link)) {
      if (!state) return;
      if (state.ownsTarget && link.target === '_blank') {
        if (state.target === null) link.removeAttribute('target');
        else link.setAttribute('target', state.target);
      }
      link.relList.remove(...state.addedRel);
      if (state.ownsTitle && link.title === note.textContent) link.removeAttribute('title');
      const descriptions = (link.getAttribute('aria-describedby') || '').split(/\s+/)
        .filter(id => id && id !== note.id);
      if (descriptions.length) link.setAttribute('aria-describedby', descriptions.join(' '));
      else link.removeAttribute('aria-describedby');
      previous.delete(link);
      return;
    }

    const target = link.getAttribute('target');
    if (target && target !== '_self' && target !== '_blank') return;

    if (!state) {
      previous.set(link, {
        target, ownsTarget: target !== '_blank',
        addedRel: ['noopener', 'noreferrer'].filter(value => !link.relList.contains(value)),
        ownsTitle: !link.hasAttribute('title'),
      });
    }
    link.target = '_blank';
    link.relList.add('noopener', 'noreferrer');
    if (!link.hasAttribute('title')) link.title = note.textContent;
    const descriptions = new Set((link.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    descriptions.add(note.id);
    link.setAttribute('aria-describedby', [...descriptions].join(' '));
  }

  function updateLinks(root) {
    if (!(root instanceof Element)) return;
    if (root instanceof HTMLAnchorElement && root.hasAttribute('href')) updateLink(root);
    root.querySelectorAll('a[href]').forEach(updateLink);
  }

  updateLinks(document.body);
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes' && record.target instanceof HTMLAnchorElement) {
        updateLink(record.target);
      } else {
        record.addedNodes.forEach(updateLinks);
      }
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'download'] });
})();
