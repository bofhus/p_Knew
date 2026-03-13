export function createEditor({ modal, onSave }) {
  const openButton = modal.querySelector('#detail-edit-btn');
  const panel = modal.querySelector('#editor-panel');
  const saveButton = modal.querySelector('#editor-save');
  const cancelButton = modal.querySelector('#editor-cancel');
  const statusMessage = modal.querySelector('#editor-status');

  const fields = {
    title: modal.querySelector('#edit-title'),
    summary: modal.querySelector('#edit-summary'),
    example: modal.querySelector('#edit-example'),
    practical: modal.querySelector('#edit-practical'),
    mediaUrl: modal.querySelector('#edit-media-url')
  };

  let visible = false;

  function setVisible(nextVisible) {
    visible = nextVisible;
    panel.classList.toggle('open', visible);
    if (!visible && statusMessage) statusMessage.textContent = '';
    if (visible) fields.title.focus();
  }

  function bindCell(cell) {
    fields.title.value = cell.title || '';
    fields.summary.value = cell.summary || '';
    fields.example.value = cell.example || '';
    fields.practical.value = cell.practical || '';
    fields.mediaUrl.value = cell.mediaUrl || cell.media || '';
    setVisible(false);
  }

  function setAdminEnabled(enabled) {
    openButton.classList.toggle('hidden', !enabled);
    if (!enabled) setVisible(false);
  }

  openButton.addEventListener('click', () => setVisible(!visible));
  cancelButton.addEventListener('click', () => setVisible(false));
  saveButton.addEventListener('click', async () => {
    if (statusMessage) statusMessage.textContent = '';

    try {
      await onSave({
        title: fields.title.value.trim(),
        summary: fields.summary.value.trim(),
        example: fields.example.value.trim(),
        practical: fields.practical.value.trim(),
        mediaUrl: fields.mediaUrl.value.trim()
      });
      if (statusMessage) statusMessage.textContent = 'Ändringar sparades.';
      setVisible(false);
    } catch (error) {
      if (statusMessage) statusMessage.textContent = error?.message || 'Kunde inte spara ändringar.';
    }
  });

  return {
    bindCell,
    setAdminEnabled,
    close: () => setVisible(false)
  };
}

export function renderMedia(container, cell) {
  container.innerHTML = '';
  const mediaUrl = (cell.mediaUrl || cell.media || '').trim();

  if (!mediaUrl) {
    container.innerHTML = '<p class="media-placeholder">Ingen media tillagd.</p>';
    return;
  }

  const lower = mediaUrl.toLowerCase();
  const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'].some((ext) => lower.includes(ext));
  const isVideo = ['.mp4', '.webm', '.ogg', '.mov', '.m4v'].some((ext) => lower.includes(ext));
  const isYoutube = lower.includes('youtube.com/watch') || lower.includes('youtu.be/') || lower.includes('youtube.com/embed/');

  if (isYoutube) {
    const iframe = document.createElement('iframe');
    iframe.src = toYoutubeEmbed(mediaUrl);
    iframe.title = `Media för ${cell.title || 'cell'}`;
    iframe.loading = 'lazy';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    container.appendChild(iframe);
    return;
  }

  if (isImage) {
    const img = document.createElement('img');
    img.src = mediaUrl;
    img.alt = `Media för ${cell.title || 'cell'}`;
    container.appendChild(img);
    return;
  }

  if (isVideo) {
    const video = document.createElement('video');
    video.src = mediaUrl;
    video.controls = true;
    container.appendChild(video);
    return;
  }

  const link = document.createElement('a');
  link.href = mediaUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Open media link';
  container.appendChild(link);
}

function toYoutubeEmbed(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.replace('/', '');
      return `https://www.youtube.com/embed/${id}`;
    }

    if (parsed.pathname.includes('/embed/')) {
      return url;
    }

    const id = parsed.searchParams.get('v');
    if (id) {
      return `https://www.youtube.com/embed/${id}`;
    }
  } catch {
    return url;
  }

  return url;
}
