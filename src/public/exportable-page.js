(function () {
  const fallbackCopy = (text) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    const wasCopied = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (!wasCopied) {
      throw new Error('Fallback copy failed.');
    }
  };

  const exportSelectablePdf = async ({ contentEl, pdfFilename }) => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('jsPDF is unavailable.');
    }

    const { jsPDF } = window.jspdf;
    const documentPdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    await documentPdf.html(contentEl, {
      margin: [10, 10, 10, 10],
      autoPaging: 'text',
      html2canvas: {
        scale: 1,
      },
    });

    documentPdf.save(pdfFilename);
  };

  window.initExportablePage = ({
    contentId,
    exportActionId,
    exportStatusId,
    markdownPath,
    contentLabel,
    supportEmail,
    missingMarkdownError,
    fallbackHeading,
    fallbackBody,
    pdfFilename,
  }) => {
    const contentEl = document.getElementById(contentId);
    const exportActionEl = document.getElementById(exportActionId);
    const exportStatusEl = document.getElementById(exportStatusId);
    let markdownSource = '';
    let isContentLoaded = false;

    const setExportStatus = (message) => {
      exportStatusEl.textContent = message;
    };

    const copyAsMarkdown = async () => {
      if (!markdownSource) {
        setExportStatus('No markdown is available to copy yet.');
        return;
      }

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(markdownSource);
        } else {
          fallbackCopy(markdownSource);
        }

        setExportStatus('Markdown copied to clipboard.');
      } catch (clipboardError) {
        try {
          fallbackCopy(markdownSource);
          setExportStatus('Markdown copied to clipboard.');
        } catch (fallbackError) {
          setExportStatus('Unable to copy markdown right now.');
        }
      }
    };

    const exportPdf = async () => {
      if (!contentEl || !isContentLoaded) {
        setExportStatus('No content is available to export yet.');
        return;
      }

      if (!window.jspdf || !window.jspdf.jsPDF) {
        setExportStatus('PDF export is unavailable because the PDF library did not load.');
        return;
      }

      setExportStatus('Preparing PDF export…');

      try {
        await exportSelectablePdf({ contentEl, pdfFilename });
        setExportStatus('PDF download started.');
      } catch (error) {
        setExportStatus('Unable to export PDF right now.');
      }
    };

    exportActionEl.addEventListener('change', async (event) => {
      const action = event.target.value;

      if (action === 'copy-markdown') {
        await copyAsMarkdown();
      }

      if (action === 'export-pdf') {
        await exportPdf();
      }

      event.target.value = '';
    });

    const renderFallback = () => {
      const mailTo = `mailto:${supportEmail}`;
      contentEl.innerHTML = [
        fallbackHeading,
        fallbackBody,
        '<p>Unable to load the latest content. You can retry now or contact support.</p>',
        `<p><button type="button" id="${contentId}-retry">Retry now</button></p>`,
        `<p><a href="/">Return home</a> · <a href="${mailTo}">${supportEmail}</a></p>`,
      ].join('');

      const retryButton = document.getElementById(`${contentId}-retry`);
      if (retryButton) {
        retryButton.addEventListener('click', () => {
          void loadMarkdown();
        });
      }
    };

    const loadMarkdown = async () => {
      setExportStatus(`Fetching ${contentLabel} content...`);

      try {
        const response = await fetch(markdownPath, { cache: 'no-cache' });
        if (!response.ok) {
          throw new Error(missingMarkdownError);
        }

        const markdown = await response.text();
        markdownSource = markdown;

        if (window.parseMiniMarkdown) {
          contentEl.innerHTML = window.parseMiniMarkdown(markdown);
        } else {
          contentEl.innerHTML = `<pre>${markdown.replace(/</g, '&lt;')}</pre>`;
        }

        isContentLoaded = true;
        setExportStatus(`${contentLabel} loaded.`);
      } catch (error) {
        isContentLoaded = false;
        setExportStatus(`Unable to load ${contentLabel.toLowerCase()} content right now.`);
        renderFallback();
      }
    };

    void loadMarkdown();
  };
})();
