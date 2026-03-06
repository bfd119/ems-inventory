import fs from 'fs';
import { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType, convertMillimetersToTwip } from 'docx';

const mm2twip = convertMillimetersToTwip;
const FONT_JA = "MS Mincho";
const FONT_EN = "Times New Roman";
const FONT_GTHC = "MS Gothic";

const content = fs.readFileSync('論文原稿_清書.txt', 'utf8');
const lines = content.split('\n');
const children = [];

for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (rawLine === '') {
        children.push(new Paragraph({ children: [new TextRun("")] }));
        continue;
    }

    if (rawLine.startsWith('# ')) {
        children.push(new Paragraph({ style: "Title", children: [new TextRun(rawLine.replace(/^#\s*/, ''))] }));
        continue;
    }
    if (rawLine.startsWith('## ')) {
        children.push(new Paragraph({ style: "Subtitle", children: [new TextRun(rawLine.replace(/^##\s*/, ''))] }));
        continue;
    }
    if (rawLine.startsWith('### ')) {
        children.push(new Paragraph({ style: "Heading1", children: [new TextRun(rawLine.replace(/^###\s*/, ''))] }));
        continue;
    }
    if (rawLine.startsWith('#### ')) {
        children.push(new Paragraph({ style: "Heading2", children: [new TextRun(rawLine.replace(/^####\s*/, ''))] }));
        continue;
    }

    if (rawLine.includes('[ ここに画像挿入：')) {
        const match = rawLine.match(/\[ ここに画像挿入：(.*?) \]/);
        if (match && match[1]) {
            const fileName = match[1].trim();
            const imagePath = `../images/${fileName}`;

            if (fs.existsSync(imagePath)) {
                // アスペクト比をスマホ画面標準に固定
                let targetWidth = 250;
                let targetHeight = 500;

                // 横長の画面（全体統計など）への対応
                if (fileName.includes('analytics_')) {
                    targetWidth = 500;
                    targetHeight = 250;
                }

                children.push(new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new ImageRun({
                            data: fs.readFileSync(imagePath),
                            transformation: { width: targetWidth, height: targetHeight }
                        })
                    ]
                }));
            }
        }
        continue;
    }

    if (rawLine.startsWith('図') && rawLine.includes('画面')) {
        children.push(new Paragraph({ style: "FigureCaption", children: [new TextRun(rawLine)] }));
        continue;
    }

    children.push(new Paragraph({ children: [new TextRun(rawLine)] }));
}

const doc = new Document({
    styles: {
        default: {
            document: {
                run: {
                    size: 22,
                    font: { ascii: FONT_EN, hAnsi: FONT_EN, eastAsia: FONT_JA, cs: FONT_EN },
                },
                paragraph: {
                    spacing: { line: 406, lineRule: "exact" }
                }
            }
        },
        paragraphStyles: [
            { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { size: 28, bold: true, font: { ascii: FONT_EN, hAnsi: FONT_EN, eastAsia: FONT_GTHC, cs: FONT_GTHC } }, paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 240 } } },
            { id: "Subtitle", name: "Subtitle", basedOn: "Normal", next: "Normal", run: { size: 24, font: { ascii: FONT_EN, hAnsi: FONT_EN, eastAsia: FONT_GTHC, cs: FONT_GTHC } }, paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 480 } } },
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", run: { size: 22, bold: true, font: { ascii: FONT_EN, hAnsi: FONT_EN, eastAsia: FONT_GTHC, cs: FONT_GTHC } }, paragraph: { spacing: { before: 240, after: 120 } } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", run: { size: 22, bold: true, font: { ascii: FONT_EN, hAnsi: FONT_EN, eastAsia: FONT_GTHC, cs: FONT_GTHC } }, paragraph: { spacing: { before: 240, after: 120 } } },
            { id: "FigureCaption", name: "Figure Caption", basedOn: "Normal", next: "Normal", run: { size: 22, font: { ascii: FONT_EN, hAnsi: FONT_EN, eastAsia: FONT_GTHC, cs: FONT_GTHC } }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 240 } } }
        ]
    },
    sections: [{
        properties: {
            page: {
                margin: { top: mm2twip(23), bottom: mm2twip(23), left: mm2twip(25), right: mm2twip(25) },
                size: { width: mm2twip(210), height: mm2twip(297) }
            },
            grid: { type: "lines", linePitch: 406 }
        },
        children: children
    }]
});

Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync('在庫管理アプリ開発論文.docx', buffer);
    console.log("Word document created successfully.");
}).catch((err) => {
    console.error("Error creating docx:", err);
});
