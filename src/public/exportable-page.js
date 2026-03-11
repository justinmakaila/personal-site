(function () {
  const fallbackCopy = (text) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  };

  window.initExportablePage = ({
    contentId,
    exportActionId,
    exportStatusId,
    markdownPath,
    missingMarkdownError,
    fallbackHeading,
    fallbackBody,
    pdfFilename,
  }) => {
    const contentEl = document.getElementById(contentId);
    const exportActionEl = document.getElementById(exportActionId);
    const exportStatusEl = document.getElementById(exportStatusId);
    let markdownSource = '';

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
      } catch (error) {
        setExportStatus('Unable to copy markdown right now.');
      }
    };

    const exportPdf = async () => {
      if (!markdownSource) {
        setExportStatus('No content is available to export yet.');
        return;
      }

      if (!window.html2pdf) {
        setExportStatus('PDF export is unavailable because the library did not load.');
        return;
      }

      setExportStatus('Preparing PDF export…');

      try {
        await window.html2pdf()
          .set({
            filename: pdfFilename,
            margin: [10, 10, 10, 10],
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          })
          .from(contentEl)
          .save();

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

    fetch(markdownPath)
      .then((response) => {
        if (!response.ok) {
          throw new Error(missingMarkdownError);
        }

        return response.text();
      })
      .then((markdown) => {
        markdownSource = markdown;
        contentEl.innerHTML = marked.parse(markdown);
      })
      .catch(() => {
        contentEl.innerHTML = [
          fallbackHeading,
          fallbackBody,
          '<p>Please check back later.</p>',
        ].join('');
      });
  };
})();
