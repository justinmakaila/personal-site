(function () {
  const EXPORT_STATUS = {
    noMarkdown: 'No markdown is available to copy yet.',
    noContent: 'No content is available to export yet.',
    preparingPdf: 'Preparing PDF export...',
    pdfStarted: 'PDF download started.',
    pdfUnavailable: 'PDF export is unavailable because the PDF library did not load.',
    pdfFailed: 'Unable to export PDF right now.',
    copySuccess: 'Markdown copied to clipboard.',
    copyFailed: 'Unable to copy markdown right now.',
  };

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

  const exportPdfWithJsPdf = async ({ contentEl, pdfFilename }) => {
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

  const exportPdfWithHtml2Pdf = ({ contentEl, pdfFilename }) => {
    if (typeof window.html2pdf !== 'function') {
      throw new Error('html2pdf is unavailable.');
    }

    return window
      .html2pdf()
      .set({
        margin: 10,
        filename: pdfFilename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: {
          mode: ['css', 'legacy'],
          avoid: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li'],
        },
      })
      .from(contentEl)
      .save();
  };

  const resolvePdfExporter = () => {
    if (typeof window.html2pdf === 'function') {
      return exportPdfWithHtml2Pdf;
    }

    if (window.jspdf && window.jspdf.jsPDF) {
      return exportPdfWithJsPdf;
    }

    return null;
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
        setExportStatus(EXPORT_STATUS.noMarkdown);
        return;
      }

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(markdownSource);
        } else {
          fallbackCopy(markdownSource);
        }

        setExportStatus(EXPORT_STATUS.copySuccess);
      } catch (clipboardError) {
        try {
          fallbackCopy(markdownSource);
          setExportStatus(EXPORT_STATUS.copySuccess);
        } catch (fallbackError) {
          setExportStatus(EXPORT_STATUS.copyFailed);
        }
      }
    };

    const exportPdf = async () => {
      if (!contentEl || !isContentLoaded) {
        setExportStatus(EXPORT_STATUS.noContent);
        return;
      }

      const exportPdfDocument = resolvePdfExporter();
      if (!exportPdfDocument) {
        setExportStatus(EXPORT_STATUS.pdfUnavailable);
        return;
      }

      setExportStatus(EXPORT_STATUS.preparingPdf);

      try {
        await exportPdfDocument({ contentEl, pdfFilename });
        setExportStatus(EXPORT_STATUS.pdfStarted);
      } catch (error) {
        setExportStatus(EXPORT_STATUS.pdfFailed);
      }
    };

    const exportActions = {
      'copy-markdown': copyAsMarkdown,
      'export-pdf': exportPdf,
    };

    exportActionEl.addEventListener('change', async (event) => {
      const action = event.target.value;
      const runAction = exportActions[action];

      if (runAction) {
        await runAction();
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
