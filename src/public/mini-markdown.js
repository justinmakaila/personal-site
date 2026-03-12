(function () {
  const escapeHtml = (value) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const renderInline = (text) => {
    const escaped = escapeHtml(text);
    const linked = escaped.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2">$1</a>',
    );
    const autoLinked = linked.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1">$1</a>',
    );
    return autoLinked
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  };

  window.parseMiniMarkdown = (markdown) => {
    const lines = markdown.split(/\r?\n/);
    const chunks = [];
    let paragraph = [];
    let inList = false;

    const flushParagraph = () => {
      if (!paragraph.length) {
        return;
      }
      chunks.push(`<p>${renderInline(paragraph.join(' ').trim())}</p>`);
      paragraph = [];
    };

    const openList = () => {
      if (!inList) {
        flushParagraph();
        chunks.push('<ul>');
        inList = true;
      }
    };

    const closeList = () => {
      if (inList) {
        chunks.push('</ul>');
        inList = false;
      }
    };

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        closeList();
        flushParagraph();
        return;
      }

      if (/^---+$/.test(trimmed)) {
        closeList();
        flushParagraph();
        chunks.push('<hr>');
        return;
      }

      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        closeList();
        flushParagraph();
        const level = headingMatch[1].length;
        const content = renderInline(headingMatch[2]);
        chunks.push(`<h${level}>${content}</h${level}>`);
        return;
      }

      const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if (bulletMatch) {
        openList();
        chunks.push(`<li>${renderInline(bulletMatch[1])}</li>`);
        return;
      }

      closeList();
      paragraph.push(trimmed);
    });

    closeList();
    flushParagraph();
    return chunks.join('\n');
  };
})();
