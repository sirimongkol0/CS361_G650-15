#!/usr/bin/env python3
"""Build the checked-in Thai V1 PDFs from their authoritative Markdown files."""

from __future__ import annotations

import argparse
import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
    XPreformatted,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    ROOT / "docs/setup/README-th.md": ROOT / "docs/pdf/README-th.pdf",
    ROOT / "docs/architecture/v1-architecture-th.md": ROOT / "docs/pdf/v1-architecture-th.pdf",
    ROOT / "docs/api/v1-api-contract-th.md": ROOT / "docs/pdf/v1-api-contract-th.pdf",
    ROOT / "docs/decisions/v1-tech-stack-th.md": ROOT / "docs/pdf/v1-tech-stack-th.pdf",
}


def register_fonts() -> tuple[str, str]:
    candidates = [
        (Path(r"C:\Windows\Fonts\tahoma.ttf"), Path(r"C:\Windows\Fonts\tahomabd.ttf")),
        (Path(r"C:\Windows\Fonts\LeelawUI.ttf"), Path(r"C:\Windows\Fonts\LeelaUIb.ttf")),
    ]
    for regular, bold in candidates:
        if regular.exists() and bold.exists():
            pdfmetrics.registerFont(TTFont("Thai", str(regular)))
            pdfmetrics.registerFont(TTFont("Thai-Bold", str(bold)))
            pdfmetrics.registerFontFamily("Thai", normal="Thai", bold="Thai-Bold")
            return "Thai", "Thai-Bold"
    raise RuntimeError("No supported Thai font was found in C:\\Windows\\Fonts")


def inline_markup(text: str) -> str:
    escaped = html.escape(text.strip())
    escaped = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2" color="#9f1239">\1</a>', escaped)
    escaped = re.sub(r"`([^`]+)`", r'<font name="Thai-Bold" color="#334155">\1</font>', escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", escaped)
    return escaped


def table_flowable(rows: list[list[str]], styles: dict[str, ParagraphStyle], available: float) -> Table:
    columns = max(len(row) for row in rows)
    normalized = [row + [""] * (columns - len(row)) for row in rows]
    widths = [available / columns] * columns
    if columns == 2:
        widths = [available * 0.28, available * 0.72]
    cells = [
        [Paragraph(inline_markup(cell), styles["table_head"] if index == 0 else styles["table"]) for cell in row]
        for index, row in enumerate(normalized)
    ]
    table = Table(cells, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#881337")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ]
        )
    )
    return table


def build_story(source: Path, styles: dict[str, ParagraphStyle], available: float):
    lines = source.read_text(encoding="utf-8").splitlines()
    story = []
    paragraph: list[str] = []
    table_rows: list[list[str]] = []
    code_lines: list[str] = []
    in_code = False

    def flush_paragraph():
        if paragraph:
            story.append(Paragraph(inline_markup(" ".join(paragraph)), styles["body"]))
            story.append(Spacer(1, 2.5 * mm))
            paragraph.clear()

    def flush_table():
        if table_rows:
            if len(table_rows) > 1 and all(re.fullmatch(r":?-{3,}:?", cell.strip()) for cell in table_rows[1]):
                table_rows.pop(1)
            story.append(table_flowable(table_rows, styles, available))
            story.append(Spacer(1, 3.5 * mm))
            table_rows.clear()

    for raw in lines + [""]:
        line = raw.rstrip()
        if line.lstrip().startswith("```"):
            flush_paragraph()
            flush_table()
            if in_code:
                story.append(
                    KeepTogether(
                        [
                            XPreformatted(html.escape("\n".join(code_lines)), styles["code"]),
                            Spacer(1, 3 * mm),
                        ]
                    )
                )
                code_lines.clear()
            in_code = not in_code
            continue
        if in_code:
            code_lines.append(line[3:] if line.startswith("   ") else line)
            continue
        if re.fullmatch(r"\s*---+\s*", line):
            flush_paragraph()
            flush_table()
            story.append(Spacer(1, 2 * mm))
            continue
        if line.startswith("|") and line.endswith("|"):
            flush_paragraph()
            table_rows.append([cell.strip() for cell in line.strip("|").split("|")])
            continue
        flush_table()
        image_match = re.fullmatch(r"!\[([^\]]*)\]\(([^)]+)\)", line)
        if image_match:
            flush_paragraph()
            image_path = (source.parent / image_match.group(2)).resolve()
            if image_path.suffix.lower() == ".svg":
                jpeg = image_path.with_suffix(".jpg")
                if jpeg.exists():
                    image_path = jpeg
            if image_path.exists():
                graphic = Image(str(image_path))
                scale = min(available / graphic.imageWidth, 92 * mm / graphic.imageHeight)
                graphic.drawWidth = graphic.imageWidth * scale
                graphic.drawHeight = graphic.imageHeight * scale
                graphic.hAlign = "CENTER"
                story.extend([graphic, Spacer(1, 4 * mm)])
            continue
        heading = re.match(r"^(#{1,4})\s+(.+)$", line)
        if heading:
            flush_paragraph()
            level = len(heading.group(1))
            if level == 1 and story:
                story.append(PageBreak())
            story.append(Paragraph(inline_markup(heading.group(2)), styles[f"h{level}"]))
            continue
        item = re.match(r"^(\s*)([-*]|\d+\.)\s+(.+)$", line)
        if item:
            flush_paragraph()
            indent = min(len(item.group(1)) // 2, 3)
            bullet = "•" if item.group(2) in {"-", "*"} else item.group(2)
            style = ParagraphStyle(
                f"bullet-{indent}",
                parent=styles["body"],
                leftIndent=(8 + indent * 7) * mm,
                firstLineIndent=-5 * mm,
                spaceAfter=1.5 * mm,
            )
            story.append(Paragraph(f"{html.escape(bullet)}&nbsp;&nbsp;{inline_markup(item.group(3))}", style))
            continue
        if not line.strip():
            flush_paragraph()
            continue
        paragraph.append(line.strip())
    return story


def build_pdf(source: Path, output: Path, regular: str, bold: str) -> None:
    base = getSampleStyleSheet()
    styles = {
        "body": ParagraphStyle(
            "ThaiBody", parent=base["BodyText"], fontName=regular, fontSize=10,
            leading=16, textColor=colors.HexColor("#334155"), wordWrap="CJK",
            spaceAfter=1.2 * mm,
        ),
        "h1": ParagraphStyle(
            "ThaiH1", fontName=bold, fontSize=24, leading=31,
            textColor=colors.HexColor("#881337"), spaceAfter=4 * mm, keepWithNext=True,
        ),
        "h2": ParagraphStyle(
            "ThaiH2", fontName=bold, fontSize=16, leading=22,
            textColor=colors.HexColor("#172033"), spaceBefore=4 * mm,
            spaceAfter=2 * mm, keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "ThaiH3", fontName=bold, fontSize=13, leading=19,
            textColor=colors.HexColor("#334155"), spaceBefore=3 * mm,
            spaceAfter=2 * mm, keepWithNext=True,
        ),
        "h4": ParagraphStyle(
            "ThaiH4", fontName=bold, fontSize=11, leading=17,
            textColor=colors.HexColor("#475569"), spaceBefore=2 * mm,
            spaceAfter=1.5 * mm, keepWithNext=True,
        ),
        "table": ParagraphStyle(
            "ThaiTable", fontName=regular, fontSize=7.4, leading=10.5,
            textColor=colors.HexColor("#334155"), wordWrap="CJK",
        ),
        "table_head": ParagraphStyle(
            "ThaiTableHead", fontName=bold, fontSize=7.4, leading=10.5,
            textColor=colors.white, wordWrap="CJK",
        ),
        "code": ParagraphStyle(
            "ThaiCode", fontName=regular, fontSize=7.3, leading=10,
            leftIndent=5 * mm, rightIndent=5 * mm, borderWidth=0.5,
            borderColor=colors.HexColor("#cbd5e1"), borderPadding=7,
            backColor=colors.HexColor("#f8fafc"), textColor=colors.HexColor("#1e293b"),
            wordWrap="CJK",
        ),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(
        str(output), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
        topMargin=20 * mm, bottomMargin=22 * mm,
        title=source.stem, author="PCSMS V1 Team",
    )

    def decorate(canvas, doc):
        canvas.saveState()
        canvas.setFont(regular, 8)
        canvas.setFillColor(colors.HexColor("#64748b"))
        canvas.drawString(18 * mm, 10 * mm, "PCSMS V1 Documentation")
        canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"หน้า {doc.page}")
        canvas.setStrokeColor(colors.HexColor("#e2e8f0"))
        canvas.line(18 * mm, 14 * mm, A4[0] - 18 * mm, 14 * mm)
        canvas.restoreState()

    available = A4[0] - 36 * mm
    document.build(build_story(source, styles, available), onFirstPage=decorate, onLaterPages=decorate)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Only verify source/output mapping.")
    args = parser.parse_args()
    if args.check:
        for source, output in SOURCES.items():
            print(f"{source.relative_to(ROOT)} -> {output.relative_to(ROOT)}")
        return
    regular, bold = register_fonts()
    for source, output in SOURCES.items():
        build_pdf(source, output, regular, bold)
        print(f"built {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
