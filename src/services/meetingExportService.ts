import { jsPDF } from 'jspdf';
import { MeetingSession } from '../types/friday';

export class MeetingExportService {
  /**
   * Export meeting minutes as an Executive Styled PDF
   */
  public static exportToPDF(session: MeetingSession): void {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    // Header Background
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 32, 'F');

    // Title & Branding
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('FRIDAY EXECUTIVE MEETING INTELLIGENCE', margin, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`CONFIDENTIAL MINUTES • GENERATED ${new Date().toLocaleDateString()}`, margin, 22);

    y = 40;

    // Meeting Metadata Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(session.title || 'Executive Strategy Session', margin + 4, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const durationMin = Math.floor(session.durationSeconds / 60);
    const durationSec = session.durationSeconds % 60;
    doc.text(`Date: ${session.date} | Duration: ${durationMin}m ${durationSec}s | Platform: ${session.platform || session.mode} | Transcripts: ${session.transcripts.length} snippets`, margin + 4, y + 16);

    y += 30;

    // Helper for adding section titles
    const addSectionTitle = (title: string) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(14, 116, 144); // cyan-700
      doc.text(title.toUpperCase(), margin, y);
      doc.setDrawColor(14, 116, 144);
      doc.setLineWidth(0.4);
      doc.line(margin, y + 1.5, margin + contentWidth, y + 1.5);
      y += 7;
    };

    // Helper for multi-line wrapped text
    const addWrappedText = (text: string, fontSize = 9, isBold = false, color = [51, 65, 85]) => {
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      doc.setTextColor(color[0], color[1], color[2]);
      const lines = doc.splitTextToSize(text, contentWidth);
      if (y + lines.length * 4.5 > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines, margin, y);
      y += lines.length * 4.5;
    };

    // 1. Executive Summary
    if (session.executiveSummary && session.executiveSummary.length > 0) {
      addSectionTitle('1. Executive Summary');
      session.executiveSummary.forEach((bullet) => {
        addWrappedText(`•  ${bullet}`, 9, false, [30, 41, 59]);
        y += 1.5;
      });
      y += 4;
    }

    // 2. Key Decisions Made
    if (session.keyDecisions && session.keyDecisions.length > 0) {
      addSectionTitle('2. Key Decisions & Agreements');
      session.keyDecisions.forEach((decision) => {
        addWrappedText(`✓  ${decision}`, 9, true, [15, 118, 110]); // teal-700
        y += 1.5;
      });
      y += 4;
    }

    // 3. Action Items Table
    if (session.actionItems && session.actionItems.length > 0) {
      addSectionTitle('3. Action Items & Commitments');
      
      session.actionItems.forEach((act, idx) => {
        if (y > 265) {
          doc.addPage();
          y = 20;
        }

        doc.setFillColor(idx % 2 === 0 ? 241 : 248, 245, 249);
        doc.roundedRect(margin, y - 3, contentWidth, 11, 1.5, 1.5, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        const taskLines = doc.splitTextToSize(`[${act.priority.toUpperCase()}] ${act.task}`, contentWidth - 65);
        doc.text(taskLines[0], margin + 2, y + 2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`Owner: ${act.owner}  |  Due: ${act.deadline}`, margin + contentWidth - 60, y + 2);

        y += 9;
      });
      y += 4;
    }

    // 4. Detailed Topic Breakdown
    if (session.detailedMinutes && session.detailedMinutes.length > 0) {
      addSectionTitle('4. Detailed Topic Breakdown');
      session.detailedMinutes.forEach((sec) => {
        addWrappedText(`[${sec.timestamp}] ${sec.topic}`, 9.5, true, [15, 23, 42]);
        y += 1;
        sec.keyPoints.forEach((pt) => {
          addWrappedText(`   - ${pt}`, 8.5, false, [71, 85, 105]);
          y += 1;
        });
        y += 2;
      });
      y += 4;
    }

    // 5. Full Timestamped Transcript
    if (session.transcripts && session.transcripts.length > 0) {
      addSectionTitle('5. Timestamped Transcript & Diarization');
      session.transcripts.forEach((t) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        const speakerTag = `[${t.timestamp}] ${t.speaker}:`;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(2, 132, 199); // sky-600
        doc.text(speakerTag, margin, y);

        const indent = doc.getTextWidth(speakerTag) + 2;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        const remainingWidth = contentWidth - indent;
        const textLines = doc.splitTextToSize(t.text, remainingWidth > 40 ? remainingWidth : contentWidth);
        
        if (remainingWidth > 40) {
          doc.text(textLines, margin + indent, y);
          y += Math.max(textLines.length * 3.8, 5);
        } else {
          y += 4;
          doc.text(textLines, margin + 4, y);
          y += textLines.length * 3.8 + 2;
        }
      });
    }

    // Footer on all pages
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i} of ${pageCount} • Project Ahri Meeting Intelligence System • Executive Enterprise`, margin, 290);
    }

    const safeTitle = session.title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    doc.save(`Ahri_Meeting_${safeTitle}_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  /**
   * Export meeting minutes as a rich Word Document (.doc format compatible with MS Word/Google Docs)
   */
  public static exportToWordDoc(session: MeetingSession): void {
    const durationMin = Math.floor(session.durationSeconds / 60);
    const durationSec = session.durationSeconds % 60;

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${session.title}</title>
        <style>
          body { font-family: 'Calibri', 'Helvetica', sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.5; }
          h1 { color: #0f172a; font-size: 18pt; border-bottom: 2px solid #0284c7; padding-bottom: 6px; }
          h2 { color: #0369a1; font-size: 13pt; margin-top: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; background-color: #f8fafc; }
          .meta-table td { padding: 6px 10px; font-size: 9.5pt; color: #475569; border: 1px solid #e2e8f0; }
          .action-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          .action-table th { background-color: #0f172a; color: #ffffff; text-align: left; padding: 6px 8px; font-size: 9pt; }
          .action-table td { padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 9.5pt; }
          .speaker-line { margin-bottom: 6px; font-size: 9.5pt; }
          .speaker-name { font-weight: bold; color: #0284c7; }
          .timestamp { color: #94a3b8; font-size: 8.5pt; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8pt; font-weight: bold; }
          .high-priority { background-color: #fee2e2; color: #991b1b; }
        </style>
      </head>
      <body>
        <h1>${session.title}</h1>
        <table class="meta-table">
          <tr>
            <td><strong>Date:</strong> ${session.date}</td>
            <td><strong>Duration:</strong> ${durationMin}m ${durationSec}s</td>
            <td><strong>Platform:</strong> ${session.platform || session.mode}</td>
          </tr>
          <tr>
            <td colspan="3"><strong>Attending Speakers:</strong> ${session.speakers.map(s => s.name).join(', ')}</td>
          </tr>
        </table>

        <h2>1. Executive Summary</h2>
        <ul>
          ${(session.executiveSummary || []).map(item => `<li>${item}</li>`).join('')}
        </ul>

        <h2>2. Key Decisions Made</h2>
        <ul>
          ${(session.keyDecisions || []).map(item => `<li><strong>${item}</strong></li>`).join('')}
        </ul>

        <h2>3. Action Items & Commitments</h2>
        <table class="action-table">
          <thead>
            <tr>
              <th>Action Item</th>
              <th>Owner</th>
              <th>Deadline</th>
              <th>Priority</th>
            </tr>
          </thead>
          <tbody>
            ${(session.actionItems || []).map(a => `
              <tr>
                <td>${a.task}</td>
                <td>${a.owner}</td>
                <td>${a.deadline}</td>
                <td><span class="badge ${a.priority === 'high' ? 'high-priority' : ''}">${a.priority.toUpperCase()}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${session.detailedMinutes && session.detailedMinutes.length > 0 ? `
          <h2>4. Detailed Discussion Topics</h2>
          ${session.detailedMinutes.map(m => `
            <div style="margin-bottom: 10px;">
              <strong>[${m.timestamp}] ${m.topic}</strong>
              <ul>
                ${m.keyPoints.map(p => `<li>${p}</li>`).join('')}
              </ul>
            </div>
          `).join('')}
        ` : ''}

        <h2>5. Full Transcript</h2>
        <div style="background-color: #f8fafc; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
          ${session.transcripts.map(t => `
            <div class="speaker-line">
              <span class="timestamp">[${t.timestamp}]</span>
              <span class="speaker-name">${t.speaker}:</span>
              <span>${t.text}</span>
            </div>
          `).join('')}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FRIDAY_Minutes_${session.title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Export meeting minutes as clean Markdown (.md)
   */
  public static exportToMarkdown(session: MeetingSession): void {
    const durationMin = Math.floor(session.durationSeconds / 60);
    const durationSec = session.durationSeconds % 60;

    let md = `# Meeting Minutes: ${session.title}\n\n`;
    md += `**Date:** ${session.date} | **Duration:** ${durationMin}m ${durationSec}s | **Platform:** ${session.platform || session.mode}\n\n`;
    md += `**Participants:** ${session.speakers.map(s => s.name).join(', ')}\n\n`;
    md += `---\n\n`;

    md += `## 1. Executive Summary\n\n`;
    (session.executiveSummary || []).forEach(s => {
      md += `- ${s}\n`;
    });
    md += `\n`;

    md += `## 2. Key Decisions\n\n`;
    (session.keyDecisions || []).forEach(d => {
      md += `- **${d}**\n`;
    });
    md += `\n`;

    md += `## 3. Action Items\n\n`;
    md += `| Action Item | Owner | Deadline | Priority |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    (session.actionItems || []).forEach(a => {
      md += `| ${a.task} | ${a.owner} | ${a.deadline} | ${a.priority.toUpperCase()} |\n`;
    });
    md += `\n`;

    if (session.detailedMinutes && session.detailedMinutes.length > 0) {
      md += `## 4. Detailed Topic Breakdown\n\n`;
      session.detailedMinutes.forEach(m => {
        md += `### [${m.timestamp}] ${m.topic}\n`;
        m.keyPoints.forEach(p => {
          md += `- ${p}\n`;
        });
        md += `\n`;
      });
    }

    md += `## 5. Full Timestamped Transcript\n\n`;
    session.transcripts.forEach(t => {
      const flag = t.flagged ? ` ⭐ [FLAGGED]` : '';
      md += `**[${t.timestamp}] ${t.speaker}**${flag}:\n${t.text}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FRIDAY_Minutes_${session.title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
