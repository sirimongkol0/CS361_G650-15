"""Create six distinct fictional PDFs, and package them for Docker seeding."""
import hashlib
import html
import json
import shutil
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, KeepTogether

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from demo_content import DOCUMENT_DETAILS, NOTICE, PARTNER_DETAILS
# Import the constant definitions without loading DB configuration/credentials.
import ast
tree = ast.parse((ROOT / 'backend/seed_demo.py').read_text(encoding='utf-8'))
values = {node.targets[0].id: ast.literal_eval(node.value) for node in tree.body
          if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name)
          and node.targets[0].id in ['PARTNERS', 'DOCUMENTS']}


def build():
    out = ROOT / 'output/pdf'
    packaged = ROOT / 'backend/fixtures/demo-documents'
    out.mkdir(parents=True, exist_ok=True)
    packaged.mkdir(parents=True, exist_ok=True)
    pdfmetrics.registerFont(TTFont('ThaiDemo', 'C:/Windows/Fonts/LeelawUI.ttf'))
    pdfmetrics.registerFont(TTFont('ThaiDemoBold', 'C:/Windows/Fonts/LeelaUIb.ttf'))
    pdfmetrics.registerFontFamily('ThaiDemo', normal='ThaiDemo', bold='ThaiDemoBold')
    body = ParagraphStyle('body', fontName='ThaiDemo', fontSize=11, leading=18,
                          textColor=colors.HexColor('#334155'), wordWrap='CJK', spaceAfter=8)
    heading = ParagraphStyle('heading', parent=body, fontName='ThaiDemoBold', fontSize=11,
                             textColor=colors.HexColor('#8B1538'), spaceBefore=7)
    title = ParagraphStyle('title', parent=heading, fontSize=17, leading=25, spaceAfter=12)
    small = ParagraphStyle('small', parent=body, fontSize=9, leading=14)
    notice = ParagraphStyle('notice', parent=small, textColor=colors.HexColor('#92400e'),
                            backColor=colors.HexColor('#fffbeb'), borderPadding=8, spaceAfter=16)
    manifest = {}
    for index, (name, partner, kind, status, start, end, availability, published) in enumerate(values['DOCUMENTS']):
        if availability != 'available':
            continue
        filename = f'demo-agreement-{index + 1}.pdf'
        target = out / filename
        doc = SimpleDocTemplate(str(target), pagesize=A4, rightMargin=21*mm, leftMargin=21*mm,
                                topMargin=21*mm, bottomMargin=20*mm,
                                title=name, author='CS361 fictional demonstration', pageCompression=1)
        def para(text, style=body):
            return Paragraph(html.escape(text), style)
        story = [para(NOTICE, notice), para(name, title),
                 para(f"คู่ความร่วมมือสมมติ: {values['PARTNERS'][partner][0]}"),
                 para(f"ประเภท: {kind.upper()} | สถานะ ณ 2 ตุลาคม 2569: {status or 'แบบฟอร์ม'}", small),
                 para(f"ช่วงเวลาที่มีผล: {start or 'ยังไม่กำหนด'} ถึง {end or 'ยังไม่กำหนด'}", small),
                 para(f"ผู้รับผิดชอบสมมติ: {PARTNER_DETAILS[partner][3]}", small), Spacer(1, 6*mm)]
        for label, content in DOCUMENT_DETAILS[index]:
            story.append(KeepTogether([para(label, heading), para(content)]))
        story.extend([Spacer(1, 5*mm), para('การรับรองและการใช้งาน', heading),
                      para('เอกสารนี้ไม่มีผลทางกฎหมาย ไม่มีลายมือชื่อจริง และไม่ใช้ยืนยันความร่วมมือของบุคคลหรือหน่วยงานใด วันที่ ตัวเลข ผลลัพธ์ และหน้าที่ทั้งหมดเป็นสถานการณ์สมมติ'),
                      para('ผู้ลงนามสมมติ: ไม่ลงลายมือชื่อในเอกสารสาธิต', small)])
        def page(canvas, document):
            canvas.saveState()
            canvas.setStrokeColor(colors.HexColor('#e2e8f0'))
            canvas.line(21*mm, 16*mm, A4[0]-21*mm, 16*mm)
            canvas.setFont('ThaiDemo', 8)
            canvas.setFillColor(colors.HexColor('#64748b'))
            canvas.drawString(21*mm, 11*mm, 'CS361 | FICTIONAL DEMO | 2026-10-02')
            canvas.drawRightString(A4[0]-21*mm, 11*mm, f'หน้า {document.page}')
            canvas.restoreState()
        doc.build(story, onFirstPage=page, onLaterPages=page)
        shutil.copyfile(target, packaged / filename)
        data = target.read_bytes()
        manifest[str(index)] = {'file': filename, 'name': name, 'sizeBytes': len(data),
                                'sha256': hashlib.sha256(data).hexdigest()}
    (packaged / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    build()
